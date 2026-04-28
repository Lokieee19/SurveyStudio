import { useState, useEffect, useMemo } from "react";

export default function SurveyPreview({ questions = [], previewKey, activeQuestionLabel }) {

  /* =============================
     🔥 CORE STATE
  ============================= */

  const [answers, setAnswers] = useState({});
  const [shuffledData, setShuffledData] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [terminated, setTerminated] = useState(false);
  const [showError, setShowError] = useState(false);
  const [fade, setFade] = useState(true);
  const normalize = (txt) => (txt || "").toLowerCase().trim();

  const questionMap = useMemo(() => {
    return Object.fromEntries(
      (questions || []).map(q => [normalize(q.label), q])
    );
  }, [questions]);

  /* =============================
     🔥 PIPE ENGINE (FIXED FULLY)
  ============================= */

  const resolvePipeText = (text, answers) => {
    if (!text) return text;

    return text.replace(/\[pipe:\s*(.*?)\]/gi, (_, rawKey) => {
      const key = normalize(rawKey);

      const val = answers[key];
      const qDef = questionMap[key];

      // MULTI SELECT
      if (Array.isArray(val) && qDef?.options) {
        return val
          .map(v => qDef.options.find(o => o.value === v)?.text)
          .filter(Boolean)
          .join(", ");
      }

      // SINGLE SELECT
      if (val !== undefined && qDef?.options) {
        const found = qDef.options.find(o => o.value === val);
        if (found) return found.text;
      }

      // GRID (FIXED)
      const matches = Object.entries(answers)
        .filter(([k]) => k.startsWith(`${key}_r`))
        .map(([k, v]) => {
          if (Array.isArray(v)) {
            return v
              .map(val => qDef?.columns?.find(c => c.value === val)?.text)
              .filter(Boolean)
              .join(", ");
          }

          const colDef = qDef?.columns?.find(c => c.value === Number(v));
          return colDef?.text || v;
        });

        if (matches.length) return matches.join(", ");

        // 🔥 fallback for non-option answers
        if (val !== undefined) {
          if (Array.isArray(val)) return val.join(", ");
          return String(val);
        }

        return "";
    });
  };

  /* =============================
     🔥 CONDITION ENGINE (FIXED)
  ============================= */

  const evaluateCond = (cond) => {
    if (!cond) return true;

    try {
      let exp = cond.toLowerCase();

      // ✅ GRID CELL
      exp = exp.replace(/(q\d+)\.r(\d+)\.c(\d+)/g, (_, q, r, c) => {
        return `(answers["${normalize(q)}_r${r}"] === ${Number(c)} || (answers["${normalize(q)}_r${r}"] || []).includes(${Number(c)}))`;
      });

      // ✅ DIRECT ROW (MOST IMPORTANT)
      exp = exp.replace(/(\w+)\.r(\d+)/g, (_, q, r) => {
        return `(answers["${normalize(q)}"] === ${Number(r)} || (answers["${normalize(q)}"] || []).includes(${Number(r)}))`;
      });

      // ✅ ROW == VALUE
      exp = exp.replace(/(q\d+)\.r(\d+)\s*==\s*(\d+)/g, (_, q, r, v) => {
        return `(answers["${normalize(q)}_r${r}"] === ${Number(v)})`;
      });

      // ✅ NORMAL ==
      exp = exp.replace(/(\w+)\s*==\s*(\d+)/g, (_, q, v) => {
        return `(answers["${normalize(q)}"] ?? null) === ${Number(v)}`;
      });

      // ✅ CONTAINS
      exp = exp.replace(/(\w+)\s+contains\s+([\d,]+)/g, (_, q, vals) => {
        const arr = vals.split(",").map(Number);
        return arr.map(v =>
          `(answers["${normalize(q)}"] || []).includes(${v})`
        ).join(" || ");
      });

      // ✅ IN
      exp = exp.replace(/(\w+)\s+in\s+([\d,]+)/g, (_, q, vals) => {
        const arr = vals.split(",").map(Number);
        return arr.map(v =>
          `(answers["${normalize(q)}"] ?? null) === ${v}`
        ).join(" || ");
      });

      // ✅ NOT
      exp = exp.replace(/not\((.*?)\)/g, (_, inner) => {
        return `!(${inner})`;
      });

      // ✅ AND/OR
      exp = exp
        .replace(/and/g, "&&")
        .replace(/or/g, "||");

      return Function("answers", `return (${exp})`)(answers);

    } catch (e) {
      console.error("COND ERROR:", cond, e);
      return false;
    }
  };

  /* =============================
     🔥 VISIBLE QUESTIONS
  ============================= */

  const visibleQuestions = useMemo(() => {
    return (questions || []).filter(q => {
      const cond =
        q?.routing?.cond ||
        q?.cond ||
        q?.logic;

      return evaluateCond(cond);
    });
  }, [questions, answers]);

  /* =============================
     🔥 ACTIVE JUMP (FIXED)
  ============================= */

  useEffect(() => {
    if (!activeQuestionLabel) return;

    const fullIndex = questions.findIndex(
      q => normalize(q.label) === normalize(activeQuestionLabel)
    );

    if (fullIndex === -1) return;

    const visibleIndex = visibleQuestions.findIndex(
      q => normalize(q.label) === normalize(questions[fullIndex].label)
    );

    if (visibleIndex !== -1) {
      setCurrentIndex(visibleIndex);
    }
  }, [activeQuestionLabel, questions, visibleQuestions]);

  if (terminated) {
    return <div>Survey Terminated</div>;
  }

  /* =============================
     🔥 CURRENT QUESTION
  ============================= */

  const currentQuestion = visibleQuestions[currentIndex];

  /* =============================
     🔥 INDEX SAFETY
  ============================= */

  useEffect(() => {
    if (!visibleQuestions[currentIndex]) {
      setCurrentIndex(0);
    }
  }, [visibleQuestions]);

  /* =============================
     🔥 SMART SHUFFLE
  ============================= */

  const smartShuffle = (arr = []) => {
    if (!arr?.length) return [];

    const normal = arr.filter(i => !i?.anchor);
    const anchors = arr.filter(i => i?.anchor);

    const shuffled = [...normal].sort(() => Math.random() - 0.5);

    return [...shuffled, ...anchors];
  };

  /* =============================
     🔥 SHUFFLE ENGINE
  ============================= */

  useEffect(() => {
    const newShuffle = {};

    (questions || []).forEach((q) => {
      const r = q.randomize || {};
      const key = normalize(q.label);

      newShuffle[key] = {
        options:
          ["radio", "checkbox"].includes(q.type)
            ? ((r.all || r.rows)
                ? smartShuffle(q.options || [])
                : q.options || [])
            : [],

        rows:
          (r.all || r.rows)
            ? smartShuffle(q.rows || [])
            : (q.rows || []),

        columns:
          (r.all || r.columns)
            ? smartShuffle(q.columns || [])
            : (q.columns || [])
      };
    });

    setShuffledData(newShuffle);

  }, [questions, previewKey]);

  /* =============================
     🔥 OPTION HANDLER (FIXED)
  ============================= */

  const handleOption = (qidRaw, value, type, isExclusive) => {
    const qid = normalize(qidRaw);

    setAnswers(prev => {
      const prevVals = prev[qid] || [];

      if (type === "checkbox") {

        if (isExclusive) {
          return { ...prev, [qid]: [value] };
        }

        // 🔥 REMOVE existing exclusive before adding normal
        const cleaned = prevVals.filter(v => {
          const opt = questionMap[qid]?.options?.find(o => o.value === v);
          return !opt?.exclusive;
        });

        const exists = cleaned.includes(value);

        return {
          ...prev,
          [qid]: exists
            ? cleaned.filter(v => v !== value)
            : [...cleaned, value],
        };
      }

      return { ...prev, [qid]: value };
    });
  };

  /* =============================
     🔥 GRID HANDLER (FIXED)
  ============================= */

  const handleGrid = (qidRaw, row, col, type) => {
    const qid = normalize(qidRaw);
    const key = `${qid}_r${row}`;

    setAnswers(prev => {

      if (type.includes("checkbox")) {
        let prevVals = prev[key] || [];

        const colDef = questionMap[qid]?.columns?.find(c => c.value === col);

        if (colDef?.exclusive) {
          return { ...prev, [key]: [col] };
        }

        // 🔥 REMOVE existing exclusive first
        const cleaned = prevVals.filter(v => {
          const cDef = questionMap[qid]?.columns?.find(c => c.value === v);
          return !cDef?.exclusive;
        });

        const exists = cleaned.includes(col);

        return {
          ...prev,
          [key]: exists
            ? cleaned.filter(v => v !== col)
            : [...cleaned, col],
        };
      }

      return { ...prev, [key]: col };
    });
  };

  /* =============================
     🔥 INPUT HANDLER (FIXED)
  ============================= */

  const handleInput = (qidRaw, row, value) => {
    const qid = normalize(qidRaw);

    setAnswers(prev => ({
      ...prev,
      [`${qid}_r${row}`]: value,
    }));
  };

  /* =============================
     🔥 VALIDATION (FIXED)
  ============================= */

  const canProceed = () => {
    const q = currentQuestion;
    if (!q) return true;

    const qid = normalize(q.label);
    const val = answers[qid];

    switch (q.type) {

      case "radio":
        return !!val;

      case "checkbox":
        return (val || []).length > 0;

      case "textarea":
      case "textarea_single":
        return !!answers[`${qid}_r1`]?.trim();

      case "number_single":
        return answers[`${qid}_r1`] !== undefined;

      case "radio_grid":
      case "card_radio":
        return (q.rows || []).every(r =>
          answers[`${qid}_r${r.value}`] !== undefined
        );

      case "checkbox_grid":
      case "card_checkbox":
        return (q.rows || []).every(r =>
          (answers[`${qid}_r${r.value}`] || []).length > 0
        );

      case "text_multi":
      case "number_multi":
      case "float_multi":
      case "textarea_multi":
        return (q.rows || []).every(r =>
          answers[`${qid}_r${r.value}`] !== undefined
        );

      default:
        return true;
    }
  };

  /* =============================
     🔥 NAVIGATION (FULL FIX)
  ============================= */

  const goNext = () => {
    if (terminated) return;

    if (!canProceed()) {
      setShowError(true);
      return;
    }

    setShowError(false);

    const current = visibleQuestions[currentIndex];
    if (!current) return;

    const qid = normalize(current.label);
    const condition = current?.cond || current?.logic;

    const val = answers[qid];

    const selectedOptions = Array.isArray(val)
      ? val
      : val !== undefined
        ? [val]
        : [];

    /* =============================
      🔥 OPTION LEVEL TERMINATE
    ============================= */

    const hasTerminate = (current.options || []).some(opt =>
      selectedOptions.includes(opt.value) && opt.terminate
    );

    if (hasTerminate) {
      setTerminated(true);
      return;
    }

    /* =============================
      🔥 QUESTION TERMINATE
    ============================= */

    if (current?.terminate && evaluateCond(condition)) {
      setTerminated(true);
      return;
    }

    /* =============================
      🔥 GOTO (FULL FIX)
    ============================= */

    if (current?.target && evaluateCond(condition)) {

      const fullIndex = questions.findIndex(
        q => normalize(q.label) === normalize(current.target)
      );

      if (fullIndex !== -1) {

        const visibleIndex = visibleQuestions.findIndex(
          q => normalize(q.label) === normalize(questions[fullIndex].label)
        );

        if (visibleIndex !== -1) {
          setCurrentIndex(visibleIndex);
          return;
        }

        const nextIndex = visibleQuestions.findIndex((_, i) => i > currentIndex);

        if (nextIndex !== -1) {
          setCurrentIndex(nextIndex);
        } else {
          setCurrentIndex(currentIndex);
        }

        return;
      }
    }

    /* =============================
      🔥 DEFAULT GOTO
    ============================= */

    if (!current?.target && current?.defaultTarget) {

      const fullIndex = questions.findIndex(
        q => normalize(q.label) === normalize(current.defaultTarget)
      );

      if (fullIndex !== -1) {

        const visibleIndex = visibleQuestions.findIndex(
          q => normalize(q.label) === normalize(questions[fullIndex].label)
        );

        if (visibleIndex !== -1) {
          setCurrentIndex(visibleIndex);
          return;
        }

        // 🔥 fallback
        setCurrentIndex(currentIndex + 1);
        return;
      }
    }

    /* =============================
      🔥 NORMAL FLOW
    ============================= */

    if (currentIndex < visibleQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /* =============================
     🔥 PREVIOUS
  ============================= */

  const goPrev = () => {
    setShowError(false);

    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /* =============================
     🔥 KEYBOARD NAVIGATION
  ============================= */

  useEffect(() => {
    const handleKey = (e) => {

      const activeTag = document.activeElement?.tagName;
      if (["INPUT", "TEXTAREA"].includes(activeTag)) return;

      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        goNext();
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);

  }, [currentIndex, answers]);

  /* =============================
     🔥 ERROR RESET
  ============================= */

  useEffect(() => {
    if (showError) {
      const t = setTimeout(() => setShowError(false), 2000);
      return () => clearTimeout(t);
    }
  }, [showError]);

  /* =============================
     🔥 SAFETY
  ============================= */

  if (!currentQuestion) return null;

  const q = currentQuestion;
  const t = q.type;

  const cached = shuffledData[normalize(q.label)] || {};

  const sortAnchors = (arr = []) => [
    ...arr.filter(o => !o.anchor),
    ...arr.filter(o => o.anchor),
  ];

  let options = cached.options ?? q.options ?? [];
  options = sortAnchors(options);

  const rows = sortAnchors(cached.rows ?? q.rows ?? []);
  const columns = sortAnchors(cached.columns ?? q.columns ?? []);

  const safeRows = rows.length > 0
    ? rows
    : [{ value: 1, text: " " }];

  const rankingList =
    answers[normalize(q.label)] ??
    (safeRows.length ? safeRows.map(r => ({ ...r })) : []);

  const total = Object.keys(answers)
    .filter(k => k.startsWith(normalize(q.label)))
    .reduce((sum, k) => sum + (Number(answers[k]) || 0), 0);

  /* =============================
     🔥 RENDER
  ============================= */

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>

        {/* ================= HTML ================= */}
        {q.type === "html" ? (
          <div style={{
            ...styles.card,
            ...(fade ? styles.fadeIn : styles.fadeOut)
          }}>
            <div
              style={styles.introText}
              dangerouslySetInnerHTML={{ __html: resolvePipeText(q.title, answers) }}
            />

            <div style={styles.navBar}>
              <button style={styles.navBtnPrimary} onClick={goNext}>
                Continue →
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ================= QUESTION CARD ================= */}
            <div style={{
              ...styles.card,
              ...(fade ? styles.fadeIn : styles.fadeOut)
            }}>

              {/* ===== HEADER ===== */}
              <div style={styles.header}>

                <div style={styles.qNumber}>
                  {q.label?.match(/q\d+/i)?.[0]?.toUpperCase() || `Q${currentIndex + 1}`}
                </div>

                <div style={styles.headerContent}>

                  {q.label && (
                    <div style={styles.qLabel}>
                      {q.label
                        .replace(/q\d+/i, "")
                        .replace(/_/g, " ")
                        .trim()
                        .replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                  )}

                  <div
                    style={styles.title}
                    dangerouslySetInnerHTML={{ __html: resolvePipeText(q.title, answers) }}
                  />

                  {q.description && (
                    <div
                      style={styles.description}
                      dangerouslySetInnerHTML={{ __html: resolvePipeText(q.description, answers) }}
                    />
                  )}

                  {q.comment && (
                    <div
                      style={styles.comment}
                      dangerouslySetInnerHTML={{ __html: resolvePipeText(q.comment, answers) }}
                    />
                  )}
                </div>
              </div>

              <div style={styles.divider} />

              {/* ================= RADIO / CHECKBOX ================= */}
              {["radio", "checkbox"].includes(t) && (
                <div style={styles.optionGroup}>
                  {options.map((opt) => {

                    const qid = normalize(q.label);
                    const val = answers[qid];

                    const isExclusive =
                      opt.exclusive || [97, 99].includes(opt.value);

                    const checked = t.includes("checkbox")
                      ? (val || []).includes(opt.value)
                      : val === opt.value;

                    const selectedValues = Array.isArray(val)
                      ? val
                      : val !== undefined
                        ? [val]
                        : [];

                    const hasExclusiveSelected =
                      selectedValues.some(v => {
                        const o = options.find(x => x.value === v);
                        return o?.exclusive || [97, 99].includes(o?.value);
                      });

                    return (
                      <div
                        key={opt.value}
                        style={{
                          ...styles.optionCard,
                          ...(checked ? styles.optionActive : {}),
                          ...(hasExclusiveSelected && !isExclusive ? {
                            opacity: 0.5,
                            pointerEvents: "none"
                          } : {}),
                          ...(isExclusive ? { fontStyle: "italic" } : {})
                        }}
                        onClick={() =>
                          handleOption(
                            q.label,
                            opt.value,
                            t.includes("checkbox") ? "checkbox" : "radio",
                            isExclusive
                          )
                        }
                      >
                        <div style={styles.optionIndicator}>
                          {checked && <div style={styles.dot} />}
                        </div>

                        <div style={styles.optionText}>
                          <div dangerouslySetInnerHTML={{ __html: resolvePipeText(opt.text, answers) }} />
                          {opt.description && (
                            <div style={styles.rowDesc}>{opt.description}</div>
                          )}
                        </div>

                        {opt.other && checked && (
                          <input
                            type="text"
                            placeholder="Specify..."
                            value={answers[`${normalize(q.label)}_other`] || ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setAnswers(prev => ({
                                ...prev,
                                [`${normalize(q.label)}_other`]: e.target.value
                              }))
                            }
                            style={styles.otherInput}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ================= GRID ================= */}
              {["radio_grid", "checkbox_grid", "card_radio", "card_checkbox"].includes(t) && (
                <div style={styles.matrixWrap}>

                  {safeRows.map((rItem) => {
                    const qid = normalize(q.label);
                    const key = `${qid}_r${rItem.value}`;
                    const val = answers[key];

                    return (
                      <div key={rItem.value} style={styles.matrixRow}>

                        <div style={styles.matrixLabel}>
                          <div dangerouslySetInnerHTML={{ __html: resolvePipeText(rItem.text, answers) }} />
                        </div>

                        <div
                          style={{
                            ...styles.matrixOptions,
                            gridTemplateColumns: `repeat(${columns.length || 1}, 1fr)`
                          }}
                        >
                          {(columns.length ? columns : [{ value: 1, text: "" }]).map((c) => {
                            const checked = t.includes("checkbox")
                              ? (val || []).includes(c.value)
                              : val === c.value;

                            return (
                              <div
                                key={c.value}
                                style={{
                                  ...styles.pill,
                                  ...(checked ? styles.pillActive : {})
                                }}
                                onClick={() =>
                                  handleGrid(q.label, rItem.value, c.value, t)
                                }
                              >
                                <span dangerouslySetInnerHTML={{ __html: c.text }} />
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

              {/* ================= RANKING ================= */}
              {t === "ranking" && (
                <div style={styles.rankingWrap}>
                  {rankingList.map((item, i) => (
                    <div key={i} style={styles.rankingItem}>

                      <div style={styles.rankLeft}>
                        <div style={styles.rankIndex}>{i + 1}</div>
                        <div dangerouslySetInnerHTML={{ __html: item.text }} />
                      </div>

                      <div style={styles.rankControls}>
                        <button
                          style={styles.rankBtn}
                          onClick={() => moveItem(q.label, rankingList, i, i - 1)}
                          disabled={i === 0}
                        >↑</button>

                        <button
                          style={styles.rankBtn}
                          onClick={() => moveItem(q.label, rankingList, i, i + 1)}
                          disabled={i === rankingList.length - 1}
                        >↓</button>
                      </div>

                    </div>
                  ))}
                </div>
              )}

              {/* ================= INPUT TYPES ================= */}
              {["number_single", "textarea_single"].includes(t) && (
                <div style={styles.inputSection}>
                  <input
                    type={t.includes("number") ? "number" : "text"}
                    value={answers[`${normalize(q.label)}_r1`] || ""}
                    onChange={(e) => handleInput(q.label, 1, e.target.value)}
                    style={styles.inputLarge}
                  />
                </div>
              )}

            </div>

            {/* ================= ERROR ================= */}
            {showError && (
              <div style={styles.errorBox}>
                Please answer this question before continuing
              </div>
            )}

            {/* ================= NAVIGATION ================= */}
            <div style={styles.navBar}>

              <button
                style={styles.navBtn}
                disabled={currentIndex === 0}
                onClick={goPrev}
              >
                ← Previous
              </button>

              <div style={styles.progress}>
                Question {currentIndex + 1} of {visibleQuestions.length}
              </div>

              <button
                style={styles.navBtnPrimary}
                onClick={goNext}
              >
                Next →
              </button>

            </div>
          </>
        )}

      </div>
    </div>
  );
}

const styles = {

  page: {
    background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
    minHeight: "100vh",
    padding: "50px 0",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },

  wrapper: {
    maxWidth: "880px",
    margin: "0 auto",
    padding: "0 16px"
  },

  card: {
    background: "#ffffff",
    borderRadius: "18px",
    padding: "30px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
    border: "1px solid #f1f5f9",
    transition: "all 0.25s ease"
  },

  fadeIn: {
    opacity: 1,
    transform: "translateY(0px)"
  },

  fadeOut: {
    opacity: 0,
    transform: "translateY(10px)"
  },

  header: {
    display: "flex",
    gap: "18px",
    alignItems: "flex-start"
  },

  qNumber: {
    minWidth: "56px",
    height: "56px",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    color: "#fff",
    fontWeight: 700,
    fontSize: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 16px rgba(99,102,241,0.3)"
  },

  headerContent: {
    flex: 1
  },

  qLabel: {
    fontSize: "12px",
    color: "#64748b",
    marginBottom: "6px",
    letterSpacing: "0.3px"
  },

  title: {
    fontSize: "22px",
    fontWeight: 600,
    lineHeight: 1.4,
    marginBottom: "6px",
    color: "#0f172a"
  },

  description: {
    fontSize: "14px",
    color: "#64748b",
    marginTop: "6px"
  },

  comment: {
    fontSize: "13px",
    color: "#94a3b8",
    marginTop: "4px"
  },

  divider: {
    height: "1px",
    background: "#e2e8f0",
    margin: "24px 0"
  },

  optionGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },

  optionCard: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "16px",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    background: "#fff"
  },

  optionActive: {
    border: "1px solid #6366f1",
    background: "#eef2ff",
    boxShadow: "0 4px 14px rgba(99,102,241,0.2)"
  },

  optionIndicator: {
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    border: "2px solid #6366f1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },

  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#6366f1"
  },

  optionText: {
    flex: 1,
    fontSize: "14px"
  },

  rowDesc: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "4px"
  },

  otherInput: {
    marginTop: "10px",
    width: "100%",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0"
  },

  matrixWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },

  matrixRow: {
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },

  matrixLabel: {
    fontWeight: 500,
    fontSize: "14px"
  },

  matrixOptions: {
    display: "grid",
    gap: "10px"
  },

  pill: {
    padding: "10px",
    textAlign: "center",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "0.2s",
    background: "#fff"
  },

  pillActive: {
    background: "#6366f1",
    color: "#fff",
    border: "1px solid #6366f1",
    boxShadow: "0 4px 10px rgba(99,102,241,0.3)"
  },

  textareaSection: {
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },

  textareaLargeFixed: {
    width: "100%",
    minHeight: "140px",
    padding: "14px",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    fontSize: "14px"
  },

  answerLabel: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#334155"
  },

  inputSection: {
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },

  inputLarge: {
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #e2e8f0"
  },

  autoWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },

  autoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "center"
  },

  autoTextWrap: {
    flex: 1
  },

  numberInput: {
    width: "120px",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0"
  },

  textInput: {
    width: "220px",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0"
  },

  textarea: {
    width: "260px",
    minHeight: "80px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    padding: "8px"
  },

  total: {
    marginTop: "10px",
    fontWeight: 600,
    color: "#0f172a"
  },

  navBar: {
    marginTop: "24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },

  navBtn: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer"
  },

  navBtnPrimary: {
    padding: "10px 18px",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(99,102,241,0.3)"
  },

  progress: {
    fontSize: "13px",
    color: "#64748b"
  },

  errorBox: {
    marginTop: "14px",
    padding: "12px",
    borderRadius: "10px",
    background: "#fee2e2",
    color: "#b91c1c",
    fontSize: "13px"
  }
};