import { useState, useEffect } from "react";
import { previewQuestion, generateXML } from "./api";
import SurveyPreview from "./components/SurveyPreview";
import GenerateButton from "./components/GenerateButton";

/**
 * ============================================
 * 🧠 MAIN APP
 * ============================================
 */
export default function App() {

  // ============================================
  // 🚀 MULTI QUESTION STATE (NEW)
  // ============================================
  const [questions, setQuestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [parsed, setParsed] = useState([]);
  const [activePreviewLabel, setActivePreviewLabel] = useState(null);

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

  const [xml, setXml] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState("setup");
  const [showOptions, setShowOptions] = useState(false);
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
    const text = (opt.text || "").toLowerCase();
    const value = opt.value;

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
        if (!hasExplicitTerminate) updated.terminate = true;
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
        if (!hasExplicitTerminate) updated.terminate = true;
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
          value = Number(match[1]); // 🔥 IMPORTANT
          text = match[2];
        } else {
          value = idx + 1;
          text = line;
        }

        return enforceOptionRules({
          label: `r${value}`,
          value,
          text: text.replace(/^\d+\.\s*/, "").trim(),
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
        title: q.title?.trim(),
        type: q.type,

        description: q.description?.trim(),
        comment: q.comment?.trim(),

        optionsText: cleanInput(q.optionsText),

        rowsText:
          q.type === "autosum"
            ? (
                q.parsedRows?.length > 0
                  ? q.parsedRows.map(r => `${r.value}. ${r.text}`).join("\n")
                  : ""
              )
            : cleanInput(q.rowsText),

        columnsText: cleanInput(q.columnsText),

        // 🔥 🔥 CRITICAL ADDITION
        parsedRows: q.parsedRows || [],
        parsedOptions: q.parsedOptions || [],

        range:
          q.rangeMin && q.rangeMax
            ? [Number(q.rangeMin), Number(q.rangeMax)]
            : null,

        config: q.config || {},
        randomize: q.randomize || {},
        exclusive: !!q.exclusive,
      }));

      const results = await Promise.all(
        payloads.map((p) => previewQuestion(p))
      );

      const allQuestions = results.flatMap((r) =>
        Array.isArray(r.questions) ? r.questions : []
      );

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

          parsedOptions: (q.options || []).map(opt => ({
            ...opt,
            text: opt.text
          })),

          parsedRows: (q.rows || []).map(row => ({
            ...row,
            text: row.text
          })),

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

    if (!blocks || !blocks.length) {
      alert("Nothing parsed");
      return;
    }

    const cleanRow = (t) =>
      t.replace(/^\d+\.\s*/, "").trim();

    const detectAmount = (b) => {
      const combined = `${b.title} ${b.description} ${b.comment}`.toLowerCase();

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
                  text: text.trim(),

                  // 🔥 THIS WAS MISSING
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

        config: {
          ...form.config,

          amount: isAutosum ? detectAmount(b) : form.config.amount,

          // 🔥 CRITICAL FIX — VERIFY ONLY FOR NUMERIC
          verify: isNumeric
            ? (
                (!form.config.verify || form.config.verify.startsWith("range("))
                  ? (rangeDetected?.verify || "")
                  : form.config.verify
              )
            : "", // ❌ REMOVE VERIFY FOR NON-NUMERIC
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
  // ============================================
  // GENERATE XML
  // ============================================
  const handleGenerate = async () => {
    try {
      if (!parsed.length || !questions.length) {
        alert("Click Preview first");
        return;
      }

      if (parsed.length !== questions.length) {
        alert("Preview mismatch. Re-run preview.");
        return;
      }

      setLoading(true);

      const updated = parsed.map((q) => {
        const original = questions.find(qn => qn.id === q.id) || {};

        return {
          ...q,

          /* ================= OPTIONS ================= */
          options:
            ["radio", "checkbox", "ranking"].includes(q.type)
              ? (() => {
                  const opts =
                    original.parsedOptions?.length > 0
                      ? original.parsedOptions
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
              ? (
                  original.parsedRows?.length > 0
                      ?original.parsedRows.map((r) => ({
                        label: `r${r.value}`,
                        value: r.value,
                        text: r.text,
                        description: r.desc ?? r.description ?? "",
                        anchor: r.anchor,
                        exclusive: r.exclusive,
                        terminate: r.terminate,
                        other: r.other,
                      }))
                    : []   // ✅ REQUIRED fallback
                )

              : q.type === "ranking"
                ? (original.parsedOptions?.length > 0
                    ? original.parsedOptions
                    : q.rows)

              : ["radio", "checkbox"].includes(q.type)
                ? (original.parsedOptions?.length > 0
                    ? original.parsedOptions
                    : q.rows)

              : (original.parsedRows?.length > 0
                  ? original.parsedRows
                  : q.rows),

          /* ================= COLUMNS ================= */
          columns:
            original.parsedColumns?.length > 0
              ? original.parsedColumns
              : q.columns,

          /* ================= CONFIG ================= */
          config: {
            ...q.config,

            optional: original.config?.optional,
            atleast: original.config?.atleast,
            atmost: original.config?.atmost,
            exact: original.config?.exact,
            unique: original.config?.unique,

            verify:
              ["number", "float"].includes(q.type)
                ? original.config?.verify
                : undefined,

            amount:
              q.type === "autosum"
                ? original.config?.amount || q.config?.amount
                : q.config?.amount,

            tolerance: original.config?.tolerance,
            enforceTotal: original.config?.enforceTotal,
            autoFillRemainder: original.config?.autoFillRemainder,
            showTotal: original.config?.showTotal,

            preText: original.config?.preText,
            rowLegend: original.config?.rowLegend,
            alignment: original.config?.alignment,
            inputSize: original.config?.inputSize,
            placeholder: original.config?.placeholder,

            autoAdvance: original.config?.autoAdvance,
            disableInsteadOfHide: original.config?.disableInsteadOfHide,

            randomizeSubset: original.config?.randomizeSubset,
            keepFirstFixed: original.config?.keepFirstFixed,
            keepLastFixed: original.config?.keepLastFixed,

            includeOther: original.config?.includeOther,
            includeNone: original.config?.includeNone,
            includeDK: original.config?.includeDK,
            includePNA: original.config?.includePNA,

            errorMessage: original.config?.errorMessage,

            variableName: original.config?.variableName,
            exportLabel: original.config?.exportLabel,
          },
        };
      });

      const res = await generateXML(updated);

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

  const t = form.type;

  // ============================================
  // UI
  // ============================================
  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.logo}>Survey Studio</h1>
          <p style={styles.subtitle}>
            Build surveys
          </p>
        </div>
      </div>

      {/* MAIN GRID */}
      <div style={styles.main}>
        {/* LEFT PANEL */}
        <div style={styles.leftPanel}>

          {/* =========================
              🚀 MULTI QUESTION CONTROLS (NEW)
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

                    // 🔥 CRITICAL: trigger preview jump
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

          {/* =========================
              ⚡ SMART PASTE
          ========================= */}
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
              style={styles.optionTextarea}
            />

            <button
              style={styles.smartPasteBtn}
              onClick={() => handleSmartPaste(form.smartPasteText)}
            >
              ⚡ Smart Paste
            </button>
          </div>

          {/* =========================
              🧩 QUESTION SETUP
          ========================= */}
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

                      {/* ✅ OPTIONAL: You can convert this also to RichTextEditor if needed */}
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
              🧠 QUESTION CONFIG (PRO MAX)
          ========================= */}
          <div style={styles.card}>
            <SectionHeader
              title="Question Config"
              subtitle="Advanced validation, behavior & display controls"
            />

            {/* ================= BASIC ================= */}
            <SectionMini title="Basic" />

            <Check
              label="Optional Question"
              checked={form.config.optional}
              onChange={(v) =>
                handleChange("config", { ...form.config, optional: v })
              }
            />

            {/* ================= VALIDATION ================= */}
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

            {/* ================= AUTOSUM ================= */}
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

            {/* ================= DISPLAY ================= */}
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

            {/* ================= BEHAVIOR ================= */}
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

            {/* ================= RANDOMIZATION ================= */}
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

            {/* ================= SPECIAL OPTIONS ================= */}
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

            {/* ================= DATA OUTPUT ================= */}
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
              🔧 OPTION EDITOR (UPGRADED)
          ========================= */}
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

                  const isOptionType = ["radio","checkbox","ranking"].includes(form.type);

                  // ✅ 🔥 MOVED INSIDE LOOP (CRITICAL FIX)
                  const optText = (opt.text || "").toLowerCase();
                  const isLocked = [97, 98, 99].includes(opt.value);
                  const isOther = optText.includes("other");
                  const isDK = /don't know|dont know|not sure/i.test(optText);
                  const isNone = /none of the above|none of these/i.test(optText);

                  const updateField = (field, value) => {
                    const updated = isOptionType
                      ? [...form.parsedOptions]
                      : [...form.parsedRows];

                    updated[i][field] = value;

                    if (field === "value" || field === "text") {
                      updated[i] = enforceOptionRules(updated[i]);
                    }

                    handleChange(
                      isOptionType ? "parsedOptions" : "parsedRows",
                      updated
                    );
                  };

                  return (
                    <div style={styles.optionRow} key={i}>

                      <div style={styles.optionLeft}>
                        {opt.label}
                      </div>

                      <div style={styles.optionCenter}>

                        <div style={styles.optionTopBar}>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            opt-{i}
                          </span>

                          <input
                            type="number"
                            value={opt.value}
                            onChange={(e) =>
                              updateField("value", Number(e.target.value))
                            }
                            style={styles.smallInput}
                          />
                        </div>

                        <RichTextEditor
                          label={`opt-${i}`}
                          value={opt.text}
                          onChange={(v) => updateField("text", v)}
                        />
                      </div>

                      <div style={styles.optionRight}>

                        <CheckInline
                          label="Anchor"
                          checked={opt.anchor || false}
                          onChange={(v) => updateField("anchor", v)}
                          disabled={isLocked || isOther || isDK || isNone}
                        />

                        <CheckInline
                          label="Exclusive"
                          checked={opt.exclusive || false}
                          onChange={(v) => updateField("exclusive", v)}
                          disabled={isLocked || isOther}
                        />

                        <CheckInline
                          label="Other"
                          checked={opt.other || false}
                          onChange={(v) => updateField("other", v)}
                          disabled={isLocked}
                        />

                        <CheckInline
                          label="Terminate"
                          checked={opt.terminate || false}
                          onChange={(v) => updateField("terminate", v)}
                          disabled={isLocked || isOther}
                        />

                      </div>

                    </div>
                  );
                })}
            </div>
          )}

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

                  {/* ✅ FIXED: RICH TEXT */}
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
                      updated[i].exclusive = v;
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

        </div> {/* END LEFT PANEL */}

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
              disabled={!parsed.length || parsed.length !== questions.length}
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

            {parsed.length > 0 ? (
              <SurveyPreview
                questions={parsed.map((q, index) => {

                  const original = questions.find(qn => qn.id === q.id) || {};

                  return {
                    ...q,

                    /* ================= OPTIONS ================= */
                    options:
                      ["radio","checkbox","ranking"].includes(q.type)
                        ? (() => {
                            const opts =
                              original.parsedOptions?.length > 0
                                ? original.parsedOptions
                                : q.options;

                            return [
                              ...opts.filter(o => !o.anchor),
                              ...opts.filter(o => o.anchor),
                            ];
                          })()
                        : q.options,

                    /* ================= ROWS ================= */
                    rows:
                      q.type === "autosum"
                        ? (
                            original.parsedRows?.length > 0
                              ? original.parsedRows
                              : []
                          )
                        : q.type === "ranking"
                          ? (original.parsedOptions?.length > 0
                              ? original.parsedOptions
                              : q.rows)
                          : ["radio","checkbox"].includes(q.type)
                            ? (original.parsedOptions?.length > 0
                                ? original.parsedOptions
                                : q.rows)
                            : (original.parsedRows?.length > 0
                                ? original.parsedRows
                                : q.rows),

                    /* ================= COLUMNS ================= */
                    columns:
                      original.parsedColumns?.length > 0
                        ? original.parsedColumns
                        : q.columns,
                  };
                })}
                activeQuestionLabel={activePreviewLabel}
              />
            ) : (
              <EmptyState text="Click Preview to render full survey" />
            )}
          </div>

          {/* =========================
              🧾 XML OUTPUT (MULTI)
          ========================= */}
          <div style={styles.xmlCard}>
            <SectionHeader
              title="Generated XML"
              subtitle="Production-ready output"
            />

            {xml ? (
              <CopyBlock title="XML" code={xml} />
            ) : (
              <EmptyState text="XML will appear after generation" />
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

  // ✅ SAFE VALUE EXTRACTOR (#@ + fallback)
  const getValue = (line) => {
    return (
      line.split("#@")[1]?.trim() ||
      line.split(/-|–/)[1]?.trim() ||
      ""
    );
  };

  // 🔥 Extract flags
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
    };

    let mode = null;

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

      // ================= MODE SWITCH (STRICT) =================
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

      // ================= RESET MODE =================
      if (
        lower.startsWith("question type") ||
        lower.startsWith("label") ||
        lower.startsWith("title") ||
        lower.startsWith("description") ||
        lower.startsWith("comment")
      ) {
        mode = null;
        continue;
      }

      // ================= FLAGS =================
      const flags = extractFlags(line);

      let clean = line
        .replace(/\[anchor\]/gi, "")
        .replace(/\[exclusive\]/gi, "")
        .replace(/\[terminate\]/gi, "")
        .trim();

      if (!clean) continue;

      // ✅ SUPPORT numbered + bullets
      const isNumbered = /^\d+\./.test(clean);
      const isBullet = /^[-•]/.test(clean);

      // capture descriptions
      if (/^description:/i.test(clean)) {
        if (mode === "options" || mode === "rows") {
          const desc = clean.replace(/^description:\s*/i, "").trim();

          if (mode === "options" && q.optionFlags.length) {
            const last = q.optionFlags.length - 1;
            q.optionFlags[last] = {
              ...q.optionFlags[last],
              description: desc
            };
          }

          if (mode === "rows" && q.rowFlags.length) {
            const last = q.rowFlags.length - 1;
            q.rowFlags[last] = {
              ...q.rowFlags[last],
              description: desc
            };
          }
        }
        continue;
      }

      let normalized = clean
        .replace(/^(\d+)[\.\)\-:]\s*/, "$1. ")
        .replace(/^[-•]\s*/, "")
        .trim();

      // 🔥 SPLIT DESCRIPTION
      let text = normalized;
      let description = "";

      if (normalized.includes("|")) {
        const parts = normalized.split("|");
        text = parts[0].trim();
        description = parts[1].trim();
      }

      // ================= CONTENT =================
      if (mode === "options") {
        // 🔥 SMART TYPE ROUTING
        if (["text_multi","textarea_multi","number_multi","float_multi","autosum"].includes(q.type)) {
          q.rowsText += normalized + "\n";
        } else {
          q.optionsText += normalized + "\n";
        }
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

    // ================= FINAL PUSH =================
    if (q.id && q.type && q.title) {
      q.optionsText = q.optionsText.trim();
      q.rowsText = q.rowsText.trim();
      q.columnsText = q.columnsText.trim();

      questions.push(q);
    }
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
  /* ================= DESIGN TOKENS ================= */

  colorBg: "#f8fafc",
  colorPanel: "#ffffff",
  colorBorder: "#e2e8f0",
  colorText: "#0f172a",
  colorSub: "#64748b",

  primary: "#2563eb",
  primaryLight: "#eff6ff",

  success: "#16a34a",
  danger: "#dc2626",

  radiusSm: "8px",
  radiusMd: "12px",
  radiusLg: "16px",

  shadowSm: "0 2px 8px rgba(0,0,0,0.04)",
  shadowMd: "0 6px 20px rgba(0,0,0,0.06)",

  /* ================= PAGE ================= */

  page: {
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    fontFamily: "Inter, system-ui, sans-serif",
    background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
    color: "#0f172a",
  },

  /* ================= HEADER ================= */

  header: {
    height: "60px",
    display: "flex",
    alignItems: "center",
    padding: "0 24px",
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },

  logo: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "700",
    color: "#2563eb",
  },

  subtitle: {
    fontSize: "12px",
    color: "#64748b",
  },

  /* ================= MAIN ================= */

  main: {
    display: "grid",
    gridTemplateColumns: "580px minmax(0,1fr)",
    height: "calc(100vh - 60px)",
  },

  /* ================= LEFT PANEL ================= */

  leftPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "16px",
    overflowY: "auto",
    background: "#f8fafc",
    borderRight: "1px solid #e2e8f0",
  },


  /* ================= RIGHT PANEL ================= */

  rightPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "20px",
    overflow: "auto",
    background: "#f1f5f9",
  },

  /* ================= CARD SYSTEM ================= */

  card: {
    background: "#ffffff",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },

  cardPrimary: {
    background: "#ffffff",
    borderRadius: "14px",
    padding: "18px",
    border: "1px solid #c7d2fe",
    boxShadow: "0 8px 24px rgba(37,99,235,0.12)",
  },

  previewCard: {
    background: "#ffffff",
    borderRadius: "18px",
    padding: "28px 32px",
    border: "1px solid #e2e8f0",
    maxWidth: "720px",
    margin: "0 auto",
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)", // 🔥 reduced
  },

  xmlCard: {
    background: "#ffffff",
    borderRadius: "12px",
    padding: "14px",
    border: "1px solid #e2e8f0",
  },

  /* ================= TYPOGRAPHY ================= */

  sectionTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: "600",
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
  },

  /* ================= INPUT ================= */

  inputWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  label: {
    fontSize: "11px",
    color: "#475569",
    fontWeight: "500",
  },

  input: {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "12px",
    background: "#fff",
    transition: "0.2s",
  },

  textarea: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    height: "180px",
    resize: "vertical",
    fontSize: "12px",
  },

  select: {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "12px",
    background: "#fff",
  },

  /* ================= GRID ================= */

  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },

  /* ================= BUTTONS ================= */

  previewBtn: {
    flex: 1,
    padding: "12px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg,#2563eb,#3b82f6)",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
  },

  generateBtn: {
    flex: 1,
    padding: "12px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg,#16a34a,#22c55e)",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
  },

  actionBar: {
    position: "sticky",
    top: "10px",
    zIndex: 50, // 🔥 IMPORTANT

    display: "flex",
    gap: "12px",
    padding: "12px",

    background: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(10px)",

    borderRadius: "12px",
    border: "1px solid #e2e8f0",

    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
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
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: "12px",
    transition: "all 0.2s ease",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },

  qTabActive: {
    background: "#eff6ff",
    borderColor: "#2563eb",
    boxShadow: "0 4px 12px rgba(37,99,235,0.15)",
    color: "#1e40af",
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
    border: "1px solid #e2e8f0",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "11px",
    transition: "0.2s",
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
    boxShadow: "0 6px 14px rgba(34,197,94,0.25)",
  },


  /* ================= OPTION EDITOR (MAJOR UPGRADE) ================= */

  optionHeader: {
    display: "grid",
    gridTemplateColumns: "50px 1fr 90px 90px 100px 90px",
    gap: "10px",
    padding: "10px 12px",
    fontSize: "11px",
    fontWeight: "600",
    color: "#64748b",
    borderBottom: "1px solid #e2e8f0",
  },

  optionRow: {
    display: "flex",
    gap: "14px",
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    background: "#f9fafb",
    transition: "all 0.2s ease",
  },

  optionRowHover: {
    background: "#f1f5f9",
  },

  optionIndex: {
    width: "40px",
    fontWeight: "600",
    fontSize: "12px",
    paddingTop: "6px",
    color: "#475569",
  },

  optionCenter: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  optionTextarea: {
    width: "100%",
    height: "140px",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "12px",
    background: "#fff",
  },

  optionRight: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    alignItems: "flex-end",
    minWidth: "120px",
  },

  smallInput: {
    width: "70px",
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "12px",
    background: "#fff",
  },

  checkInline: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
  },

  deleteBtn: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    padding: "6px 10px",
    fontSize: "12px",
    borderRadius: "6px",
    cursor: "pointer",
  },

  addBtn: {
    padding: "8px 12px",
    fontSize: "12px",
    borderRadius: "8px",
    background: "#16a34a",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  },

  /* ================= TOOLBAR ================= */

  toolbar: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    marginBottom: "6px",
  },

  toolBtn: {
    padding: "6px 10px",
    fontSize: "11px",
    border: "1px solid #e2e8f0",
    background: "#fff",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "0.2s",
  },

  /* ================= AUTOSUM (BETTER UX) ================= */

  autoWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },

  autoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    background: "#fff",
  },

  autoInput: {
    width: "90px",
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
  },

  autoHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    fontWeight: "600",
  },

  totalBox: {
    fontWeight: "700",
    marginTop: "10px",
    color: "#0f172a",
  },

  autoFillBtn: {
    marginTop: "10px",
    padding: "8px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },

  noAnswerRow: {
    marginTop: "10px",
    padding: "10px",
    borderRadius: "8px",
    background: "#f1f5f9",
  },

  /* ================= SETTINGS ================= */

  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
  },

  settingBlock: {
    marginTop: "16px",
    paddingTop: "12px",
    borderTop: "1px solid #e5e7eb",
  },

  /* ================= XML OUTPUT ================= */

  xmlBox: {
    background: "#020617",
    color: "#22c55e",
    padding: "14px",
    borderRadius: "10px",
    fontSize: "11px",
    overflowX: "auto",
    lineHeight: "1.6",
  },

  /* ================= STATES ================= */

  info: {
    background: "#e0f2fe",
    padding: "10px",
    borderRadius: "8px",
    fontSize: "12px",
  },

  empty: {
    padding: "24px",
    textAlign: "center",
    fontSize: "13px",
    color: "#64748b",
  },

  error: {
    color: "#ef4444",
    fontSize: "12px",
    marginTop: "6px",
  },

  /* ================= SMART PASTE ================= */

  smartPasteBtn: {
    marginTop: "10px",
    padding: "10px",
    borderRadius: "8px",
    border: "none",
    background: "#7c3aed",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "12px",
    transition: "all 0.2s ease",
  },

  copyBlock: {
    borderRadius: "14px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
  },

  copyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    borderBottom: "1px solid #e2e8f0",
    background: "#ffffff",
  },

  copyTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#334155",
  },

  copyBtn: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    borderRadius: "8px",
    padding: "6px 8px",
    cursor: "pointer",
    fontSize: "12px",
    transition: "all 0.2s ease",
  },

  copyCode: {
    margin: 0,
    padding: "14px",
    fontSize: "12px",
    background: "#f8fafc",
    overflowX: "auto",
    maxHeight: "320px",   // ✅ ADD
    overflowY: "auto",    // ✅ ADD
  },

};