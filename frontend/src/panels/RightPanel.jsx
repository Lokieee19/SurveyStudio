import React, { useMemo } from "react";
import SurveyPreview from "../components/SurveyPreview";
import GenerateButton from "../components/GenerateButton";

/**
 * =========================================================
 * 🎯 RIGHT PANEL (FULLY RESTORED LOGIC)
 * =========================================================
 */

export default function RightPanel({
  styles,
  parsed,
  questions,
  activePreviewLabel,
  handlePreview,
  handleGenerate,
  xml,
  loading
}) {

  /**
   * =========================================================
   * 🧠 MERGE LOGIC (CRITICAL - RESTORED FROM ORIGINAL)
   * =========================================================
   */
  const mergedQuestions = useMemo(() => {

    if (!parsed || !parsed.length) return [];

    return parsed.map((q, index) => {

      const original =
        questions.find(orig => orig.id === q.id) || {};

      /**
       * =========================================================
       * 🔥 OPTIONS HANDLING (ANCHOR LAST)
       * =========================================================
       */
      const finalOptions =
        ["radio", "checkbox", "ranking"].includes(q.type)
          ? (() => {

              const opts =
                original.parsedOptions?.length > 0
                  ? original.parsedOptions
                  : q.options || [];

              const safeOpts = opts || [];

              return [
                ...safeOpts.filter(o => !o.anchor),
                ...safeOpts.filter(o => o.anchor),
              ];

            })()
          : q.options;

      /**
       * =========================================================
       * 🔥 ROWS HANDLING (TYPE-AWARE)
       * =========================================================
       */
      let finalRows = [];

      if (q.type === "autosum") {

        finalRows =
          original.parsedRows?.length > 0
            ? original.parsedRows.map((r) => ({
                label: `r${r.value}`,
                value: r.value,
                text: r.text,
                description: r.desc ?? r.description ?? "",
                anchor: r.anchor,
                exclusive: r.exclusive,
                terminate: r.terminate,
                other: r.other,
              }))
            : [];

      } else if (q.type === "ranking") {

        finalRows =
          original.parsedOptions?.length > 0
            ? original.parsedOptions
            : q.rows;

      } else if (["radio", "checkbox"].includes(q.type)) {

        finalRows =
          original.parsedOptions?.length > 0
            ? original.parsedOptions
            : q.rows;

      } else {

        finalRows =
          original.parsedRows?.length > 0
            ? original.parsedRows
            : q.rows;
      }

      /**
       * =========================================================
       * 🔥 COLUMNS HANDLING
       * =========================================================
       */
      const finalColumns =
        original.parsedColumns?.length > 0
          ? original.parsedColumns
          : q.columns;

      /**
       * =========================================================
       * 🔥 CONFIG MERGE (ORIGINAL + EDITED)
       * =========================================================
       */
      const finalConfig = {
        ...(q.config || {}),
        ...(original.config || {})
      };

      /**
       * =========================================================
       * 🔥 AUTOSUM EXTRA (CRITICAL)
       * =========================================================
       */
      const autosumRows =
        q.type === "autosum"
          ? (original.autosumRows || [])
          : undefined;

      return {
        ...q,
        options: finalOptions,
        rows: finalRows,
        columns: finalColumns,
        config: finalConfig,
        autosumRows
      };

    });

  }, [parsed, questions]);

  /**
   * =========================================================
   * 🧱 UI
   * =========================================================
   */
  return (
    <div style={styles.rightPanel}>

      {/* =====================================================
          🎯 ACTION BAR
      ===================================================== */}
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

      {/* =====================================================
          👁️ LIVE PREVIEW
      ===================================================== */}
      <div style={styles.previewCard}>

        <SectionHeader
          styles={styles}
          title="Live Preview"
          subtitle="Full survey rendering"
        />

        {mergedQuestions.length > 0 ? (

          <SurveyPreview
            questions={mergedQuestions}
            activeQuestionLabel={activePreviewLabel}
          />

        ) : (

          <EmptyState
            styles={styles}
            text="Click Preview to render full survey"
          />

        )}

      </div>

      {/* =====================================================
          🧾 XML OUTPUT (FULLY RESTORED)
      ===================================================== */}
      <div style={styles.xmlCard}>

        <SectionHeader
          styles={styles}
          title="Generated XML"
          subtitle="Production-ready output"
        />

        {xml ? (
          <CopyBlock
            styles={styles}
            title="XML"
            code={xml}
          />
        ) : (
          <EmptyState
            styles={styles}
            text="XML will appear after generation"
          />
        )}

      </div>

    </div>
  );
}

/**
 * =========================================================
 * 🧩 INTERNAL HELPERS (ENHANCED)
 * =========================================================
 */

/* =========================================================
   🧠 SECTION HEADER
========================================================= */
function SectionHeader({ styles = {}, title, subtitle }) {
  return (
    <div style={styles.sectionHeader || {}}>
      <div>
        <h3 style={styles.sectionTitle || {}}>
          {title}
        </h3>
        <p style={styles.sectionSub || {}}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   💤 EMPTY STATE
========================================================= */
function EmptyState({ styles = {}, text }) {
  return (
    <div style={styles.empty || {}}>
      {text}
    </div>
  );
}

/* =========================================================
   📋 COPY BLOCK (UPGRADED)
========================================================= */
function CopyBlock({
  styles = {},
  title = "Code",
  code = ""
}) {
  const [copied, setCopied] = React.useState(false);

  /**
   * =========================================================
   * 📋 COPY HANDLER
   * =========================================================
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1200);

    } catch (err) {
      console.error(err);
      alert("Copy failed");
    }
  };

  /**
   * =========================================================
   * 🔍 FORMAT XML (OPTIONAL BEAUTIFY)
   * =========================================================
   */
  const formattedCode = useMemo(() => {
    if (!code) return "";

    try {
      // basic formatting (keeps it readable)
      return code
        .replace(/></g, ">\n<")
        .replace(/\n\s*\n/g, "\n")
        .trim();
    } catch {
      return code;
    }
  }, [code]);

  return (
    <div style={styles.copyBlock || {}}>

      {/* HEADER */}
      <div style={styles.copyHeader || {}}>

        <div style={styles.copyTitle || {}}>
          {"</>"} {title}
        </div>

        <button
          style={styles.copyBtn || {}}
          onClick={handleCopy}
        >
          {copied ? "✓" : "⧉"}
        </button>

      </div>

      {/* CODE */}
      <pre style={styles.copyCode || {}}>
        <code>{formattedCode}</code>
      </pre>

    </div>
  );
}
