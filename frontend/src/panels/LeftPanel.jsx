import React from "react";

import {
  SectionHeader,
  SectionMini,
  Input,
  Textarea,
  Select,
  CheckInline,
  InfoBox
} from "../components/uiHelpers.jsx";

import RichTextEditor from "../components/RichTextEditor.jsx";

/**
 * =========================================================
 * 🧠 LEFT PANEL (FINAL STABLE VERSION)
 * =========================================================
 */

export default function LeftPanel({
  styles,
  questions,
  activeIndex,
  setActiveIndex,
  setActivePreviewLabel,
  addQuestion,
  deleteQuestion,
  duplicateQuestion,
  form,
  handleChange,
  addAutosumRow,
  removeAutosumRow,
  handleAutosumChange,
  enforceOptionRules,
  handleOptionChange,
  setQuestions
}) {

  const t = form.type;

  /**
   * =========================================================
   * 🔥 SMART PASTE (FINAL FIX)
   * =========================================================
   */
  const handleSmartPaste = (text) => {

    if (!text || !text.trim()) {
      alert("Paste content first");
      return;
    }

    const blocks = text.split(/(?=Question Type:)/gi);

    const extractFlags = (line) => ({
      anchor: /\[.*anchor.*\]/i.test(line),
      exclusive: /\[.*exclusive.*\]/i.test(line),
      terminate: /\[.*terminate.*\]/i.test(line),
      other: /\[.*other.*\]/i.test(line),
    });

    const cleanLine = (line) =>
      line.replace(/\[.*?\]/g, "").trim();

    const parseBlock = (block, index) => {

      const lines = block
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean);

      let q = {
        id: `Q${index + 1}`,
        _internalId: crypto.randomUUID(), // 🔥 CRITICAL FIX
        title: "",
        description: "",
        type: "radio",

        optionsText: "",
        rowsText: "",
        columnsText: "",

        optionFlags: [],
        rowFlags: [],
        columnFlags: [],

        parsedOptions: [],
        parsedRows: [],
        parsedColumns: [],

        config: {}
      };

      let mode = null;

      for (let raw of lines) {

        const line = raw.trim();
        const lower = line.toLowerCase();

        if (lower.includes("question type")) {
          if (lower.includes("checkbox")) q.type = "checkbox";
          else if (lower.includes("ranking")) q.type = "ranking";
          else if (lower.includes("autosum")) q.type = "autosum";
          else if (lower.includes("grid")) q.type = "radio_grid";
          else q.type = "radio";
        }

        else if (lower.startsWith("label")) {
          q.id = line.split("#@")[1]?.trim() || q.id;
        }

        else if (lower.startsWith("title")) {
          q.title = line.split("#@")[1]?.trim() || "";
        }

        else if (lower.startsWith("description")) {
          q.description = line.split("#@")[1]?.trim() || "";
        }

        else if (/^options/i.test(line)) {
          mode = "options";
        }

        else if (/^rows/i.test(line)) {
          mode = "rows";
        }

        else if (/^columns/i.test(line)) {
          mode = "columns";
        }

        else {
          const flags = extractFlags(line);
          const cleaned = cleanLine(line);

          if (!cleaned) continue;

          if (mode === "options") {
            q.optionsText += cleaned + "\n";
            q.optionFlags.push(flags);
          }

          if (mode === "rows") {
            q.rowsText += cleaned + "\n";
            q.rowFlags.push(flags);
          }

          if (mode === "columns") {
            q.columnsText += cleaned + "\n";
            q.columnFlags.push(flags);
          }
        }
      }

      return q;
    };

    const parsedQuestions = blocks
      .map(parseBlock)
      .filter(q => q.id);

    if (!parsedQuestions.length) {
      alert("No valid questions detected");
      return;
    }

    setQuestions(parsedQuestions);
    setActiveIndex(0);
    setActivePreviewLabel(parsedQuestions[0]?._internalId);
  };

  /**
   * =========================================================
   * 🧱 UI START
   * =========================================================
   */
  return (
    <div style={styles.leftPanel}>

      {/* =====================================================
          🚀 QUESTION NAVIGATION
      ===================================================== */}
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
              key={q._internalId || i}
              style={{
                ...styles.qTab,
                ...(i === activeIndex ? styles.qTabActive : {})
              }}
              onClick={() => {
                if (i === activeIndex) return;

                setActiveIndex(i);
                setActivePreviewLabel(q._internalId);
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
          ⚡ SMART PASTE UI
      ===================================================== */}
      <div style={styles.card}>
        <SectionHeader
          title="Smart Paste"
          subtitle="Paste questionnaire block and auto-fill"
        />

        <textarea
          placeholder={`Paste here...

Question Type: Radio
Label #@ Q1
Title #@ Sample Question

Options:
1. Yes
2. No
98. Other [OTHER]
99. None [ANCHOR, EXCLUSIVE]`}
          value={form.smartPasteText || ""}
          onChange={(e) =>
            handleChange("smartPasteText", e.target.value)
          }
          style={styles.optionTextarea}
        />

        <button
          style={styles.smartPasteBtn}
          onClick={() =>
            handleSmartPaste(form.smartPasteText)
          }
        >
          ⚡ Smart Paste
        </button>
      </div>

      {/* =====================================================
          🧩 QUESTION SETUP
      ===================================================== */}
      <div style={styles.cardPrimary}>
        <SectionHeader
          title="Question Setup"
          subtitle="Define core question structure"
        />

        <div style={styles.grid2}>
          <Input
            label="Question ID"
            value={form.id || ""}
            onChange={(v) => handleChange("id", v)}
          />

          <Select
            label="Question Type"
            value={form.type || "radio"}
            onChange={(v) => handleChange("type", v)}
            options={[
              { label: "Intro / HTML", value: "html" },
              { label: "Radio", value: "radio" },
              { label: "Checkbox", value: "checkbox" },
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

        {/* ================= TITLE ================= */}
        <RichTextEditor
          label="Question Title"
          value={form.title || ""}
          onChange={(v) => handleChange("title", v)}
        />

        {/* ================= DESCRIPTION ================= */}
        <RichTextEditor
          label="Description"
          value={form.description || ""}
          onChange={(v) => handleChange("description", v)}
        />

        {/* ================= INTERNAL COMMENT ================= */}
        <Textarea
          label="Internal Comment (XML)"
          value={form.comment || ""}
          onChange={(v) => handleChange("comment", v)}
        />
      </div>

      {/* =====================================================
          🧾 ANSWER INPUT
      ===================================================== */}
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
            value={form.optionsText || ""}
            onChange={(v) => handleChange("optionsText", v)}
          />
        )}

        {/* ================= GRID TYPES ================= */}
        {["radio_grid", "checkbox_grid", "card_radio", "card_checkbox"].includes(t) && (
          <>
            <Textarea
              label="Columns"
              value={form.columnsText || ""}
              onChange={(v) => handleChange("columnsText", v)}
            />

            <Textarea
              label="Rows"
              value={form.rowsText || ""}
              onChange={(v) => handleChange("rowsText", v)}
            />
          </>
        )}

        {/* ================= NUMBER SINGLE ================= */}
        {t === "number_single" && (
          <>
            <Input
              label="Value"
              value={form.optionsText || ""}
              onChange={(v) => handleChange("optionsText", v)}
            />

            <div style={styles.grid2}>
              <Input
                label="Min"
                value={form.rangeMin || ""}
                onChange={(v) => handleChange("rangeMin", v)}
              />

              <Input
                label="Max"
                value={form.rangeMax || ""}
                onChange={(v) => handleChange("rangeMax", v)}
              />
            </div>
          </>
        )}

        {/* ================= NUMBER MULTI ================= */}
        {["number_multi", "float_multi"].includes(t) && (
          <>
            <Textarea
              label="Rows"
              value={form.rowsText || ""}
              onChange={(v) => handleChange("rowsText", v)}
            />

            <div style={styles.grid2}>
              <Input
                label="Min"
                value={form.rangeMin || ""}
                onChange={(v) => handleChange("rangeMin", v)}
              />

              <Input
                label="Max"
                value={form.rangeMax || ""}
                onChange={(v) => handleChange("rangeMax", v)}
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
            value={form.rowsText || ""}
            onChange={(v) => handleChange("rowsText", v)}
          />
        )}

        {t === "textarea_single" && (
          <InfoBox text="User will enter a long-form response." />
        )}

        {t === "textarea_multi" && (
          <Textarea
            label="Fields"
            value={form.rowsText || ""}
            onChange={(v) => handleChange("rowsText", v)}
          />
        )}

        {/* ================= RANKING ================= */}
        {t === "ranking" && (
          <Textarea
            label="Ranking Options"
            value={form.optionsText || ""}
            onChange={(v) => handleChange("optionsText", v)}
          />
        )}

        {/* =====================================================
            🔥 AUTOSUM (STABLE)
        ===================================================== */}
        {t === "autosum" && (
          <div style={styles.autoWrapper}>

            <div style={styles.autoHeader}>
              <span>Autosum Rows</span>

              <button
                style={styles.addBtn}
                onClick={addAutosumRow}
              >
                + Add Row
              </button>
            </div>

            {(form.autosumRows || []).map((row, i) => (
              <div key={i} style={styles.autoRow}>

                <div style={{ flex: 1 }}>
                  <Input
                    value={row.title || ""}
                    onChange={(v) =>
                      handleAutosumChange(i, "title", v)
                    }
                    placeholder="Row Title"
                  />

                  <Input
                    value={row.desc || ""}
                    onChange={(v) =>
                      handleAutosumChange(i, "desc", v)
                    }
                    placeholder="Description"
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
          🎛 OPTION EDITOR (STRICT SOURCE = parsedOptions)
      ===================================================== */}
      {["radio", "checkbox"].includes(t) &&
        (form.parsedOptions?.length > 0) && (

          <div style={styles.card}>
            <SectionHeader
              title="Option Editor"
              subtitle="Fine tune behaviors"
            />

            {form.parsedOptions.map((opt) => {

              const current = enforceOptionRules(opt);

              return (
                <div
                  key={current.value}
                  style={styles.optionRow}
                >

                  {/* VALUE */}
                  <input
                    style={styles.smallInput}
                    value={current.value}
                    onChange={(e) => {
                      const val = Number(e.target.value);

                      if (Number.isNaN(val)) return;

                      handleOptionChange(
                        current.value,
                        "value",
                        val
                      );
                    }}
                  />

                  {/* TEXT */}
                  <textarea
                    style={styles.optionTextarea}
                    value={current.text || ""}
                    onChange={(e) =>
                      handleOptionChange(
                        current.value,
                        "text",
                        e.target.value
                      )
                    }
                  />

                  {/* FLAGS */}
                  <div style={styles.optionRight}>

                    <CheckInline
                      label="Anchor"
                      checked={!!current.anchor}
                      onChange={(v) =>
                        handleOptionChange(
                          current.value,
                          "anchor",
                          v
                        )
                      }
                    />

                    <CheckInline
                      label="Exclusive"
                      checked={!!current.exclusive}
                      disabled={current.other}
                      onChange={(v) =>
                        handleOptionChange(
                          current.value,
                          "exclusive",
                          v
                        )
                      }
                    />

                    <CheckInline
                      label="Terminate"
                      checked={!!current.terminate}
                      onChange={(v) =>
                        handleOptionChange(
                          current.value,
                          "terminate",
                          v
                        )
                      }
                    />

                    <CheckInline
                      label="Other"
                      checked={!!current.other}
                      onChange={(v) =>
                        handleOptionChange(
                          current.value,
                          "other",
                          v
                        )
                      }
                    />

                  </div>
                </div>
              );
            })}

          </div>
      )}

      {/* =====================================================
          📊 COLUMN EDITOR (FLAG READY)
      ===================================================== */}
      {["radio_grid", "checkbox_grid"].includes(t) &&
        (form.parsedColumns?.length > 0) && (

          <div style={styles.card}>
            <SectionHeader
              title="Column Editor"
              subtitle="Control behavior (anchor etc.)"
            />

            {form.parsedColumns.map((col) => {

              return (
                <div
                  key={col.value}
                  style={styles.optionRow}
                >

                  {/* VALUE */}
                  <div style={styles.optionIndex}>
                    {col.value}
                  </div>

                  {/* TEXT */}
                  <div style={styles.optionCenter}>
                    {col.text}
                  </div>

                  {/* FLAGS */}
                  <div style={styles.optionRight}>

                    <CheckInline
                      label="Anchor"
                      checked={!!col.anchor}
                      onChange={(v) => {

                        const updated =
                          form.parsedColumns.map(c =>
                            c.value === col.value
                              ? { ...c, anchor: v }
                              : c
                          );

                        handleChange("parsedColumns", updated);
                      }}
                    />

                    <CheckInline
                      label="Exclusive"
                      checked={!!col.exclusive}
                      onChange={(v) => {

                        const updated =
                          form.parsedColumns.map(c =>
                            c.value === col.value
                              ? { ...c, exclusive: v }
                              : c
                          );

                        handleChange("parsedColumns", updated);
                      }}
                    />

                  </div>
                </div>
              );
            })}

          </div>
      )}

    </div>
  );
}