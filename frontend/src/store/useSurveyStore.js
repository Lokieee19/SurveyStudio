import { useState } from "react";
import { previewQuestion, generateXML } from "../api";
import { parseSmartPaste } from "../utils/parseSmartPaste";

/**
 * =========================================================
 * 🧠 SURVEY STORE (Single Source of Truth)
 * =========================================================
 */
export function useSurveyStore() {
  // =========================================================
  // STATE
  // =========================================================
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
      /* ===== BASIC ===== */
      optional: false,
      atleast: "",
      atmost: "",
      exact: "",
      unique: "",
      verify: "",

      /* ===== AUTOSUM ===== */
      amount: "",
      tolerance: "",
      enforceTotal: true,
      autoFillRemainder: false,
      showTotal: true,

      /* ===== DISPLAY ===== */
      rowLegend: "",
      preText: "",
      alignment: "right",
      inputSize: "medium",
      placeholder: "",

      /* ===== BEHAVIOR ===== */
      autoAdvance: false,
      disableInsteadOfHide: false,

      /* ===== RANDOMIZATION ===== */
      randomizeSubset: "",
      keepFirstFixed: false,
      keepLastFixed: false,

      /* ===== SPECIAL OPTIONS ===== */
      includeOther: false,
      includeNone: false,
      includeDK: false,
      includePNA: false,

      /* ===== VALIDATION ===== */
      errorMessage: "",

      /* ===== DATA OUTPUT ===== */
      variableName: "",
      exportLabel: "",
    },

    parsedOptions: [],
    parsedRows: [],
    parsedColumns: [],

    smartPasteText: "",
    _smartParsed: null,
  });

  const [parsed, setParsed] = useState([]);
  const [xml, setXml] = useState("");
  const [loading, setLoading] = useState(false);

  // =========================================================
  // GENERIC CHANGE HANDLER
  // =========================================================
  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // =========================================================
  // AUTOSUM HELPERS
  // =========================================================
  const handleAutosumChange = (index, field, value) => {
    const updated = form.autosumRows.map((row, i) =>
      i === index ? { ...row, [field]: value } : row
    );

    setForm((prev) => ({
      ...prev,
      autosumRows: updated,
    }));
  };

  const addAutosumRow = () => {
    setForm((prev) => ({
      ...prev,
      autosumRows: [...prev.autosumRows, { title: "", desc: "" }],
    }));
  };

  const removeAutosumRow = (index) => {
    const updated = form.autosumRows.filter((_, i) => i !== index);

    setForm((prev) => ({
      ...prev,
      autosumRows: updated,
    }));
  };

  // =========================================================
  // CLEAN INPUT
  // =========================================================
  const cleanInput = (text) => text || "";

  // =========================================================
  // BUILD PAYLOAD
  // =========================================================
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
              .map((r, i) => (r.title ? `${i + 1}. ${r.title}` : ""))
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
        amount: form.config.amount
          ? Number(form.config.amount)
          : undefined,
      },

      randomize: form.randomize,
      exclusive: !!form.exclusive,
    };
  };

  // =========================================================
  // PREVIEW
  // =========================================================
  const handlePreview = async () => {
    try {
      const payload = getCleanForm();

      if (!payload.id || !payload.title) {
        alert("Enter ID and Title");
        return;
      }

      const res = await previewQuestion(payload);

      const safeQuestions = Array.isArray(res.questions)
        ? res.questions
        : [];

      setParsed(safeQuestions);
      setXml("");

      if (!safeQuestions.length) return;

      const q = safeQuestions[0];

      setForm((prev) => ({
        ...prev,

        parsedOptions: (q.options || []).map((opt, i) => ({
          ...opt,
          text: opt.text,

          anchor:
            prev._smartParsed?.optionFlags?.[i]?.anchor ?? opt.anchor,

          exclusive:
            prev._smartParsed?.optionFlags?.[i]?.exclusive ??
            opt.exclusive,

          terminate:
            prev._smartParsed?.optionFlags?.[i]?.terminate ??
            opt.terminate,
        })),

        parsedRows:
          q.type === "autosum"
            ? prev.parsedRows
            : (q.rows || []).map((row, i) => ({
                ...row,
                text: row.text,

                anchor:
                  prev._smartParsed?.rowFlags?.[i]?.anchor ??
                  row.anchor,

                exclusive:
                  prev._smartParsed?.rowFlags?.[i]?.exclusive ??
                  row.exclusive,

                terminate:
                  prev._smartParsed?.rowFlags?.[i]?.terminate ??
                  row.terminate,
              })),

        parsedColumns: (q.columns || []).map((col, i) => ({
          ...col,
          text:
            prev.parsedColumns[i]?.text !== undefined
              ? prev.parsedColumns[i].text
              : col.text,

          anchor:
            prev._smartParsed?.columnFlags?.[i]?.anchor ??
            col.anchor,

          exclusive:
            prev._smartParsed?.columnFlags?.[i]?.exclusive ??
            col.exclusive,
        })),
      }));
    } catch (err) {
      console.error(err);
      alert("Preview failed");
    }
  };

