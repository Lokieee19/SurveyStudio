import { useState, useEffect } from "react";
import { previewQuestion, generateXML } from "./api";
import SurveyPreview from "./components/SurveyPreview";
import GenerateButton from "./components/GenerateButton";
import { getUser, logout } from "./api";

import Login from "./Login";
import Signup from "./Signup";


// 🔥 CLEAN SPECIAL TAGS (ANCHOR, EXCLUSIVE, ETC.)
const cleanText = (txt) =>
  (txt || "")
    .replace(/\[(anchor|exclusive|terminate|other)\]/gi, "")
    .trim();


export default function App() {
  const [user, setUser] = useState(null);
  const [showSignup, setShowSignup] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (u) setUser(u);
  }, []);

  if (!user) {
    return showSignup
      ? <Signup setShowSignup={setShowSignup} />
      : <Login onLogin={setUser} setShowSignup={setShowSignup} />;
  }

  // ============================================
  // 🚀 MULTI QUESTION STATE (NEW)
  // ============================================
  const [questions, setQuestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [parsed, setParsed] = useState([]);
  const [activePreviewLabel, setActivePreviewLabel] = useState(null);
  const [activePanel, setActivePanel] = useState("setup");
  const [activeSection, setActiveSection] = useState("setup");
  const [showOptions, setShowOptions] = useState(false);
  // ============================================
  // STATE (UNCHANGED)
  // ============================================
  const [form, setForm] = useState({
    id: "",
    title: "",
    type: "radio",
    description: "",  
    comment: "",

    optionsText: "",
    rowsText: "",
    columnsText: "",

    rangeMin: "",
    rangeMax: "",

    autosumRows: [{ title: "", desc: "" }],

    randomize: {
      rows: false,
      columns: false,
      all: false,
    },

    exclusive: false,

  config: {
    optional: false,
    atleast: "",
    atmost: "",
    exact: "",
    unique: "",
    verify: "",

    amount: "",
    tolerance: "",
    enforceTotal: true,
    autoFillRemainder: false,
    showTotal: true,

    rowLegend: "",
    preText: "",
    alignment: "right",
    inputSize: "medium",
    placeholder: "",

    autoAdvance: false,
    disableInsteadOfHide: false,

    randomizeSubset: "",
    keepFirstFixed: false,
    keepLastFixed: false,

    includeOther: false,
    includeNone: false,
    includeDK: false,
    includePNA: false,

    errorMessage: "",

    variableName: "",
    exportLabel: "",
  },

    logicEnabled: false,
    logicSource: "",
    logicColumns: "",

    parsedOptions: [],
    parsedRows: [],
    parsedColumns: [],
    smartPasteText: ""
  });

  const injectSpecialOptions = (options = [], config = {}) => {
    let updated = [...options];

    const exists = (val) =>
      updated.some(o => Number(o.value) === val);

    const special = [];

    if (config.includeDK && !exists(97)) {
      special.push({ value: 97, text: "Don't know", anchor: true, exclusive: true });
    }

    if (config.includeOther && !exists(98)) {
      special.push({ value: 98, text: "Other (please specify)", other: true, anchor: true });
    }

    if (config.includeNone && !exists(99)) {
      special.push({ value: 99, text: "None of the above", anchor: true, exclusive: true });
    }

    if (config.includePNA && !exists(96)) {
      special.push({ value: 96, text: "Prefer not to answer", anchor: true, exclusive: true });
    }

    // ✅ ALWAYS append at end (stable order)
    return [...updated, ...special];
  };
  const [xml, setXml] = useState("");
  const [loading, setLoading] = useState(false);
  const CopyBlock = ({ title = "JavaScript", code = "" }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      } catch {
        alert("Copy failed");
      }
    };
    return (
      <div style={styles.copyBlock}>
        <div style={styles.copyHeader}>
          <div style={styles.copyTitle}>
            {"</>"} {title}
          </div>

          <button style={styles.copyBtn} onClick={handleCopy}>
            {copied ? "✓" : "⧉"}
          </button>
        </div>

        <pre style={styles.copyCode}>
          <code>{code}</code>
        </pre>
      </div>
    );
  };


  const enforceOptionRules = (opt) => {
    const text = (opt.text || "").trim();
    const value = Number(opt.value);

    let updated = { ...opt };

    const isOther = text.includes("other");
    const isDK = /don't know|dont know|not sure/i.test(text);
    const isNone = /none of the above|none of these/i.test(text);

    /* =========================
      1. RESPECT INPUT FLAGS FIRST
    ========================= */
    const hasExplicitExclusive = opt.exclusive !== undefined;
    const hasExplicitAnchor = opt.anchor !== undefined;
    const hasExplicitTerminate = opt.terminate !== undefined;
    const hasExplicitOther = opt.other !== undefined;

    /* =========================
      2. VALUE-BASED DEFAULTS (ONLY IF NOT PROVIDED)
    ========================= */
    if ([97, 98, 99].includes(value)) {

      if (!hasExplicitAnchor) {
        updated.anchor = true;
      }

      if (value === 98) {
        if (!hasExplicitOther) updated.other = true;
        if (!hasExplicitExclusive) updated.exclusive = false;
        if (!hasExplicitTerminate) updated.terminate = false;
      } else {
        if (!hasExplicitExclusive) updated.exclusive = true;

        // 🔥 FORCE TERMINATE FOR 97 & 99
        if (value === 99 && !hasExplicitTerminate) {
          updated.terminate = true;
        }
      }
    }

    /* =========================
      3. TEXT-BASED FALLBACKS
      (ONLY if value rule didn't apply)
    ========================= */
    else {
      if (isOther) {
        if (!hasExplicitAnchor) updated.anchor = true;
        if (!hasExplicitOther) updated.other = true;
        if (!hasExplicitExclusive) updated.exclusive = false;
      }

      if (isDK || isNone) {
        if (!hasExplicitAnchor) updated.anchor = true;
        if (!hasExplicitExclusive) updated.exclusive = true;
        if (value === 99 && !hasExplicitTerminate) {
          updated.terminate = true;
        }
      }
    }

    return updated;
  };


  // ============================================
  // 🔄 SYNC FORM FROM ACTIVE QUESTION
  // ============================================
  useEffect(() => {
    if (!questions.length) return;

    const q = questions[activeIndex];
    if (!q) return;

    setForm(prev => {
      // 🧠 Prevent overwrite if switching to new empty question
      if (!q.id && !q.title) return prev;

      return {
        ...prev,
        ...q
      };
    });
  }, [activeIndex]);

  // ============================================
  // 🔄 SYNC FORM → QUESTIONS
  // ============================================
  const syncToQuestions = (updatedForm) => {
    setQuestions(prev => {
      if (!prev.length) return prev;

      const updated = [...prev];
      updated[activeIndex] = {
        ...updated[activeIndex],
        ...updatedForm
      };

      return updated;
    });
  };

  const parseWithValues = (textBlock) => {
    return (textBlock || "")
      .split("\n")
      .filter(Boolean)
      .map((line, idx) => {
        const match = line.match(/^\s*(\d+)[\.\)]\s*(.*)$/);

        let value, text;

        if (match) {
          value = Number(match[1]);
          text = match[2];
        } else {
          value = idx + 1;
          text = line;
        }

        return enforceOptionRules({
          label: `r${value}`,
          value,
          text: text
            .replace(/^\d+\.\s*/, "")
            .replace(/\[PIPE:/gi, "[pipe:")
            .trim(),
        });
      });
  };
  // ============================================
  // SAFE QUESTION UPDATE
  // ============================================
  const updateCurrentQuestion = (updater) => {
    setQuestions(prev => {
      if (!prev.length) return prev;

      const updated = [...prev];
      const current = { ...updated[activeIndex] };

      updated[activeIndex] = updater(current);

      return updated;
    });
  };


  // ============================================
  // GENERIC CHANGE HANDLER (UPDATED)
  // ============================================
  const handleChange = (field, value) => {
    setForm((prev) => {

      let updated;

      // 🔥 HANDLE NESTED CONFIG
      if (field === "config") {
        updated = {
          ...prev,
          config: {
            ...prev.config,
            ...value
          }
        };
      }

      else if (field === "randomize") {
        updated = {
          ...prev,
          randomize: {
            ...prev.randomize,
            ...value
          }
        };
      }

      // 🔥 RANGE AUTO VERIFY (NEW)
      else if (field === "rangeMin" || field === "rangeMax") {

        const newMin = field === "rangeMin" ? value : prev.rangeMin;
        const newMax = field === "rangeMax" ? value : prev.rangeMax;

        let verify = prev.config.verify;

        if (newMin !== "" && newMax !== "") {
          verify = `range(${newMin},${newMax})`;
        }

        updated = {
          ...prev,
          [field]: value,
          config: {
            ...prev.config,
            verify
          }
        };
      }

      else {
        updated = {
          ...prev,
          [field]: value,
        };
      }

      updateCurrentQuestion(prevQ => ({
        ...prevQ,
        ...updated
      }));

      return updated;
    });
  };

  // ============================================
  // 🚀 QUESTION MANAGEMENT (NEW)
  // ============================================
  const addQuestion = () => {
    const newQ = {
      id: `q${questions.length + 1}`,
      title: "",
      type: "radio",
      description: "",
      comment: "",
      optionsText: "",
      rowsText: "",
      columnsText: "",
      rangeMin: "",
      rangeMax: "",
      autosumRows: [{ title: "", desc: "" }],
      parsedOptions: [],
      parsedRows: [],
      parsedColumns: [],
      randomize: { rows: false, columns: false, all: false },
      exclusive: false,
      config: { ...form.config },
    };

    setQuestions(prev => {
      const updated = [...prev, newQ];
      setActiveIndex(updated.length - 1);
      return updated;
    });
  };

  const deleteQuestion = (index) => {
    const updated = questions.filter((_, i) => i !== index);

    setQuestions(updated);

    if (!updated.length) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex(Math.max(0, index - 1));
  };

  const duplicateQuestion = (index) => {
    const clone = JSON.parse(JSON.stringify(questions[index]));

    const updated = [...questions];
    updated.splice(index + 1, 0, clone);

    setQuestions(updated);
  };

  // ============================================
  // AUTOSUM HANDLING (UNCHANGED)
  // ============================================
  const handleAutosumChange = (index, field, value) => {
    const updated = [...form.autosumRows];
    updated[index][field] = value;

    setForm((prev) => ({
      ...prev,
      autosumRows: updated,
    }));

    updateCurrentQuestion(prev => ({
      ...prev,
      autosumRows: updated
    }));
  };

  const processOptions = (opts, config) => {
    const processed = opts.map(enforceOptionRules);

    // 🚫 DO NOT REORDER (critical for Decipher)
    return processed;
  };

  const addAutosumRow = () => {
    const updated = [...form.autosumRows, { title: "", desc: "" }];

    setForm(prev => ({
      ...prev,
      autosumRows: updated
    }));

    updateCurrentQuestion(prev => ({
      ...prev,
      autosumRows: updated
    }));
  };

  const removeAutosumRow = (index) => {
    const updated = form.autosumRows.filter((_, i) => i !== index);

    setForm((prev) => ({
      ...prev,
      autosumRows: updated,
    }));

    updateCurrentQuestion(prev => ({
      ...prev,
      autosumRows: updated
    }));
  };

  // ============================================
  // INPUT CLEANING
  // ============================================
  const cleanInput = (text) => {
    return text || "";
  };

  // ============================================
  // BUILD PAYLOAD (UNCHANGED)
  // ============================================
  const getCleanForm = () => {
    return {
      id: form.id.trim(),
      title: form.title.trim(),
      type: form.type,

      description: form.description.trim(),
      comment: form.comment.trim(),

      optionsText: cleanInput(form.optionsText),

      rowsText:
        form.type === "autosum"
          ? form.autosumRows
              .map((r, i) =>
                r.title
                  ? `${i + 1}. ${r.title}`
                  : ""
              )
              .filter(Boolean)
              .join("\n")
          : cleanInput(form.rowsText),

      columnsText: cleanInput(form.columnsText),

      range:
        form.rangeMin && form.rangeMax
          ? [Number(form.rangeMin), Number(form.rangeMax)]
          : null,

      config: {
        ...form.config,
        amount: form.config.amount ? Number(form.config.amount) : undefined,
        minRanks: form.config.minRanks ? Number(form.config.minRanks) : undefined,
        unique: form.config.unique || undefined,
      },

      randomize: form.randomize,
      exclusive: !!form.exclusive,
    };
  };

  // ============================================
  // PREVIEW (UPDATED → MULTI QUESTION)
  // ============================================
  const handlePreview = async () => {
    try {
      if (!questions.length) {
        alert("No questions available");
        return;
      }

      // ✅ MOVE VALIDATION HERE (CORRECT PLACE)
      const validQuestions = questions.filter(q =>
        q.id && q.title && q.type
      );

      if (!validQuestions.length) {
        alert("No valid questions to preview");
        return;
      }

      setLoading(true);

      /* ============================================
        BUILD PAYLOAD FOR ALL QUESTIONS
      ============================================ */
      const payloads = validQuestions.map((q) => ({
        id: q.id?.trim(),
        title: q.title
          ?.replace(/\[PIPE:/gi, "[pipe:")
          .trim(),
        type: q.type,

        description: q.description?.trim(),
        comment: q.comment?.trim(),

        optionsText: cleanInput(q.optionsText),
        insert: q.insert || null,
        rowsText:
          q.type === "autosum"
            ? (
                q.parsedRows?.length > 0
                  ? q.parsedRows.map(r => `${r.value}. ${r.text}`).join("\n")
                  : ""
              )
            : cleanInput(q.rowsText),

        columnsText: cleanInput(q.columnsText),

        parsedRows: q.parsedRows || [],
        parsedOptions: q.parsedOptions || [],

        range:
          q.rangeMin && q.rangeMax
            ? [Number(q.rangeMin), Number(q.rangeMax)]
            : null,

        config: q.config || {},
        randomize: {
          enabled: q.randomize?.all || q.randomize?.rows || false,
          rows: q.randomize?.rows || false,
          cols: q.randomize?.columns || false,
        },
        exclusive: !!q.exclusive,

        routing: {
          cond: q.logic ? cleanLogicForBackend(q.logic) : null,
          goto: q.target || null,
          term: q.terminate || null,
          default: q.defaultTarget || null
        },
      }));

      /* ============================================
        🔥 BUILD ONE SCRIPT (CRITICAL FIX)
      ============================================ */
      const combinedScript = payloads
        .map(p => `
      Question Type: ${p.type}
      Label #@ ${p.id}
      Title #@ ${p.title}

      ${p.description ? `Description #@ ${p.description}` : ""}
      ${p.comment ? `Comment #@ ${p.comment}` : ""}

      ${p.optionsText ? `Options:\n${p.optionsText}` : ""}
      ${p.rowsText ? `Rows:\n${p.rowsText}` : ""}
      ${p.columnsText ? `Columns:\n${p.columnsText}` : ""}
      `)
        .join("\n\n");

      /* ============================================
        🔥 SINGLE API CALL
      ============================================ */
      // 🔥 USE FRONTEND PARSED DATA DIRECTLY
      const allQuestions = payloads.map(p => ({
        id: p.id,
        label: p.id, // ✅ CRITICAL
        title: p.title,
        type: p.type,
        description: p.description,
        comment: p.comment,

        options: parseWithValues(p.optionsText),
        rows: parseWithValues(p.rowsText),
        columns: parseWithValues(p.columnsText),

        routing: p.routing || {},
      }));

      setParsed(allQuestions);
      setXml("");

      if (!allQuestions.length) return;

      const updatedQuestions = [...validQuestions];

      allQuestions.forEach((q) => {
        const original = validQuestions.find(v => v.id === q.id);
        if (!original) return;

        const index = validQuestions.findIndex(v => v.id === q.id);

        updatedQuestions[index] = {
          ...original,

          parsedOptions: (q.options || []).map(opt =>
            enforceOptionRules({
              ...opt,
              text: opt.text,
              value: Number(opt.value) || 0 // 🔥 CRITICAL
            })
          ),

          parsedRows: (q.rows || []).map(row =>
            enforceOptionRules({
              ...row,
              text: row.text,
              value: Number(row.value)
            })
          ),

          parsedColumns: (q.columns || []).map(col => ({
            ...col,
            text: col.text
          })),
        };
      });
      setQuestions(prev =>
        prev.map(q => {
          const match = updatedQuestions.find(u => u.id === q.id);
          return match ? match : q;
        })
      );
      setActiveIndex(prev => prev);

      setForm(prev => ({
        ...prev,
        ...(updatedQuestions[activeIndex] || {})
      }));

    } catch (err) {
      console.error(err);
      alert("Preview failed");
    } finally {
      setLoading(false);
    }
  };
  // ============================================
  // SMART PASTE (UPDATED → MULTI QUESTION)
  // ============================================
  const handleSmartPaste = (text) => {
    if (!text || !text.trim()) {
      alert("Paste some content first");
      return;
    }

    const blocks = parseSmartPaste(text);
    console.log("SMART BLOCKS:", blocks);

    if (!blocks || !blocks.length) {
      alert("Nothing parsed");
      return;
    }

    const cleanRow = (t) =>
      t.replace(/^\d+\.\s*/, "").trim();

    const detectAmount = (b) => {
      const combined = `${b.title} ${b.description} ${b.comment}`.trim();

      if (combined.includes("100%") || combined.includes("percent")) return 100;
      if (combined.includes("40")) return 40;

      return "";
    };

    /* ============================================
      🔍 RANGE DETECTION (NEW)
    ============================================ */
    const detectRange = (b) => {
      const combined = `${b.title} ${b.description} ${b.comment}`;

      // matches: [Range 0-100], [range 1 - 10], etc.
      const match = combined.match(/\[\s*range\s*(\d+)\s*-\s*(\d+)\s*\]/i);

      if (match) {
        return {
          min: match[1],
          max: match[2],
          verify: `range(${match[1]},${match[2]})`
        };
      }

      return null;
    };


    /* ============================================
      CONVERT BLOCKS → QUESTIONS[]
    ============================================ */

    // 🔥 move OUTSIDE map (important)
    const cleanTitle = (t) =>
      (t || "").replace(/\[\s*range\s*\d+\s*-\s*\d+\s*\]/i, "").trim();

    const converted = blocks.map((b, i) => {
      const isAutosum = b.type === "autosum";

      // 🔥 detect range
      const rangeDetected = detectRange(b);

      // 🔥 identify numeric types
      const isNumeric =
        ["number_single", "number_multi", "float_multi"].includes(b.type);

      return {
        id: b.id || `q${i + 1}`,

        title: cleanTitle(b.title),
        type: b.type || "radio",
        description: b.description || "",
        comment: b.comment || "",

        optionsText: b.optionsText || "",

        rowsText:
          b.rowsText ||
          (
            ["text_multi","textarea_multi","number_multi","float_multi","autosum"].includes(b.type)
              ? b.optionsText
              : ""
          ),

        columnsText: b.columnsText || "",

        // 🔥 RANGE ONLY FOR NUMERIC
        rangeMin: isNumeric ? (rangeDetected?.min || "") : "",
        rangeMax: isNumeric ? (rangeDetected?.max || "") : "",

        autosumRows:
          isAutosum
            ? (b.rowsText || b.optionsText || "")
                .split("\n")
                .filter(Boolean)
                .map((text, idx) => {
                  const parts = text.split("|");

                  const descFromPipe = parts[1]?.trim();

                  const descFromFlags =
                    b.optionFlags?.[idx]?.description ||
                    b.rowFlags?.[idx]?.description ||
                    "";

                  return {
                    title: cleanRow(parts[0]),
                    desc: descFromPipe || descFromFlags
                  };
                })
            : [{ title: "", desc: "" }],

        parsedRows: isAutosum
          ? (b.rowsText || b.optionsText || "")
              .split("\n")
              .filter(Boolean)
              .map((line, idx) => {
                const match = line.match(/^\s*(\d+)[\.\)]\s*(.*)$/);

                let value, text;

                if (match) {
                  value = Number(match[1]);
                  text = match[2];
                } else {
                  value = idx + 1;
                  text = line;
                }

                const flags =
                  b.optionFlags?.[idx] ||
                  b.rowFlags?.[idx] ||
                  {};

                return enforceOptionRules({
                  label: `r${value}`,
                  value,
                  text: text
                    .replace(/\[PIPE:/gi, "[pipe:")
                    .trim(),

                  anchor: flags.anchor,
                  exclusive: flags.exclusive,
                  terminate: flags.terminate,
                  other: flags.other,
                });
              })
          : [],

        parsedOptions: parseWithValues(b.optionsText),
        parsedColumns: [],

        randomize: {
          rows: b.randomize?.rows || false,
          columns: b.randomize?.columns || false,
          all: b.randomize?.all || false,
        },

        exclusive: false,

        routing: {
          cond: b.logic || null,
          goto: b.target || null,
          term: b.terminate || null,
          default: b.defaultTarget || null
        },

        // 🔥 LOOP
        loop: b.loop || null,
        config: {
          ...form.config,

          amount: isAutosum ? detectAmount(b) : form.config.amount,

          verify: isNumeric
            ? (
                (!form.config.verify || form.config.verify.startsWith("range("))
                  ? (rangeDetected?.verify || "")
                  : form.config.verify
              )
            : "",
        },

        _smartParsed: b
      };
    });


    /* ============================================
      SET STATE
    ============================================ */
    setQuestions(converted);
    setActiveIndex(0);

    setForm((prev) => ({
      ...prev,
      ...converted[0],
      smartPasteText: text
    }));

    setParsed([]);
    setXml("");
  }; 

  function cleanLogicForBackend(logic) {
    if (!logic) return null;

    return logic
      .replace(/\bQ(\d+)\b/gi, (_, n) => `q${n}`)
      .replace(/\bHV_/gi, "hv_")
      .replace(/\s+/g, " ")

      // 🔥 FIX: safer removal (don't break logic)
      .replace(/^\s*(and|or)\s+(?=\()/i, "")

      .replace(/\(\s*\)/g, "")
      .trim();
  }
  // ============================================
  // GENERATE XML
  // ============================================
  const handleGenerate = async () => {
    try {
      if (!questions.length) {
        alert("No questions available");
        return;
      }

      setLoading(true);

      const updated = parsed.map((q) => {
        const original = questions.find(qn => qn.id === q.id) || {};
        const cfg = original.config || {};

        /* ================= NORMALIZE TEXT ================= */
        const normalizePipe = (txt) =>
          (txt || "")
            .replace(/\[pipe:\s*(.*?)\]/gi, (_, v) => `[pipe: ${v.trim()}]`)
            .trim();

        /* ================= OPTIONS ================= */
        let options = Array.isArray(q.options) ? q.options : [];

        if (["radio", "checkbox", "ranking"].includes(q.type)) {
          let opts =
            original.parsedOptions?.length > 0
              ? original.parsedOptions
              : (q.options || []);

          const processed = processOptions([...opts], cfg);

          options = processed
            .filter(o => o && typeof o === "object")
            .map(o => ({
              ...o,
              text: cleanText(normalizePipe(o?.text || "")),
            }));
        }

        /* ================= ROWS ================= */
        let rows = Array.isArray(q.rows) ? q.rows : [];

        if (["card_radio", "card_checkbox"].includes(q.type)) {
          rows =
            original.parsedRows?.length > 0
              ? original.parsedRows
              : (q.rows?.length ? q.rows : q.options || []);
          options = [];
        }

        if (q.type === "autosum") {
          rows =
            original.parsedRows?.length > 0
              ? original.parsedRows.map((r) => ({
                  label: `r${r.value}`,
                  value: r.value,
                  text: cleanText(normalizePipe(r?.text || "")),
                  anchor: r.anchor,
                  exclusive: r.exclusive,
                  terminate: r.terminate,
                  other: r.other,
                }))
              : [];
        } 
        else if (["radio", "checkbox", "ranking"].includes(q.type)) {
          rows =
            original.parsedOptions?.length > 0
              ? original.parsedOptions.map(r => ({
                  ...r,
                  text: cleanText(normalizePipe(r?.text || "")),
                }))
              : (q.rows || []);
        } 
        else {
          rows =
            original.parsedRows?.length > 0
              ? original.parsedRows.map(r => ({
                  ...r,
                  text: cleanText(normalizePipe(r?.text || "")),
                }))
              : (q.rows || []);
        }

        /* ================= COLUMNS ================= */
        const columns =
          Array.isArray(original.parsedColumns) && original.parsedColumns.length > 0
            ? original.parsedColumns.map(c => ({
                ...c,
                text: cleanText(normalizePipe(c?.text || "")),
              }))
            : Array.isArray(q.columns)
              ? q.columns.map(c => ({
                  ...c,
                  text: cleanText(normalizePipe(c?.text || "")),
                }))
              : [];

        /* ================= CONFIG ================= */
        const config = {
          ...q.config,
          optional: cfg.optional,
          atleast: cfg.atleast,
          atmost: cfg.atmost,
          exact: cfg.exact,
          unique: cfg.unique,
          verify: cfg.verify || q.config?.verify || "",

          amount:
            q.type === "autosum"
              ? (cfg.amount || q.config?.amount)
              : cfg.amount,
          tolerance: cfg.tolerance,
          enforceTotal: cfg.enforceTotal,
          autoFillRemainder: cfg.autoFillRemainder,
          showTotal: cfg.showTotal,

          rowLegend: cfg.rowLegend,
          preText: cfg.preText,
          placeholder: cfg.placeholder,
          alignment: cfg.alignment,
          inputSize: cfg.inputSize,

          autoAdvance: cfg.autoAdvance,
          disableInsteadOfHide: cfg.disableInsteadOfHide,

          randomizeSubset: cfg.randomizeSubset,
          keepFirstFixed: cfg.keepFirstFixed,
          keepLastFixed: cfg.keepLastFixed,

          includeOther: cfg.includeOther,
          includeNone: cfg.includeNone,
          includeDK: cfg.includeDK,
          includePNA: cfg.includePNA,

          errorMessage: cfg.errorMessage,
          variableName: cfg.variableName,
          exportLabel: cfg.exportLabel,
        };

        /* ================= FINAL OBJECT ================= */
        return {
          ...q,

          title: normalizePipe(original.title || q.title),
          description: normalizePipe(original.description || q.description),
          comment: normalizePipe(original.comment || q.comment),

          options,
          rows,
          columns,
          config,

          /* ================= 🔥 INSERT (ADDED) ================= */
          insert: original.insert || q.insert || null,

          /* ================= 🔥 ROUTING ================= */
          routing: {
            cond:
              original.routing?.cond ||
              q.routing?.cond ||
              (original.logic ? cleanLogicForBackend(original.logic) : null),
            goto: original.target || q.target || null,
            term: original.terminate
              ? (typeof original.terminate === "string"
                  ? original.terminate
                  : "Screened out")
              : null,
            default: original.defaultTarget || q.defaultTarget || null
          },

          /* ================= LOOP ================= */
          loop: original.loop
            ? {
                source: (original.loop.source || "").toLowerCase().trim(),
                mode: (original.loop.mode || "selected").toLowerCase(),
              }
            : q.loop,
        };
      });

      /* ================= CALL API ================= */
      const res = await generateXML(updated);

      if (res?.xml) {
        setXml(res.xml);
      } else {
        alert("Failed to generate XML");
      }

    } catch (err) {
      console.error(err);
      alert("Error generating XML");
    } finally {
      setLoading(false);
    }
  };
  const t = form.type;

  // ============================================
  // UI
  // ============================================
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Welcome: {user}</span>
        <button onClick={() => {
          logout();
          setUser(null);
        }}>
          Logout
        </button>
      </div>

        {/* MAIN GRID */}
        <div style={styles.main}>
          {/* LEFT PANEL */}
          {/* =====================================================
            🧠 LEFT PANEL (FULLY RESTRUCTURED WITH TABS)
          ===================================================== */}

          <div style={styles.leftPanel}>

            {/* =========================
                🔥 TAB BAR
            ========================= */}
            <div style={styles.tabBar}>
              {[
                { key: "smart", label: "Smart Paste" },
                { key: "setup", label: " Question Setup" },
                { key: "answers", label: "Option Edit" },
                { key: "logic", label: "Routing & Logic" },
                { key: "advanced", label: "Advanced Options" },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActivePanel(tab.key)}
                  style={{
                    ...styles.tabBtn,
                    ...(activePanel === tab.key ? styles.tabBtnActive : {})
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* =========================
                🚀 MULTI QUESTION CONTROLS
            ========================= */}
            <div style={styles.multiWrap}>

              <button
                style={styles.addQBtn}
                onClick={addQuestion}
              >
                + Add Question
              </button>

              <div style={styles.qTabs}>
                {questions.map((q, i) => (
                  <div
                    key={i}
                    style={{
                      ...styles.qTab,
                      ...(i === activeIndex ? styles.qTabActive : {})
                    }}
                    onClick={() => {
                      if (i === activeIndex) return;
                      setActiveIndex(i);
                      setActivePreviewLabel(questions[i]?.id);
                    }}
                  >
                    <span>{q.id || `Q${i + 1}`}</span>

                    <div style={styles.qTabActions}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateQuestion(i);
                        }}
                      >
                        ⧉
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteQuestion(i);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* =====================================================
              ⚡ SMART TAB
            ===================================================== */}
            {activePanel === "smart" && (
              <div style={styles.card}>
                <SectionHeader
                  title="Smart Paste"
                  subtitle="Paste questionnaire block and auto-fill"
                />

                <textarea
                  placeholder={`Paste here...

          Question Type: Single Select / Radio
          Label #@ Q1 Comp Size
          Title #@ How many employees work at your company?
          Options:
          1. Option A
          2. Option B`}
                  value={form.smartPasteText || ""}
                  onChange={(e) =>
                    handleChange("smartPasteText", e.target.value)
                  }
                  style={{
                    ...styles.optionTextarea,
                    minHeight: "180px",
                    border: "2px dashed #c7d2fe",
                    background: "#f8fafc"
                  }}
                />

                <button
                  style={styles.smartPasteBtn}
                  onClick={() => handleSmartPaste(form.smartPasteText)}
                >
                  ⚡ Smart Paste
                </button>
              </div>
            )}

            {/* =====================================================
              🧩 SETUP TAB
            ===================================================== */}
            {activePanel === "setup" && (
              <div style={styles.cardPrimary}>
                <SectionHeader
                  title="Question Setup"
                  subtitle="Define core question structure"
                />

                <div style={styles.grid2}>
                  <Input
                    label="Question ID"
                    value={form.id}
                    onChange={(v) => handleChange("id", v)}
                    placeholder="e.g. q1_brand_awareness"
                  />

                  <Select
                    label="Question Type"
                    value={form.type}
                    onChange={(v) => handleChange("type", v)}
                    options={[
                      { label: "Intro / HTML", value: "html" },
                      { label: "Radio (Single Select)", value: "radio" },
                      { label: "Checkbox (Multi Select)", value: "checkbox" },
                      { label: "Grid - Radio", value: "radio_grid" },
                      { label: "Grid - Checkbox", value: "checkbox_grid" },
                      { label: "Card - Radio", value: "card_radio" },
                      { label: "Card - Checkbox", value: "card_checkbox" },
                      { label: "Number - Single", value: "number_single" },
                      { label: "Number - Multiple", value: "number_multi" },
                      { label: "Decimal - Multiple", value: "float_multi" },
                      { label: "Text - Single", value: "text_single" },
                      { label: "Text - Multiple", value: "text_multi" },
                      { label: "Textarea - Single", value: "textarea_single" },
                      { label: "Textarea - Multiple", value: "textarea_multi" },
                      { label: "Ranking", value: "ranking" },
                      { label: "Autosum", value: "autosum" },
                    ]}
                  />
                </div>

                <RichTextEditor
                  label="Question Title"
                  value={form.title}
                  onChange={(v) => handleChange("title", v)}
                  placeholder="Format using toolbar"
                />

                <RichTextEditor
                  label="Description"
                  value={form.description}
                  onChange={(v) => handleChange("description", v)}
                  placeholder="Add formatting like bold, italic etc."
                />

                <Textarea
                  label="Internal Comment (XML)"
                  value={form.comment}
                  onChange={(v) => handleChange("comment", v)}
                  placeholder="Internal notes, logic hints, client instructions"
                />
              </div>
            )}

            {/* =====================================================
              🧾 ANSWERS TAB
            ===================================================== */}
            {activePanel === "answers" && (
              <>
                {/* =========================
                    🧾 ANSWER INPUT
                ========================= */}
                <div style={styles.card}>
                  <SectionHeader
                    title="Answer Input"
                    subtitle="Define answer structure"
                  />

                  {/* ================= HTML ================= */}
                  {t === "html" && (
                    <InfoBox text="Intro / informational block (no answers required)" />
                  )}

                  {/* ================= RADIO / CHECKBOX ================= */}
                  {["radio", "checkbox"].includes(t) && (
                    <Textarea
                      label="Options"
                      value={form.optionsText}
                      onChange={(v) =>
                        handleChange("optionsText", v)
                      }
                      placeholder={`1. Option A
            2. Option B
            3. Option C`}
                    />
                  )}

                  {/* ================= GRID + CARD ================= */}
                  {[
                    "radio_grid",
                    "checkbox_grid",
                    "card_radio",
                    "card_checkbox",
                  ].includes(t) && (
                    <>
                      <Textarea
                        label="Columns"
                        value={form.columnsText}
                        onChange={(v) =>
                          handleChange("columnsText", v)
                        }
                        placeholder={`1. Strongly Agree
            2. Agree
            3. Neutral`}
                      />

                      <Textarea
                        label="Rows"
                        value={form.rowsText}
                        onChange={(v) =>
                          handleChange("rowsText", v)
                        }
                        placeholder={`1. Brand Trust
            2. Product Quality`}
                      />
                    </>
                  )}

                  {/* ================= NUMBER SINGLE ================= */}
                  {t === "number_single" && (
                    <>
                      <Input
                        label="Value"
                        value={form.optionsText}
                        onChange={(v) =>
                          handleChange("optionsText", v)
                        }
                        placeholder="Enter number"
                      />

                      <div style={styles.grid2}>
                        <Input
                          label="Min"
                          value={form.rangeMin}
                          onChange={(v) =>
                            handleChange("rangeMin", v)
                          }
                        />

                        <Input
                          label="Max"
                          value={form.rangeMax}
                          onChange={(v) =>
                            handleChange("rangeMax", v)
                          }
                        />
                      </div>
                    </>
                  )}

                  {/* ================= NUMBER MULTI ================= */}
                  {["number_multi", "float_multi"].includes(t) && (
                    <>
                      <Textarea
                        label="Rows"
                        value={form.rowsText}
                        onChange={(v) =>
                          handleChange("rowsText", v)
                        }
                        placeholder={`1. Category A
            2. Category B`}
                      />

                      <div style={styles.grid2}>
                        <Input
                          label="Min"
                          value={form.rangeMin}
                          onChange={(v) =>
                            handleChange("rangeMin", v)
                          }
                        />

                        <Input
                          label="Max"
                          value={form.rangeMax}
                          onChange={(v) =>
                            handleChange("rangeMax", v)
                          }
                        />
                      </div>
                    </>
                  )}

                  {/* ================= TEXT ================= */}
                  {t === "text_single" && (
                    <InfoBox text="User will enter a single-line response." />
                  )}

                  {t === "text_multi" && (
                    <Textarea
                      label="Fields"
                      value={form.rowsText}
                      onChange={(v) =>
                        handleChange("rowsText", v)
                      }
                      placeholder={`1. Field 1
            2. Field 2`}
                    />
                  )}

                  {t === "textarea_single" && (
                    <InfoBox text="User will enter a long-form response." />
                  )}

                  {t === "textarea_multi" && (
                    <Textarea
                      label="Fields"
                      value={form.rowsText}
                      onChange={(v) =>
                        handleChange("rowsText", v)
                      }
                      placeholder={`1. Field 1
            2. Field 2`}
                    />
                  )}

                  {/* ================= RANKING ================= */}
                  {t === "ranking" && (
                    <Textarea
                      label="Ranking Options"
                      value={form.optionsText}
                      onChange={(v) => handleChange("optionsText", v)}
                      placeholder={`1. Feature 1
            2. Feature 2
            3. Feature 3`}
                    />
                  )}

                  {/* ================= AUTOSUM ================= */}
                  {t === "autosum" && (
                    <div>
                      <div style={styles.autoHeader}>
                        <span>Autosum Rows</span>
                        <button
                          style={styles.addBtn}
                          onClick={addAutosumRow}
                        >
                          + Add Row
                        </button>
                      </div>

                      {form.autosumRows.map((row, i) => (
                        <div key={i} style={styles.autoCard}>
                          <div style={styles.autoIndex}>
                            {i + 1}
                          </div>

                          <div style={{ flex: 1 }}>
                            <Input
                              value={row.title}
                              onChange={(v) =>
                                handleAutosumChange(i, "title", v)
                              }
                              placeholder="Row Title"
                            />

                            <Input
                              value={row.desc}
                              onChange={(v) =>
                                handleAutosumChange(i, "desc", v)
                              }
                              placeholder="Description (optional)"
                            />
                          </div>

                          <button
                            style={styles.deleteBtn}
                            onClick={() => removeAutosumRow(i)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* =====================================================
                  🔧 OPTION EDITOR (NOW INSIDE ANSWERS TAB)
                ===================================================== */}
                {(
                  ["radio","checkbox","ranking"].includes(form.type)
                    ? form.parsedOptions?.length > 0
                    : form.parsedRows?.length > 0
                ) && (
                  <div style={styles.card}>
                    <SectionHeader
                      title="Option Editor"
                      subtitle="Fine-tune labels, values & logic"
                    />

                    {(
                      ["radio","checkbox","ranking"].includes(form.type)
                        ? form.parsedOptions
                        : form.parsedRows
                    ).map((opt, i) => {

                      const isOptionType =
                        ["radio","checkbox","ranking"].includes(form.type);

                      const optText = (opt.text || "").trim();
                      const isLocked = [97, 98, 99].includes(opt.value);

                      const updateField = (field, value) => {
                        const updated = isOptionType
                          ? [...form.parsedOptions]
                          : [...form.parsedRows];

                        updated[i] = enforceOptionRules({
                          ...updated[i],
                          [field]: field === "value" ? Number(value) : value
                        });
                        if (field === "value" || field === "text") {
                          updated[i] = enforceOptionRules(updated[i]);
                        }

                        handleChange(
                          isOptionType ? "parsedOptions" : "parsedRows",
                          updated
                        );
                      };

                      return (
                        <div
                          key={i}
                          style={{
                            ...styles.optionRow,
                            background: isLocked ? "#fef3c7" : "#f9fafb"
                          }}
                        >

                          {/* VALUE */}
                          <input
                            type="number"
                            value={opt.value}
                            onChange={(e) =>
                              updateField("value", Number(e.target.value))
                            }
                            style={styles.smallInput}
                          />

                          {/* TEXT */}
                          <div style={{ flex: 1 }}>
                            <RichTextEditor
                              label={`opt-${i}`}
                              value={opt.text}
                              onChange={(v) => updateField("text", v)}
                            />
                          </div>

                          {/* FLAGS */}
                          <div style={styles.optionRightInline}>

                            <CheckInline
                              label="Anchor"
                              checked={opt.anchor || false}
                              onChange={(v) => updateField("anchor", v)}
                            />

                            <CheckInline
                              label="Exclusive"
                              checked={opt.exclusive || false}
                              onChange={(v) => updateField("exclusive", v)}
                            />

                            <CheckInline
                              label="Other"
                              checked={opt.other || false}
                              onChange={(v) => updateField("other", v)}
                            />

                            <CheckInline
                              label="Terminate"
                              checked={opt.terminate || false}
                              onChange={(v) => updateField("terminate", v)}
                            />

                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {/* =====================================================
              🧠 LOGIC TAB (CLEAN BASE FOR FUTURE)
            ===================================================== */}
            {activePanel === "logic" && (
              <div style={styles.card}>
                <SectionHeader
                  title="Logic"
                  subtitle="Display, skip & piping logic"
                />

                <div style={styles.info}>
                  Logic builder coming soon.
                  <br />
                  This will support:
                  <ul style={{ marginTop: 6 }}>
                    <li>Show/Hide conditions</li>
                    <li>Skip logic</li>
                    <li>Answer piping</li>
                  </ul>
                </div>
              </div>
            )}

            {/* =====================================================
              ⚙️ ADVANCED TAB
            ===================================================== */}
            {activePanel === "advanced" && (
              <>
                {/* =========================
                    ⚙️ ADVANCED SETTINGS
                ========================= */}
                <div style={styles.card}>
                  <SectionHeader
                    title="Advanced Settings"
                    subtitle="Control behavior & validation"
                  />

                  {/* RANDOMIZE */}
                  <div style={styles.settingGroup}>
                    <label style={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={form.randomize.all}
                        onChange={(e) =>
                          handleChange("randomize", {
                            rows: e.target.checked,
                            columns: e.target.checked,
                            all: e.target.checked,
                          })
                        }
                      />
                      Randomize All
                    </label>

                    <div style={styles.inlineChecks}>
                      <Check
                        label="Rows"
                        checked={form.randomize.rows}
                        onChange={(v) =>
                          handleChange("randomize", {
                            ...form.randomize,
                            rows: v,
                            all: false,
                          })
                        }
                      />
                      <Check
                        label="Columns"
                        checked={form.randomize.columns}
                        onChange={(v) =>
                          handleChange("randomize", {
                            ...form.randomize,
                            columns: v,
                            all: false,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* EXCLUSIVE */}
                  <Check
                    label="Exclusive Option (None of the above)"
                    checked={form.exclusive}
                    onChange={(v) => handleChange("exclusive", v)}
                  />
                </div>

                {/* =========================
                    🧠 QUESTION CONFIG
                ========================= */}
                <div style={styles.card}>
                  <SectionHeader
                    title="Question Config"
                    subtitle="Advanced validation, behavior & display controls"
                  />

                  {/* BASIC */}
                  <SectionMini title="Basic" />

                  <Check
                    label="Optional Question"
                    checked={form.config.optional}
                    onChange={(v) =>
                      handleChange("config", { ...form.config, optional: v })
                    }
                  />

                  {/* VALIDATION */}
                  <SectionMini title="Validation" />

                  <div style={styles.grid2}>
                    <Input
                      label="Minimum Required"
                      value={form.config.atleast}
                      onChange={(v) =>
                        handleChange("config", { ...form.config, atleast: v })
                      }
                    />

                    <Input
                      label="Maximum Allowed"
                      value={form.config.atmost}
                      onChange={(v) =>
                        handleChange("config", { ...form.config, atmost: v })
                      }
                    />
                  </div>

                  <div style={styles.grid2}>
                    <Input
                      label="Exact Selection"
                      value={form.config.exact}
                      onChange={(v) =>
                        handleChange("config", { ...form.config, exact: v })
                      }
                    />

                    <Input
                      label="Unique Constraint"
                      value={form.config.unique}
                      onChange={(v) =>
                        handleChange("config", { ...form.config, unique: v })
                      }
                    />
                  </div>

                  <Input
                    label="Verify Rule"
                    value={form.config.verify}
                    onChange={(v) =>
                      handleChange("config", { ...form.config, verify: v })
                    }
                    placeholder="range(0,100)"
                  />

                  {/* AUTOSUM */}
                  {t === "autosum" && (
                    <>
                      <SectionMini title="Autosum Advanced" />

                      <div style={styles.grid2}>
                        <Input
                          label="Total Amount"
                          value={form.config.amount}
                          onChange={(v) =>
                            handleChange("config", { ...form.config, amount: v })
                          }
                        />

                        <Input
                          label="Tolerance (±)"
                          value={form.config.tolerance}
                          onChange={(v) =>
                            handleChange("config", { ...form.config, tolerance: v })
                          }
                        />
                      </div>

                      <Check
                        label="Strict Total Enforcement"
                        checked={form.config.enforceTotal}
                        onChange={(v) =>
                          handleChange("config", { ...form.config, enforceTotal: v })
                        }
                      />

                      <Check
                        label="Auto-fill Remaining"
                        checked={form.config.autoFillRemainder}
                        onChange={(v) =>
                          handleChange("config", { ...form.config, autoFillRemainder: v })
                        }
                      />

                      <Check
                        label="Show Running Total"
                        checked={form.config.showTotal}
                        onChange={(v) =>
                          handleChange("config", { ...form.config, showTotal: v })
                        }
                      />
                    </>
                  )}

                  {/* DISPLAY */}
                  <SectionMini title="Display" />

                  <div style={styles.grid2}>
                    <Input
                      label="Row Legend"
                      value={form.config.rowLegend}
                      onChange={(v) =>
                        handleChange("config", { ...form.config, rowLegend: v })
                      }
                    />

                    <Input
                      label="Prefix (₹ / $)"
                      value={form.config.preText}
                      onChange={(v) =>
                        handleChange("config", { ...form.config, preText: v })
                      }
                    />
                  </div>

                  <div style={styles.grid2}>
                    <Select
                      label="Alignment"
                      value={form.config.alignment}
                      onChange={(v) =>
                        handleChange("config", { ...form.config, alignment: v })
                      }
                      options={[
                        { label: "Right", value: "right" },
                        { label: "Left", value: "left" },
                        { label: "Inline", value: "inline" },
                      ]}
                    />

                    <Select
                      label="Input Size"
                      value={form.config.inputSize}
                      onChange={(v) =>
                        handleChange("config", { ...form.config, inputSize: v })
                      }
                      options={[
                        { label: "Small", value: "small" },
                        { label: "Medium", value: "medium" },
                        { label: "Large", value: "large" },
                      ]}
                    />
                  </div>

                  <Input
                    label="Placeholder"
                    value={form.config.placeholder}
                    onChange={(v) =>
                      handleChange("config", { ...form.config, placeholder: v })
                    }
                  />

                  {/* BEHAVIOR */}
                  <SectionMini title="Behavior" />

                  <Check
                    label="Auto Advance"
                    checked={form.config.autoAdvance}
                    onChange={(v) =>
                      handleChange("config", { ...form.config, autoAdvance: v })
                    }
                  />

                  <Check
                    label="Disable Instead of Hide"
                    checked={form.config.disableInsteadOfHide}
                    onChange={(v) =>
                      handleChange("config", { ...form.config, disableInsteadOfHide: v })
                    }
                  />

                  {/* RANDOMIZATION */}
                  <SectionMini title="Randomization Advanced" />

                  <Input
                    label="Random Subset (N)"
                    value={form.config.randomizeSubset}
                    onChange={(v) =>
                      handleChange("config", { ...form.config, randomizeSubset: v })
                    }
                  />

                  <Check
                    label="Keep First Fixed"
                    checked={form.config.keepFirstFixed}
                    onChange={(v) =>
                      handleChange("config", { ...form.config, keepFirstFixed: v })
                    }
                  />

                  <Check
                    label="Keep Last Fixed"
                    checked={form.config.keepLastFixed}
                    onChange={(v) =>
                      handleChange("config", { ...form.config, keepLastFixed: v })
                    }
                  />

                  {/* SPECIAL OPTIONS */}
                  <SectionMini title="Special Options" />

                  <Check
                    label="Include Other"
                    checked={form.config.includeOther}
                    onChange={(v) =>
                      handleChange("config", { ...form.config, includeOther: v })
                    }
                  />

                  <Check
                    label="Include None of the Above"
                    checked={form.config.includeNone}
                    onChange={(v) =>
                      handleChange("config", { ...form.config, includeNone: v })
                    }
                  />

                  <Check
                    label="Include Don't Know"
                    checked={form.config.includeDK}
                    onChange={(v) =>
                      handleChange("config", { ...form.config, includeDK: v })
                    }
                  />

                  <Check
                    label="Include Prefer Not to Answer"
                    checked={form.config.includePNA}
                    onChange={(v) =>
                      handleChange("config", { ...form.config, includePNA: v })
                    }
                  />

                  {/* DATA OUTPUT */}
                  <SectionMini title="Data Output" />

                  <div style={styles.grid2}>
                    <Input
                      label="Variable Name"
                      value={form.config.variableName}
                      onChange={(v) =>
                        handleChange("config", { ...form.config, variableName: v })
                      }
                    />

                    <Input
                      label="Export Label"
                      value={form.config.exportLabel}
                      onChange={(v) =>
                        handleChange("config", { ...form.config, exportLabel: v })
                      }
                    />
                  </div>

                  <Input
                    label="Custom Error Message"
                    value={form.config.errorMessage}
                    onChange={(v) =>
                      handleChange("config", { ...form.config, errorMessage: v })
                    }
                  />
                </div>

                {/* =========================
                    📊 COLUMN EDITOR
                ========================= */}
                {form.parsedColumns?.length > 0 && (
                  <div style={styles.card}>
                    <SectionHeader
                      title="Column Editor"
                      subtitle="Adjust grid column behavior"
                    />

                    {form.parsedColumns.map((col, i) => (
                      <div key={i} style={styles.optionRow}>
                        <div style={styles.optionIndex}>
                          {col.label}
                        </div>

                        <RichTextEditor
                          label={`col-${i}`}
                          value={col.text}
                          onChange={(v) => {
                            const updated = [...form.parsedColumns];
                            updated[i].text = v;
                            handleChange("parsedColumns", updated);
                          }}
                        />

                        <CheckInline
                          label="Exclusive"
                          checked={col.exclusive || false}
                          onChange={(v) => {
                            const updated = [...form.parsedColumns];
                            updated[i].exclusive = [97, 99].includes(col.value) ? v : false;
                            handleChange("parsedColumns", updated);
                          }}
                        />

                        <CheckInline
                          label="Anchor"
                          checked={col.anchor || false}
                          onChange={(v) => {
                            const updated = [...form.parsedColumns];
                            updated[i].anchor = v;
                            handleChange("parsedColumns", updated);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>  
          {/* =========================
              👉 RIGHT PANEL
          ========================= */}
          <div style={styles.rightPanel}>

            {/* =========================
                🎯 ACTION BAR (STICKY)
            ========================= */}
            <div style={styles.actionBar}>
              <button
                onClick={handlePreview}
                style={styles.previewBtn}
              >
                🔍 Preview All
              </button>

              <GenerateButton
                onClick={handleGenerate}
                loading={loading}
                disabled={!parsed.length}
              />
            </div>

            {/* =========================
                👁️ LIVE PREVIEW (MULTI)
            ========================= */}
            <div style={styles.previewCard}>
              <SectionHeader
                title="Live Preview"
                subtitle="Full survey rendering"
              />

              {parsed.length > 0 ? (() => {

                const enrichedQuestions = parsed.map((q) => {
                  const original = questions.find(qn => qn.id === q.id) || {};

                  const normalizePipe = (txt) =>
                    (txt || "").replace(/\[pipe:\s*(.*?)\]/gi, (_, v) => {
                      return `[pipe: ${v.trim()}]`;
                    });

                  return {
                    ...q,

                    // ✅ CRITICAL FIX
                    label: q.label || q.id,

                    title: normalizePipe(q.title),
                    description: normalizePipe(q.description),
                    insert: original.insert || q.insert || null,

                    /* ================= OPTIONS ================= */
                    options:
                      ["radio","checkbox","ranking"].includes(q.type)
                        ? processOptions(
                            original.parsedOptions?.length > 0
                              ? original.parsedOptions
                              : q.options,
                            original.config || {}
                          )
                        : q.options,

                    /* ================= ROWS ================= */
                    rows:
                      q.type === "autosum"
                        ? (original.parsedRows?.length > 0 ? original.parsedRows : [])
                        : q.type === "ranking"
                          ? (original.parsedOptions?.length > 0 ? original.parsedOptions : q.rows)
                          : ["radio","checkbox"].includes(q.type)
                            ? (original.parsedOptions?.length > 0 ? original.parsedOptions : q.rows)
                            : (original.parsedRows?.length > 0 ? original.parsedRows : q.rows),

                    /* ================= COLUMNS ================= */
                    columns:
                      original.parsedColumns?.length > 0
                        ? original.parsedColumns
                        : (q.columns || []),
                  };
                });

                return (
                  <SurveyPreview
                    questions={enrichedQuestions}
                    activeQuestionLabel={activePreviewLabel}
                  />
                );

              })() : (
                <EmptyState text="Click Preview to render full survey" />
              )}
            </div>

            {/* =========================
                🧾 XML OUTPUT (🔥 NEW FIX)
            ========================= */}
            {xml && (
              <div style={styles.xmlCard}>
                <SectionHeader
                  title="Generated XML"
                  subtitle="Decipher-ready output"
                />

                <CopyBlock
                  title="XML Output"
                  code={xml}
                />
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================
 * 🧩 REUSABLE COMPONENTS
 * ============================================
 */

function SectionHeader({ title, subtitle }) {
  return (
    <div style={styles.sectionHeader}>
      <div>
        <h3 style={styles.sectionTitle}>{title}</h3>
        <p style={styles.sectionSub}>{subtitle}</p>
      </div>
    </div>
  );
}

function SectionMini({ title }) {
  return <h4 style={styles.sectionMini}>{title}</h4>;
}

function Input({ label, value, onChange, placeholder }) {
  return (
    <div style={styles.inputWrap}>
      {label && <label style={styles.label}>{label}</label>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={styles.input}
      />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={styles.inputWrap}>
      {label && <label style={styles.label}>{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.select}
      >
        {options.map((o, i) => (
          <option key={i} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder }) {
  return (
    <div style={styles.inputWrap}>
      {label && <label style={styles.label}>{label}</label>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={styles.optionTextarea}
      />
    </div>
  );
}

/**
 * ============================================
 * ✨ NEW: RICH TEXT EDITOR
 * ============================================
 */
function RichTextEditor({ label, value, onChange, placeholder }) {
  const applyTag = (tag) => {
    const textarea = document.getElementById(label);
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const selected = value.substring(start, end);

    let newText = "";

    if (tag === "br") {
      newText =
        value.substring(0, start) +
        "<br />" +
        value.substring(end);
    } else {
      newText =
        value.substring(0, start) +
        `<${tag}>${selected || "text"}</${tag}>` +
        value.substring(end);
    }

    onChange(newText);
  };

  return (
    <div style={styles.inputWrap}>
      {label && <label style={styles.label}>{label}</label>}

      <div style={styles.toolbar}>
        <button onClick={() => applyTag("strong")} style={styles.toolBtn}>B</button>
        <button onClick={() => applyTag("em")} style={styles.toolBtn}>I</button>
        <button onClick={() => applyTag("u")} style={styles.toolBtn}>U</button>
        <button onClick={() => applyTag("br")} style={styles.toolBtn}>↵</button>
      </div>

      <textarea
        id={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={styles.optionTextarea}
      />
    </div>
  );
}

function parseSmartPaste(text) {
  if (!text) return [];

  const blocks = text
    .split(/(?=Question\s*Type:)/gi)
    .map(b => b.trim())
    .filter(Boolean);

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

  const getValue = (line) => {
    return (
      line.split("#@")[1]?.trim() ||
      line.split(/-|–/)[1]?.trim() ||
      ""
    );
  };

  const extractFlags = (line) => ({
    anchor: /\[.*anchor.*\]/i.test(line),
    exclusive: /\[.*exclusive.*\]/i.test(line),
    terminate: /\[.*terminate.*\]/i.test(line),
  });

  for (let block of blocks) {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);

    let q = {
      id: "",
      type: "",
      title: "",
      description: "",
      comment: "",

      optionsText: "",
      rowsText: "",
      columnsText: "",

      randomize: { rows: false, columns: false, all: false },

      optionFlags: [],
      rowFlags: [],
      columnFlags: [],

      logic: null,
      target: null,
      terminate: null,
      defaultTarget: null,
      loop: null,
    };

    let mode = null;

    for (let line of lines) {
      const lower = line.toLowerCase();

      // ================= TYPE (STRICT) =================
      if (!q.type && lower.startsWith("question type")) {
        for (let [key, val] of typeMap) {
          if (lower.includes(key)) {
            q.type = val;
            break;
          }
        }
        continue;
      }

      // ================= LABEL =================
      if (/^label\s*#@/i.test(line)) {
        const val = getValue(line);
        q.id = val
          .toLowerCase()
          .replace(/\./g, "")
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");
        continue;
      }

      // ================= TITLE =================
      if (/^title\s*#@/i.test(line)) {
        q.title = getValue(line);
        continue;
      }

      // ================= DESCRIPTION =================
      if (/^description/i.test(line)) {
        q.description = getValue(line);
        continue;
      }

      // ================= COMMENT =================
      if (/^comment/i.test(line)) {
        q.comment = getValue(line);
        continue;
      }

      // ================= LOGIC =================
      if (/^logic/i.test(line)) {
        let raw = getValue(line);

        if (raw) {
          raw = raw
            .replace(/\s+/g, " ")
            .replace(/\bAND\b/gi, "AND")
            .replace(/\bOR\b/gi, "OR")
            .replace(/^\s*(AND|OR)\b/i, "")
            .replace(/\(\s*\)/g, "")
            .trim();

          q.logic = raw;
        }

        continue;
      }

      // ================= ROUTING =================
      if (/^goto/i.test(line)) {
        q.target = getValue(line);
        continue;
      }

      if (/^terminate/i.test(line)) {
        q.terminate = getValue(line);
        continue;
      }

      if (/^defaultgoto/i.test(line)) {
        q.defaultTarget = getValue(line);
        continue;
      }

      // ================= PIPE =================
      if (/^source/i.test(line)) {
        const val = getValue(line);
        q.title = `${q.title} [pipe: ${val}]`;
        continue;
      }

      // ================= LOOP =================
      if (/^loopsource/i.test(line)) {
        q.loop = q.loop || {};
        q.loop.source = getValue(line);
        continue;
      }

      if (/^loopover/i.test(line)) {
        q.loop = q.loop || {};
        q.loop.mode = getValue(line).trim();
        continue;
      }

      // ================= MODE =================
      if (/^options\s*:?/i.test(line)) {
        mode = "options";
        if (/\[randomize\]/i.test(line)) q.randomize.all = true;
        continue;
      }

      if (/^rows\s*:?/i.test(line)) {
        mode = "rows";
        if (/\[randomize\]/i.test(line)) q.randomize.rows = true;
        continue;
      }

      if (/^columns\s*:?/i.test(line)) {
        mode = "columns";
        if (/\[randomize\]/i.test(line)) q.randomize.columns = true;
        continue;
      }

      // ================= DATA =================
      const flags = extractFlags(line);

      let clean = line
        .replace(/\[anchor\]/gi, "")
        .replace(/\[exclusive\]/gi, "")
        .replace(/\[terminate\]/gi, "")
        .trim();

      if (!clean) continue;

      let normalized = clean
        .replace(/^(\d+)[\.\)\-:]\s*/, "$1. ")
        .replace(/^[-•]\s*/, "")
        .trim();

      if (mode === "options") {
        q.optionsText += normalized + "\n";
        q.optionFlags.push(flags);
      }

      else if (mode === "rows") {
        q.rowsText += normalized + "\n";
        q.rowFlags.push(flags);
      }

      else if (mode === "columns") {
        q.columnsText += normalized + "\n";
        q.columnFlags.push(flags);
      }
    }

    // ================= FINAL FIX =================

    // ❌ REMOVE BAD TITLE FALLBACK
    if (!q.title) continue;

    // DEFAULT TYPE
    if (!q.type) q.type = "radio";

    // DEFAULT ID
    if (!q.id) q.id = `q${questions.length + 1}`;

    q.optionsText = (q.optionsText || "").trim();
    q.rowsText = (q.rowsText || "").trim();
    q.columnsText = (q.columnsText || "").trim();

    questions.push(q);
  }

  return questions;
}

function Check({ label, checked, onChange }) {
  return (
    <label style={styles.checkbox}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function CheckInline({ label, checked, onChange }) {
  return (
    <label style={styles.checkInline}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function InfoBox({ text }) {
  return <div style={styles.info}>{text}</div>;
}

function EmptyState({ text }) {
  return <div style={styles.empty}>{text}</div>;
}

function AutosumQuestion({ question }) {
  const [values, setValues] = useState({});
  const [locked, setLocked] = useState(false);

  const rows = question.rows || [];

  const noAnswerRow = rows.find(r => r.value >= 97);
  const normalRows = rows.filter(r => r.value < 97);

  const total = Object.values(values)
    .filter(v => !isNaN(v))
    .reduce((a, b) => a + b, 0);

  const target = question.config?.amount || 100;
  const tolerance = question.config?.tolerance || 0;

  const isValid =
    total >= target - tolerance &&
    total <= target + tolerance;

  const handleChange = (val, rowVal) => {
    if (locked) return;

    setValues(prev => ({
      ...prev,
      [rowVal]: Number(val) || 0
    }));
  };

  const handleNoAnswer = () => {
    setLocked(true);
    setValues({});
  };

  const autoFill = () => {
    const filled = Object.keys(values).length;
    const remaining = target - total;

    if (filled === normalRows.length - 1) {
      const emptyRow = normalRows.find(r => !values[r.value]);

      if (emptyRow) {
        setValues(prev => ({
          ...prev,
          [emptyRow.value]: remaining
        }));
      }
    }
  };

  return (
    <div style={styles.autoWrapper}>

      {/* ROWS */}
      {normalRows.map(r => (
        <div key={r.value} style={styles.autoRow}>
          <div>{r.text}</div>

          <input
            type="number"
            value={values[r.value] || ""}
            disabled={locked}
            onChange={(e) => handleChange(e.target.value, r.value)}
            style={{
              ...styles.autoInput,
              borderColor: !isValid ? "#ef4444" : "#cbd5e1"
            }}
          />
        </div>
      ))}

      {/* NO ANSWER */}
      {noAnswerRow && (
        <div style={styles.noAnswerRow}>
          <label>
            <input
              type="checkbox"
              onChange={handleNoAnswer}
            />
            {noAnswerRow.text}
          </label>
        </div>
      )}

      {/* TOTAL */}
      {question.config?.showTotal && (
        <div style={styles.totalBox}>
          Total: {total} / {target}
        </div>
      )}

      {/* ERROR */}
      {!isValid && !locked && (
        <div style={styles.error}>
          Total must equal {target}
        </div>
      )}

      {/* AUTO FILL */}
      {question.config?.autoFillRemainder && (
        <button onClick={autoFill} style={styles.autoFillBtn}>
          Auto-fill remaining
        </button>
      )}
    </div>
  );
}


/**
 * =========================================================
 * 🎨 GLOBAL DESIGN SYSTEM (Survey Studio)
 * Clean, dense, Decipher-like UI
 * =========================================================
 */

export const styles = {

  /* ================= DESIGN TOKENS (PREMIUM) ================= */

  colorBg: "#f8fafc",
  colorPanel: "rgba(255,255,255,0.75)",
  colorBorder: "rgba(226,232,240,0.6)",
  colorText: "#0f172a",
  colorSub: "#64748b",

  primary: "#4f46e5",
  primarySoft: "#eef2ff",
  primaryGlow: "rgba(79,70,229,0.35)",

  success: "#16a34a",
  danger: "#dc2626",

  radiusXs: "6px",
  radiusSm: "10px",
  radiusMd: "14px",
  radiusLg: "18px",

  shadowXs: "0 1px 3px rgba(0,0,0,0.04)",
  shadowSm: "0 4px 12px rgba(0,0,0,0.05)",
  shadowMd: "0 12px 30px rgba(0,0,0,0.08)",
  shadowLg: "0 20px 50px rgba(0,0,0,0.12)",

  glass: "blur(14px)",

  /* ================= PAGE ================= */

  page: {
    width: "100vw",
    height: "100vh",
    overflow: "hidden",

    fontFamily: "Inter, system-ui, sans-serif",

    background: `
      radial-gradient(circle at 20% 20%, #e0e7ff 0%, transparent 40%),
      radial-gradient(circle at 80% 0%, #dbeafe 0%, transparent 40%),
      linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)
    `,

    color: "#0f172a",
  },

  /* ================= HEADER ================= */

  header: {
    height: "64px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",

    padding: "0 24px",

    background: "rgba(255,255,255,0.7)",
    backdropFilter: "blur(14px)",

    borderBottom: "1px solid rgba(255,255,255,0.6)",

    position: "sticky",
    top: 0,
    zIndex: 100,
  },

  logo: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "700",
    letterSpacing: "-0.3px",
    color: "#1e293b",
  },

  subtitle: {
    fontSize: "12px",
    color: "#64748b",
  },

  /* ================= MAIN LAYOUT ================= */

  main: {
    display: "grid",
    gridTemplateColumns: "600px minmax(0,1fr)",
    height: "calc(100vh - 64px)",
  },

  /* ================= LEFT PANEL ================= */

  leftPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "18px",

    overflowY: "auto",
    minWidth: 0, 

    background: "rgba(248,250,252,0.6)",
    backdropFilter: "blur(10px)",

    borderRight: "1px solid rgba(226,232,240,0.5)",
  },

  /* ================= RIGHT PANEL ================= */

  rightPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    padding: "24px",
    overflow: "auto",

    background: "rgba(241,245,249,0.6)",
    backdropFilter: "blur(10px)",
  },

  /* ================= CARD SYSTEM ================= */

  card: {
    background: "rgba(255,255,255,0.75)",
    backdropFilter: "blur(12px)",

    borderRadius: "14px",
    padding: "16px",

    border: "1px solid rgba(255,255,255,0.6)",

    boxShadow: "0 4px 12px rgba(0,0,0,0.04)",

    width: "100%",          // ✅ ADD
    minWidth: 0,            // ✅ ADD
  },

  cardHover: {
    transform: "translateY(-2px)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },

  cardPrimary: {
    background: "linear-gradient(135deg,#ffffff,#f8fafc)",

    borderRadius: "16px",
    padding: "18px",

    border: "1px solid rgba(99,102,241,0.2)",

    boxShadow: "0 12px 30px rgba(79,70,229,0.12)",
  },

  previewCard: {
    background: "rgba(255,255,255,0.9)",
    backdropFilter: "blur(16px)",

    borderRadius: "20px",
    padding: "32px",

    border: "1px solid rgba(255,255,255,0.7)",

    maxWidth: "760px",
    margin: "0 auto",

    boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
  },

  xmlCard: {
    background: "rgba(255,255,255,0.75)",
    backdropFilter: "blur(12px)",

    borderRadius: "14px",
    padding: "16px",

    border: "1px solid rgba(255,255,255,0.6)",
  },

  /* ================= TYPOGRAPHY ================= */

  sectionTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: "600",
    letterSpacing: "-0.2px",
  },

  sectionSub: {
    margin: 0,
    fontSize: "12px",
    color: "#64748b",
  },

  sectionMini: {
    fontSize: "12px",
    fontWeight: "600",
    marginTop: "12px",
    color: "#334155",
  },

  /* ================= GRID ================= */

  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },

  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "12px",
  },

  /* ================= SPACING HELPERS ================= */

  stackSm: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  stackMd: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  stackLg: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },

  /* ================= DIVIDERS ================= */

  divider: {
    height: "1px",
    background: "linear-gradient(90deg, transparent, #e2e8f0, transparent)",
    margin: "8px 0",
  },

  /* ================= SCROLLBAR (SUBTLE PREMIUM) ================= */

  scroll: {
    scrollbarWidth: "thin",
  },

  /* ================= INPUT SYSTEM (PREMIUM FEEL) ================= */

  inputWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  label: {
    fontSize: "11px",
    color: "#475569",
    fontWeight: "500",
    letterSpacing: "0.2px",
  },

  input: {
    padding: "10px 12px",
    borderRadius: "10px",

    border: "1px solid rgba(226,232,240,0.9)",
    background: "rgba(255,255,255,0.9)",

    fontSize: "12px",
    color: "#0f172a",

    outline: "none",

    transition: "all 0.18s ease",
  },

  inputFocus: {
    borderColor: "#6366f1",
    boxShadow: "0 0 0 3px rgba(99,102,241,0.15)",
  },

  inputError: {
    borderColor: "#ef4444",
    boxShadow: "0 0 0 3px rgba(239,68,68,0.15)",
  },

  textarea: {
    width: "100%",
    padding: "12px",

    borderRadius: "12px",
    border: "1px solid rgba(226,232,240,0.9)",

    background: "rgba(255,255,255,0.95)",

    minHeight: "140px",
    resize: "vertical",

    fontSize: "12px",
    lineHeight: "1.5",

    outline: "none",

    transition: "all 0.18s ease",
  },

  select: {
    padding: "10px 12px",
    borderRadius: "10px",

    border: "1px solid rgba(226,232,240,0.9)",
    background: "rgba(255,255,255,0.95)",

    fontSize: "12px",

    outline: "none",
    cursor: "pointer",

    transition: "all 0.18s ease",
  },

  /* ================= BUTTON SYSTEM ================= */

  btnBase: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "none",

    fontSize: "12px",
    fontWeight: "600",

    cursor: "pointer",

    transition: "all 0.18s ease",
  },

  btnPrimary: {
    background: "linear-gradient(135deg,#4f46e5,#6366f1)",
    color: "#fff",

    boxShadow: "0 8px 20px rgba(79,70,229,0.35)",
  },

  btnPrimaryHover: {
    transform: "translateY(-1px)",
    boxShadow: "0 12px 26px rgba(79,70,229,0.45)",
  },

  btnSuccess: {
    background: "linear-gradient(135deg,#16a34a,#22c55e)",
    color: "#fff",

    boxShadow: "0 8px 20px rgba(34,197,94,0.35)",
  },

  btnGhost: {
    background: "rgba(255,255,255,0.7)",
    border: "1px solid rgba(226,232,240,0.8)",

    color: "#334155",
  },

  btnDanger: {
    background: "#ef4444",
    color: "#fff",

    boxShadow: "0 6px 14px rgba(239,68,68,0.3)",
  },

  /* ================= MAIN ACTION BUTTONS ================= */

  previewBtn: {
    flex: 1,
    padding: "12px",
    borderRadius: "12px",
    border: "none",

    background: "linear-gradient(135deg,#4f46e5,#6366f1)",
    color: "#fff",

    fontWeight: "600",

    boxShadow: "0 10px 25px rgba(79,70,229,0.4)",

    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  generateBtn: {
    flex: 1,
    padding: "12px",
    borderRadius: "12px",
    border: "none",

    background: "linear-gradient(135deg,#16a34a,#22c55e)",
    color: "#fff",

    fontWeight: "600",

    boxShadow: "0 10px 25px rgba(34,197,94,0.4)",

    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  /* ================= ACTION BAR (FLOATING GLASS) ================= */

  actionBar: {
    position: "sticky",
    top: "14px",
    zIndex: 50,

    display: "flex",
    gap: "12px",

    padding: "14px",

    background: "rgba(255,255,255,0.75)",
    backdropFilter: "blur(14px)",

    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.6)",

    boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
  },

  /* ================= TAB SYSTEM (LINEAR STYLE) ================= */

  tabBar: {
    display: "flex",
    gap: "6px",
    padding: "6px",

    borderRadius: "14px",

    background: "rgba(226,232,240,0.7)",

    backdropFilter: "blur(8px)",

    position: "sticky",
    top: "0",
    zIndex: 20,
  },

  tabBtn: {
    flex: 1,

    padding: "8px 10px",

    borderRadius: "10px",
    border: "none",

    background: "transparent",

    fontSize: "12px",
    fontWeight: "500",

    color: "#475569",

    cursor: "pointer",

    transition: "all 0.18s ease",
  },

  tabBtnActive: {
    background: "#ffffff",

    color: "#1e293b",

    fontWeight: "600",

    boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
  },

  /* ================= QUESTION TABS ================= */

  qTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "10px",
  },

  qTab: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",

    padding: "10px 12px",

    borderRadius: "12px",

    border: "1px solid rgba(226,232,240,0.8)",
    background: "rgba(255,255,255,0.85)",

    cursor: "pointer",

    fontSize: "12px",

    transition: "all 0.2s ease",

    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },

  qTabActive: {
    background: "#eef2ff",

    borderColor: "#6366f1",

    boxShadow: "0 6px 16px rgba(99,102,241,0.25)",

    color: "#3730a3",
  },

  qTabActions: {
    display: "flex",
    gap: "6px",
    opacity: 0.7,
  },

  qTabIconBtn: {
    width: "24px",
    height: "24px",

    borderRadius: "6px",

    border: "1px solid rgba(226,232,240,0.8)",
    background: "#ffffff",

    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    cursor: "pointer",

    fontSize: "11px",

    transition: "all 0.15s ease",
  },

  addQBtn: {
    width: "100%",

    padding: "12px",

    marginBottom: "12px",

    borderRadius: "12px",
    border: "none",

    background: "linear-gradient(135deg,#16a34a,#22c55e)",
    color: "#fff",

    fontWeight: "600",

    cursor: "pointer",

    boxShadow: "0 8px 20px rgba(34,197,94,0.3)",
  },

  /* ================= CHECKBOX / SWITCH ================= */

  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",

    fontSize: "12px",
    color: "#334155",

    cursor: "pointer",
  },

  checkInline: {
    display: "flex",
    alignItems: "center",
    gap: "6px",

    fontSize: "11px",

    background: "rgba(248,250,252,0.7)",
    padding: "4px 6px",

    borderRadius: "6px",
  },

  /* ================= MINI BUTTONS ================= */

  smallBtn: {
    padding: "6px 8px",

    fontSize: "11px",

    borderRadius: "8px",

    border: "1px solid rgba(226,232,240,0.8)",

    background: "#fff",

    cursor: "pointer",

    transition: "all 0.15s ease",
  },  

  /* ================= OPTION EDITOR (PREMIUM CORE UX) ================= */

  optionHeader: {
    display: "grid",
    gridTemplateColumns: "60px 1fr 220px",
    gap: "12px",

    padding: "12px 14px",

    fontSize: "11px",
    fontWeight: "600",

    color: "#64748b",

    borderBottom: "1px solid rgba(226,232,240,0.6)",
  },

  optionRow: {
    display: "flex",
    gap: "14px",

    padding: "14px",

    borderRadius: "14px",

    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(226,232,240,0.6)",

    boxShadow: "0 4px 12px rgba(0,0,0,0.04)",

    transition: "all 0.2s ease",
  },

  optionRowHover: {
    transform: "translateY(-2px)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
  },

  optionIndex: {
    width: "50px",

    fontWeight: "600",
    fontSize: "12px",

    color: "#475569",

    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  optionCenter: {
    flex: 1,

    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  optionTextarea: {
    width: "100%",
    maxWidth: "100%",       // ✅ PREVENT OVERFLOW

    minHeight: "160px",

    padding: "12px",

    borderRadius: "10px",
    border: "1px dashed #c7d2fe",

    fontSize: "12px",

    resize: "vertical",

    boxSizing: "border-box",  // ✅ CRITICAL
  },

  optionRight: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",

    alignItems: "flex-end",

    minWidth: "160px",
  },

  optionRightInline: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",

    alignItems: "center",
  },

  smallInput: {
    width: "70px",

    padding: "8px",

    borderRadius: "8px",

    border: "1px solid rgba(226,232,240,0.8)",

    fontSize: "12px",
  },

  deleteBtn: {
    background: "#ef4444",
    color: "#fff",

    border: "none",

    padding: "6px 10px",

    fontSize: "12px",

    borderRadius: "8px",

    cursor: "pointer",

    boxShadow: "0 6px 14px rgba(239,68,68,0.25)",
  },

  addBtn: {
    padding: "8px 12px",

    fontSize: "12px",

    borderRadius: "10px",

    background: "linear-gradient(135deg,#16a34a,#22c55e)",
    color: "#fff",

    border: "none",

    cursor: "pointer",

    boxShadow: "0 8px 20px rgba(34,197,94,0.25)",
  },

  /* ================= TOOLBAR (RICH TEXT) ================= */

  toolbar: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",

    marginBottom: "6px",
  },

  toolBtn: {
    padding: "6px 10px",

    fontSize: "11px",

    borderRadius: "8px",

    border: "1px solid rgba(226,232,240,0.8)",

    background: "#ffffff",

    cursor: "pointer",

    transition: "all 0.15s ease",
  },

  toolBtnHover: {
    background: "#eef2ff",
    borderColor: "#6366f1",
  },

  /* ================= AUTOSUM (UPGRADED UX) ================= */

  autoWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },

  autoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",

    padding: "12px 14px",

    borderRadius: "12px",

    background: "rgba(255,255,255,0.9)",

    border: "1px solid rgba(226,232,240,0.7)",

    boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
  },

  autoInput: {
    width: "90px",

    padding: "8px",

    borderRadius: "8px",

    border: "1px solid rgba(226,232,240,0.8)",

    textAlign: "right",
  },

  autoHeader: {
    display: "flex",
    justifyContent: "space-between",

    fontSize: "12px",
    fontWeight: "600",

    color: "#334155",
  },

  totalBox: {
    fontWeight: "700",

    padding: "10px",

    borderRadius: "10px",

    background: "#eef2ff",

    textAlign: "center",
  },

  autoFillBtn: {
    marginTop: "10px",

    padding: "8px",

    borderRadius: "8px",

    background: "#4f46e5",
    color: "#fff",

    border: "none",

    cursor: "pointer",
  },

  noAnswerRow: {
    marginTop: "10px",

    padding: "10px",

    borderRadius: "10px",

    background: "#f1f5f9",
  },

  /* ================= INFO / EMPTY / ERROR ================= */

  info: {
    background: "rgba(224,242,254,0.8)",

    padding: "12px",

    borderRadius: "10px",

    fontSize: "12px",

    border: "1px solid rgba(186,230,253,0.6)",
  },

  empty: {
    padding: "28px",

    textAlign: "center",

    fontSize: "13px",

    color: "#64748b",
  },

  error: {
    color: "#ef4444",

    fontSize: "12px",

    marginTop: "6px",
  },

  /* ================= XML / COPY BLOCK ================= */

  copyBlock: {
    borderRadius: "16px",

    background: "#020617",

    border: "1px solid #0f172a",

    overflow: "hidden",

    boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
  },

  copyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",

    padding: "10px 14px",

    borderBottom: "1px solid #0f172a",

    background: "#020617",
  },

  copyTitle: {
    fontSize: "12px",
    fontWeight: "600",

    color: "#94a3b8",
  },

  copyBtn: {
    border: "1px solid #1e293b",

    background: "#020617",

    color: "#e2e8f0",

    borderRadius: "8px",

    padding: "6px 8px",

    cursor: "pointer",

    fontSize: "12px",
  },

  copyCode: {
    margin: 0,

    padding: "14px",

    fontSize: "12px",

    color: "#22c55e",

    fontFamily: "monospace",

    background: "#020617",

    overflowX: "auto",
    maxHeight: "320px",
    overflowY: "auto",
  },

  /* ================= SMART PASTE ================= */

  smartPasteBtn: {
    marginTop: "10px",

    padding: "10px",

    borderRadius: "10px",

    border: "none",

    background: "linear-gradient(135deg,#7c3aed,#8b5cf6)",
    color: "#fff",

    fontWeight: "600",

    cursor: "pointer",

    boxShadow: "0 8px 20px rgba(124,58,237,0.3)",
  },

  /* ================= MICRO INTERACTIONS ================= */

  fadeIn: {
    animation: "fadeIn 0.25s ease",
  },

  hoverLift: {
    transition: "all 0.2s ease",
  },

  hoverLiftActive: {
    transform: "translateY(-2px)",
  },

  /* ================= KEYFRAMES ================= */

  keyframes: `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  `
}