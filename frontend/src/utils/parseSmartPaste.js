/**
 * =========================================================
 * ⚡ SMART PASTE PARSER + ROUTING (PART 1)
 * =========================================================
 * Includes:
 * - Core parsing
 * - Flag detection
 * - Logic normalization (FIXED)
 * - Condition builder (FIXED)
 * - Text parsing
 * =========================================================
 */

export function parseSmartPaste(text) {
  if (!text) return [];

  const blocks = text.split(/(?=Question Type:)/gi);

  const typeMap = [
    ["carousel format multi select grid", "card_checkbox"],
    ["carousel format single select grid", "card_radio"],
    ["multi select grid", "checkbox_grid"],
    ["single select grid", "radio_grid"],
    ["multi select", "checkbox"],
    ["single select", "radio"],
    ["autosum", "autosum"],
    ["multiple open numeric", "number_multi"],
    ["open numeric", "number_single"],
    ["decimal", "float_multi"],
    ["multiple long oe", "textarea_multi"],
    ["long oe", "textarea_single"],
    ["multiple short oe", "text_multi"],
    ["short oe", "text_single"],
    ["ranking", "ranking"],
    ["intro", "html"],
    ["survey comment", "html"],
  ];

  const questions = [];

  // =========================================================
  // 🔹 HELPERS
  // =========================================================

  const getValue = (line) => {
    return (
      line.split("#@")[1]?.trim() ||
      line.split(/-|–/)[1]?.trim() ||
      ""
    );
  };

  const cleanText = (text) => {
    return text
      .replace(/\[.*?\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const extractFlags = (line) => ({
    anchor: /\[.*anchor.*\]/i.test(line),
    exclusive: /\[.*exclusive.*\]/i.test(line),
    terminate: /\[.*terminate.*\]/i.test(line),
    other: /other.*specify/i.test(line),
  });

  // =========================================================
  // 🔥 LOGIC ENGINE (FIXED)
  // =========================================================

  const normalizeLogic = (logic) => {
    if (!logic) return null;

    // 🔥 CRITICAL: keep raw logic
    if (typeof logic === "string") {
      return logic;
    }

    if (typeof logic === "object") {
      return {
        source: logic.source,
        rows: logic.rows || [],
        columns: logic.columns || [],
        operator: logic.operator || "or",
      };
    }

    return null;
  };

  const buildCond = (logic) => {
    if (!logic) return "";

    // 🔥 RAW SUPPORT
    if (typeof logic === "string") {
      return ` cond="(${logic})"`;
    }

    const { source, rows = [], columns = [], operator = "or" } = logic;

    if (!source || !rows.length) return "";

    const conds = [];

    rows.forEach((r) => {
      if (columns.length) {
        columns.forEach((c) => {
          conds.push(`${source}.r${r}.c${c}`);
        });
      } else {
        // 🔥 FIX: non-grid
        conds.push(`${source}.r${r}`);
      }
    });

    const joiner = operator === "and" ? " and " : " or ";

    return ` cond="(${conds.join(joiner)})"`;
  };

  // =========================================================
  // 🔹 BLOCK PARSING
  // =========================================================

  blocks.forEach((block, index) => {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    let q = {
      id: "",
      type: "",
      title: "",
      description: "",
      comment: "",

      optionsText: "",
      rowsText: "",
      columnsText: "",

      options: [],
      rows: [],
      columns: [],

      logic: null,
      cond: "",
      target: null,

      randomize: { rows: false, columns: false, all: false },

      optionFlags: [],
      rowFlags: [],
      columnFlags: [],
    };

    let mode = null;

    // =========================================================
    // 🔹 LINE PARSER
    // =========================================================

    for (let line of lines) {
      const lower = line.toLowerCase();

      // ================= TYPE =================
      if (!q.type && lower.includes("question type")) {
        for (let [key, val] of typeMap) {
          if (lower.includes(key)) {
            q.type = val;
            break;
          }
        }
        continue;
      }

      // ================= LABEL =================
      if (lower.startsWith("label")) {
        const val = getValue(line);

        q.id = val
          .toLowerCase()
          .replace(/\./g, "")
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");

        continue;
      }

      // ================= TITLE =================
      if (lower.startsWith("title")) {
        q.title = getValue(line);
        continue;
      }

      // ================= DESCRIPTION =================
      if (lower.startsWith("description")) {
        q.description = getValue(line);
        continue;
      }

      // ================= COMMENT =================
      if (lower.startsWith("comment")) {
        q.comment = getValue(line);
        continue;
      }

      // =========================================================
      // 🔥 ROUTING PARSING (NEW)
      // =========================================================

      if (lower.startsWith("logic")) {
        const val = getValue(line);
        q.logic = normalizeLogic(val);
        continue;
      }

      if (lower.startsWith("goto")) {
        q.type = "goto";
        q.target = getValue(line);
        continue;
      }

      if (lower.startsWith("terminate")) {
        q.type = "term";
        q.title = getValue(line);
        continue;
      }

      if (lower.startsWith("block")) {
        q.type = "block";
        q.title = getValue(line);
        continue;
      }

      // ================= MODE SWITCH =================
      if (/^options\b/i.test(line)) {
        mode = "options";
        if (/\[randomize\]/i.test(line)) q.randomize.all = true;
        continue;
      }

      if (/^rows\b/i.test(line)) {
        mode = "rows";
        if (/\[randomize\]/i.test(line)) q.randomize.rows = true;
        continue;
      }

      if (/^columns\b/i.test(line)) {
        mode = "columns";
        if (/\[randomize\]/i.test(line)) q.randomize.columns = true;
        continue;
      }
    
      // ================= SAFE MODE RESET =================
      if (
        lower.startsWith("question type") ||
        lower.startsWith("label") ||
        lower.startsWith("title") ||
        lower.startsWith("comment")
      ) {
        mode = null;
        continue;
      }

      const flags = extractFlags(line);

      let clean = line
        .replace(/\[anchor\]/gi, "")
        .replace(/\[exclusive\]/gi, "")
        .replace(/\[terminate\]/gi, "")
        .trim();

      if (!clean) continue;

      // =========================================================
      // 🔹 INLINE DESCRIPTION SUPPORT
      // =========================================================
      if (/^description:/i.test(clean)) {
        const desc = clean.replace(/^description:\s*/i, "").trim();

        const target =
          mode === "options"
            ? q.optionFlags
            : mode === "rows"
            ? q.rowFlags
            : mode === "columns"
            ? q.columnFlags
            : null;

        if (target && target.length) {
          target[target.length - 1].description = desc;
        }

        continue;
      }

      // =========================================================
      // 🔹 NORMALIZE LINE
      // =========================================================
      let normalized = clean
        .replace(/^(\d+)[\.\)\-:]\s*/, "$1. ")
        .replace(/^[-•]\s*/, "")
        .trim();

      let text = normalized;
      let description = "";

      // pipe description
      if (normalized.includes("|")) {
        const parts = normalized.split("|");
        text = parts[0].trim();
        description = parts[1].trim();
      }

      const match = text.match(/^(\d+)\.\s+(.*)/);

      let value = null;
      let labelText = text;

      if (match) {
        value = parseInt(match[1]);
        labelText = match[2];
      }

      const item = {
        value: value || (mode === "columns" ? 1 : (q.options.length + q.rows.length + 1)),
        text: cleanText(labelText),
        description,
        anchor: flags.anchor,
        exclusive: flags.exclusive,
        terminate: flags.terminate,
        other: flags.other,
      };

      // =========================================================
      // 🔥 FORCE SPECIAL OPTIONS (CRITICAL)
      // =========================================================
      if (value === 97 || value === 99) {
        item.anchor = true;
        item.exclusive = true;
      }

      if (item.other) {
        item.anchor = true;
      }

      // =========================================================
      // 🔹 PUSH TO CORRECT BUCKET
      // =========================================================
      if (mode === "options") {
        q.options.push(item);
        q.optionFlags.push({ ...flags, description });
      }

      else if (mode === "rows") {
        q.rows.push(item);
        q.rowFlags.push({ ...flags, description });
      }

      else if (mode === "columns") {
        q.columns.push(item);
        q.columnFlags.push({ ...flags, description });
      }
    }

    // =========================================================
    // 🔥 FINAL NORMALIZATION
    // =========================================================

    if (!q.id) {
      q.id = `q_${Date.now()}_${index}`;
    }

    if (!q.type) {
      q.type = "radio";
    }

    // clean text blocks
    q.optionsText = q.optionsText?.trim();
    q.rowsText = q.rowsText?.trim();
    q.columnsText = q.columnsText?.trim();

    // =========================================================
    // 🔥 APPLY CONDITION STRING
    // =========================================================
    q.cond = buildCond(q.logic);

    // =========================================================
    // 🔥 ROUTING STRUCTURE NORMALIZATION
    // =========================================================

    if (q.type === "goto") {
      q = {
        type: "goto",
        logic: q.logic,
        cond: q.cond,
        target: q.target,
      };
    }

    if (q.type === "term") {
      q = {
        type: "term",
        label: q.id,
        title: q.title,
        logic: q.logic,
        cond: q.cond,
      };
    }

    if (q.type === "block") {
      q = {
        type: "block",
        label: q.id,
        title: q.title,
        logic: q.logic,
        cond: q.cond,
      };
    }

    // =========================================================
    // 🔹 FINAL PUSH
    // =========================================================
    if (q.title || q.type === "goto" || q.type === "term" || q.type === "block") {
      questions.push(q);
    }
  });

  // =========================================================
  // 🔹 RETURN FINAL STRUCTURE
  // =========================================================
  return questions;
}