/* =========================================================
   SMART PASTE
========================================================= */
const handleSmartPaste = (text) => {
  if (!text || !text.trim()) {
    alert("Paste some content first");
    return;
  }

  const blocks = parseSmartPaste(text);
  if (!blocks.length) {
    alert("Nothing parsed");
    return;
  }

  const first = blocks[0];

  const cleanRow = (t) =>
    t.replace(/^\d+\.\s*/, "").trim();

  const detectAmount = () => {
    const combined = `${first.title} ${first.description} ${first.comment}`.toLowerCase();

    if (combined.includes("100")) return 100;
    if (combined.includes("40")) return 40;

    return "";
  };

  setForm((prev) => ({
    ...prev,

    id: first.id || "",
    type: first.type || "radio",
    title: first.title || "",
    description: first.description || "",
    comment: first.comment || "",

    optionsText: first.optionsText || "",
    rowsText: first.rowsText || "",
    columnsText: first.columnsText || "",

    /* ================= AUTOSUM ================= */
    autosumRows:
      first.type === "autosum"
        ? (first.rowsText || first.optionsText || "")
            .split("\n")
            .filter(Boolean)
            .map((text) => {
              const parts = text.split("|");

              return {
                title: cleanRow(parts[0]),
                desc: parts[1]?.trim() || "",
              };
            })
        : prev.autosumRows,

    parsedRows:
      first.type === "autosum"
        ? (first.rowsText || first.optionsText || "")
            .split("\n")
            .filter(Boolean)
            .map((text, i) => ({
              label: `r${i + 1}`,
              value: i + 1,
              text: cleanRow(text),
            }))
        : [],

    /* ================= RANDOMIZATION ================= */
    randomize: {
      rows: first.randomize?.rows || false,
      columns: first.randomize?.columns || false,
      all: first.randomize?.all || false,
    },

    /* ================= CONFIG ================= */
    config: {
      ...prev.config,
      amount:
        first.type === "autosum"
          ? detectAmount() || prev.config.amount
          : prev.config.amount,
    },

    /* ================= RESET PARSED ================= */
    parsedOptions: [],
    parsedColumns: [],
    _smartParsed: first,
  }));
};

/* =========================================================
   GENERATE XML (🔥 FIXED FLOW)
========================================================= */
const handleGenerate = async () => {
  try {
    setLoading(true);

    let currentParsed = parsed;

    // 🔥 AUTO PREVIEW FIX
    if (!currentParsed.length) {
      const payload = getCleanForm();

      if (!payload.id || !payload.title) {
        alert("Enter ID and Title");
        return;
      }

      const resPreview = await previewQuestion(payload);
      const safeQuestions = Array.isArray(resPreview.questions)
        ? resPreview.questions
        : [];

      if (!safeQuestions.length) {
        alert("Preview failed");
        return;
      }

      setParsed(safeQuestions);
      currentParsed = safeQuestions;
    }

    const updated = currentParsed.map((q) => ({
      ...q,

      /* ================= OPTIONS ================= */
      options:
        ["radio", "checkbox", "ranking"].includes(q.type)
          ? (() => {
              const opts =
                form.parsedOptions.length > 0
                  ? form.parsedOptions
                  : q.options;

              return [
                ...opts.filter((o) => !o.anchor),
                ...opts.filter((o) => o.anchor),
              ];
            })()
          : q.options,

      /* ================= ROWS ================= */
      rows:
        q.type === "autosum"
          ? form.autosumRows.map((r, i) => ({
              label: `r${i + 1}`,
              value: i + 1,
              text: r.title,
              description: r.desc,
            }))
          : form.parsedRows.length > 0
          ? form.parsedRows
          : q.rows,

      /* ================= COLUMNS ================= */
      columns:
        form.parsedColumns.length > 0
          ? form.parsedColumns
          : q.columns,

      /* ================= CONFIG ================= */
      config: {
        ...q.config,
        ...form.config,
      },
    }));

    // 🔥 GENERATE API
    const res = await generateXML(updated);

    console.log("XML RESPONSE:", res);

    if (!res || !res.xml) {
      alert("XML failed");
      return;
    }

    setXml(res.xml);

  } catch (err) {
    console.error(err);
    alert("Generation error");
  } finally {
    setLoading(false);
  }
};

/* =========================================================
   EXPORT STORE
========================================================= */
return {
  form,
  parsed,
  xml,
  loading,

  handleChange,
  handlePreview,
  handleGenerate,
  handleSmartPaste,

  handleAutosumChange,
  addAutosumRow,
  removeAutosumRow,
};
}