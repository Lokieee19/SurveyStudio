import React, { useState } from "react";

import LeftPanel from "./panels/LeftPanel";
import RightPanel from "./panels/RightPanel";
import { styles } from "./styles/styles";
import { generateXML } from "./api";

/**
 * =========================================================
 * 🧠 MAIN APP (FINAL STABLE)
 * =========================================================
 */

export default function App() {

  const [questions, setQuestions] = useState([]);
  const [parsed, setParsed] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [xml, setXml] = useState("");
  const [loading, setLoading] = useState(false);
  const [activePreviewLabel, setActivePreviewLabel] = useState(null);

  const form = questions[activeIndex] || {};

  /**
   * =========================================================
   * 🔧 OPTION RULE ENGINE (SAFE)
   * =========================================================
   */
  const enforceOptionRules = (opt) => {

    const text = (opt.text || "").toLowerCase();
    let updated = { ...opt };

    if (text.includes("none")) {
      updated.anchor = true;
      updated.exclusive = true;
    }

    if (text.includes("other")) {
      updated.other = true;
      updated.exclusive = false;
    }

    if (opt.value === 97) {
      updated.anchor = true;
      updated.exclusive = true;
    }

    if (opt.value === 98) {
      updated.other = true;
      updated.exclusive = false;
    }

    if (opt.value === 99) {
      updated.anchor = true;
      updated.exclusive = true;
    }

    return updated;
  };

  /**
   * =========================================================
   * 🔢 UNIVERSAL PARSER
   * =========================================================
   */
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
          text: text.trim(),
        });

      });
  };

  /**
   * =========================================================
   * 🔄 SAFE UPDATE (USES _internalId)
   * =========================================================
   */
  const updateCurrentQuestion = (updatedForm) => {

    setQuestions(prev => {

      const updated = [...prev];

      updated[activeIndex] = {
        ...updated[activeIndex],
        ...updatedForm
      };

      return updated;
    });
  };

  /**
   * =========================================================
   * 🔁 HANDLE CHANGE (CRITICAL FIXES HERE)
   * =========================================================
   */
  const handleChange = (field, value) => {

    let updated = {
      ...form,
      [field]: value
    };

    /**
     * 🔥 TEXT → PARSED SYNC (FIXED)
     */
    if (field === "optionsText") {
      updated.parsedOptions = parseWithValues(value);
    }

    if (field === "rowsText") {
      updated.parsedRows = parseWithValues(value);
    }

    if (field === "columnsText") {
      updated.parsedColumns = parseWithValues(value);
    }

    updateCurrentQuestion(updated);
  };

  /**
   * =========================================================
   * 🎯 OPTION EDIT HANDLER
   * =========================================================
   */
  const handleOptionChange = (value, field, newVal) => {

    const updatedOptions = (form.parsedOptions || []).map(opt => {

      if (opt.value === value) {
        return enforceOptionRules({
          ...opt,
          [field]: newVal
        });
      }

      return opt;
    });

    updateCurrentQuestion({
      parsedOptions: updatedOptions
    });
  };
  /**
   * =========================================================
   * ➕ ADD / DELETE / DUPLICATE (INTERNAL ID SAFE)
   * =========================================================
   */
  const addQuestion = () => {

    const newQ = {
      id: `Q${questions.length + 1}`,
      _internalId: crypto.randomUUID(), // 🔥 critical
      title: "",
      description: "",
      type: "radio",

      optionsText: "",
      rowsText: "",
      columnsText: "",

      parsedOptions: [],
      parsedRows: [],
      parsedColumns: [],

      optionFlags: [],
      rowFlags: [],
      columnFlags: [],

      config: {}
    };

    setQuestions([...questions, newQ]);
    setActiveIndex(questions.length);
    setActivePreviewLabel(newQ._internalId);
  };

  const deleteQuestion = (index) => {

    const updated = questions.filter((_, i) => i !== index);

    setQuestions(updated);
    setActiveIndex(Math.max(0, index - 1));
    setActivePreviewLabel(updated[Math.max(0, index - 1)]?._internalId);
  };

  const duplicateQuestion = (index) => {

    const original = questions[index];

    const copy = {
      ...original,
      _internalId: crypto.randomUUID() // 🔥 avoid collision
    };

    setQuestions([...questions, copy]);
  };

  /**
   * =========================================================
   * 👁️ PREVIEW (FULLY FIXED)
   * =========================================================
   */
  const handlePreview = async () => {
    try {

      if (!questions.length) {
        alert("Add at least one question");
        return;
      }

      setLoading(true);

      const payloads = questions.map((q) => {

        const parsedOptions = parseWithValues(q.optionsText).map((opt, i) => ({
          ...opt,
          ...(q.optionFlags?.[i] || {})
        }));

        const parsedRows = parseWithValues(q.rowsText).map((row, i) => ({
          ...row,
          ...(q.rowFlags?.[i] || {})
        }));

        /**
         * 🔥 COLUMN FLAGS FIX (CRITICAL)
         */
        const parsedColumns = parseWithValues(q.columnsText).map((col, i) => ({
          ...col,
          ...(q.columnFlags?.[i] || {})
        }));

        return {
          ...q,
          parsedOptions,
          parsedRows,
          parsedColumns
        };
      });

      setParsed(payloads);

      /**
       * 🔥 USE INTERNAL ID
       */
      setActivePreviewLabel(payloads[0]?._internalId);

    } catch (err) {
      console.error(err);
      alert("Preview failed");
    } finally {
      setLoading(false);
    }
  };

  /**
   * =========================================================
   * 🧾 VALIDATION (ENHANCED)
   * =========================================================
   */
  const validateQuestion = (q) => {

    const errors = [];
    const options = q.parsedOptions || [];

    // ❌ multiple exclusive
    const exclusiveCount = options.filter(o => o.exclusive).length;
    if (exclusiveCount > 1) {
      errors.push("Multiple exclusive options not allowed");
    }

    // ❌ duplicate values
    const values = options.map(o => o.value);
    if (new Set(values).size !== values.length) {
      errors.push("Duplicate option values");
    }

    // ❌ empty options
    if (!options.length && ["radio", "checkbox"].includes(q.type)) {
      errors.push("Options cannot be empty");
    }

    // ❌ autosum validation
    if (q.type === "autosum" && !q.config?.amount) {
      errors.push("Autosum requires total amount");
    }

    return errors;
  };

  /**
   * =========================================================
   * 🧾 GENERATE XML (FINAL SAFE)
   * =========================================================
   */
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

      /**
       * 🔥 VALIDATION BEFORE GENERATION
       */
      for (let q of parsed) {
        const errors = validateQuestion(q);

        if (errors.length) {
          alert(`Error in ${q.id}:\n${errors.join("\n")}`);
          return;
        }
      }

      setLoading(true);

      const cleanQuestions = parsed.map((q) => {

        const options = (q.parsedOptions || []).map(o => ({
          value: o.value,
          text: o.text,
          anchor: !!o.anchor,
          exclusive: !!o.exclusive,
          terminate: !!o.terminate,
          other: !!o.other
        }));

        const rows = (q.parsedRows || []).map(r => ({
          value: r.value,
          text: r.text,
          description: r.description
        }));

        const columns = (q.parsedColumns || []).map(c => ({
          value: c.value,
          text: c.text,
          anchor: !!c.anchor,
          exclusive: !!c.exclusive
        }));

        return {
          ...q,
          options,
          rows,
          columns
        };
      });

      const xmlOutput = generateXML(cleanQuestions);
      setXml(xmlOutput);

    } catch (err) {
      console.error(err);
      alert("Generate failed");
    } finally {
      setLoading(false);
    }
  };

  /**
   * =========================================================
   * 🧱 UI RENDER
   * =========================================================
   */
  return (
    <div style={styles.page}>

      {/* =====================================================
          🧭 HEADER
      ===================================================== */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h2 style={styles.logo}>Survey Studio</h2>
          <div style={styles.subtitle}>
            Build, Preview & Generate XML
          </div>
        </div>
      </div>

      {/* =====================================================
          🧱 MAIN
      ===================================================== */}
      <div style={styles.main}>

        {/* =====================================================
            LEFT PANEL
        ===================================================== */}
        <LeftPanel
          styles={styles}
          questions={questions}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          setActivePreviewLabel={setActivePreviewLabel}
          addQuestion={addQuestion}
          deleteQuestion={deleteQuestion}
          duplicateQuestion={duplicateQuestion}
          form={form}
          handleChange={handleChange}
          handleOptionChange={handleOptionChange}
          enforceOptionRules={enforceOptionRules}
          setQuestions={setQuestions}
        />

        {/* =====================================================
            RIGHT PANEL
        ===================================================== */}
        <RightPanel
          styles={styles}
          parsed={parsed}
          questions={questions}
          activePreviewLabel={activePreviewLabel}
          handlePreview={handlePreview}
          handleGenerate={handleGenerate}
          xml={xml}
          loading={loading}
        />

      </div>
    </div>
  );
}