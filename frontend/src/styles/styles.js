/**
 * =========================================================
 * 🎨 GLOBAL DESIGN SYSTEM (UPGRADED)
 * Decipher-level UI + scalable tokens
 * =========================================================
 */

export const styles = {

  /* =====================================================
     🎯 DESIGN TOKENS (EXPANDED)
  ===================================================== */

  colorBg: "#f8fafc",
  colorBgAlt: "#f1f5f9",
  colorPanel: "#ffffff",

  colorBorder: "#e2e8f0",
  colorBorderStrong: "#cbd5e1",

  colorText: "#0f172a",
  colorSub: "#64748b",
  colorMuted: "#94a3b8",

  primary: "#2563eb",
  primaryHover: "#1d4ed8",
  primaryLight: "#eff6ff",

  success: "#16a34a",
  successLight: "#dcfce7",

  danger: "#dc2626",
  dangerLight: "#fee2e2",

  warning: "#f59e0b",

  radiusSm: "6px",
  radiusMd: "10px",
  radiusLg: "14px",
  radiusXl: "18px",

  shadowXs: "0 1px 2px rgba(0,0,0,0.03)",
  shadowSm: "0 2px 8px rgba(0,0,0,0.05)",
  shadowMd: "0 8px 20px rgba(0,0,0,0.06)",
  shadowLg: "0 14px 30px rgba(0,0,0,0.08)",

  transition: "all 0.2s ease",

  /* =====================================================
     🧱 PAGE LAYOUT
  ===================================================== */

  page: {
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    fontFamily: "Inter, system-ui, sans-serif",
    background: "linear-gradient(180deg,#f8fafc 0%,#eef2ff 100%)",
    color: "#0f172a",
  },

  /* =====================================================
     🧭 HEADER
  ===================================================== */

  header: {
    height: "60px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    background: "rgba(255,255,255,0.9)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },

  headerLeft: {
    display: "flex",
    flexDirection: "column",
  },

  logo: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "700",
    color: "#2563eb",
    letterSpacing: "-0.2px",
  },

  subtitle: {
    fontSize: "11px",
    color: "#64748b",
  },

  /* =====================================================
     🧱 MAIN LAYOUT
  ===================================================== */

  main: {
    display: "grid",
    gridTemplateColumns: "580px minmax(0,1fr)",
    height: "calc(100vh - 60px)",
  },

  /* =====================================================
     📚 LEFT PANEL
  ===================================================== */

  leftPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "16px",
    overflowY: "auto",
    background: "#f8fafc",
    borderRight: "1px solid #e2e8f0",
  },

  /* =====================================================
     📊 RIGHT PANEL
  ===================================================== */

  rightPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    padding: "22px",
    overflow: "auto",
    background: "#f1f5f9",
  },

  /* =====================================================
     🧱 CARD SYSTEM (REFINED)
  ===================================================== */

  card: {
    background: "#ffffff",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
    transition: "all 0.2s ease",
  },

  cardHover: {
    boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
  },

  cardPrimary: {
    background: "#ffffff",
    borderRadius: "14px",
    padding: "18px",
    border: "1px solid #c7d2fe",
    boxShadow: "0 10px 28px rgba(37,99,235,0.12)",
  },

  previewCard: {
    background: "#ffffff",
    borderRadius: "18px",
    padding: "28px 32px",
    border: "1px solid #e2e8f0",
    maxWidth: "760px",
    margin: "0 auto",
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
  },

  xmlCard: {
    background: "#ffffff",
    borderRadius: "12px",
    padding: "14px",
    border: "1px solid #e2e8f0",
  },

  /* =====================================================
     🔤 TYPOGRAPHY
  ===================================================== */

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: "600",
    letterSpacing: "-0.1px",
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

  /* =====================================================
     🧾 FORM INPUT SYSTEM
  ===================================================== */

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
    transition: "all 0.2s ease",
  },

  inputFocus: {
    borderColor: "#2563eb",
    boxShadow: "0 0 0 2px rgba(37,99,235,0.15)",
  },

  select: {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "12px",
    background: "#fff",
  },

  textarea: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    minHeight: "140px",
    resize: "vertical",
    fontSize: "12px",
    background: "#fff",
  },

  /* =====================================================
     📐 GRID SYSTEM
  ===================================================== */

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

/* =====================================================
   🔘 BUTTON SYSTEM (UPGRADED)
===================================================== */

previewBtn: {
  flex: 1,
  padding: "12px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.2s ease",
},

previewBtnHover: {
  transform: "translateY(-1px)",
  boxShadow: "0 6px 14px rgba(37,99,235,0.25)"
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
  transition: "all 0.2s ease",
},

generateBtnHover: {
  transform: "translateY(-1px)",
  boxShadow: "0 6px 14px rgba(34,197,94,0.25)"
},

btnSecondary: {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  background: "#fff",
  cursor: "pointer",
  fontSize: "12px",
},

btnDanger: {
  padding: "10px",
  borderRadius: "8px",
  border: "none",
  background: "#dc2626",
  color: "#fff",
  cursor: "pointer",
},

/* =====================================================
   ⚡ ACTION BAR (STICKY)
===================================================== */

actionBar: {
  position: "sticky",
  top: "10px",
  zIndex: 50,

  display: "flex",
  gap: "12px",
  padding: "12px",

  background: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(10px)",

  borderRadius: "12px",
  border: "1px solid #e2e8f0",

  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
},

/* =====================================================
   📑 QUESTION TABS (UPGRADED UX)
===================================================== */

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

qTabHover: {
  background: "#f8fafc",
  borderColor: "#cbd5e1",
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

/* =====================================================
   🎛 OPTION EDITOR (PRO LEVEL)
===================================================== */

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
  minHeight: "120px",
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

/* =====================================================
   ☑️ CHECKBOX + INLINE CONTROLS
===================================================== */

checkbox: {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "12px",
},

checkInline: {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "11px",
},

inlineChecks: {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
},

settingGroup: {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
},

/* =====================================================
   🧰 BUTTON UTILITIES
===================================================== */

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

/* =====================================================
   🧮 AUTOSUM (UX POLISHED)
===================================================== */

autoWrapper: {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
},

autoHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "12px",
  fontWeight: "600",
},

autoRow: {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
},

autoIndex: {
  width: "28px",
  fontWeight: "600",
  fontSize: "12px",
  color: "#64748b",
},

autoInput: {
  width: "90px",
  padding: "8px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  fontSize: "12px",
},

autoTotalRow: {
  display: "flex",
  justifyContent: "space-between",
  marginTop: "8px",
  fontWeight: "600",
},

totalBox: {
  fontWeight: "700",
  fontSize: "13px",
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

/* =====================================================
   ⚡ SMART PASTE
===================================================== */

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

smartPasteBtnHover: {
  background: "#6d28d9",
},

/* =====================================================
   📋 COPY BLOCK (XML VIEWER)
===================================================== */

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

copyBtnHover: {
  background: "#f1f5f9",
},

copyCode: {
  margin: 0,
  padding: "14px",
  fontSize: "12px",
  background: "#020617",
  color: "#22c55e",
  overflowX: "auto",
  maxHeight: "320px",
  overflowY: "auto",
  lineHeight: "1.6",
},

/* =====================================================
   📊 XML OUTPUT
===================================================== */

xmlBox: {
  background: "#020617",
  color: "#22c55e",
  padding: "14px",
  borderRadius: "10px",
  fontSize: "11px",
  overflowX: "auto",
  lineHeight: "1.6",
},

/* =====================================================
   📌 STATES
===================================================== */

info: {
  background: "#e0f2fe",
  padding: "10px",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#075985",
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

/* =====================================================
   📏 UTILITIES
===================================================== */

divider: {
  height: "1px",
  background: "#e5e7eb",
  margin: "12px 0",
},

scrollY: {
  overflowY: "auto",
},

scrollX: {
  overflowX: "auto",
},

center: {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
},

spaceBetween: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
},

flexCol: {
  display: "flex",
  flexDirection: "column",
},

flexRow: {
  display: "flex",
  alignItems: "center",
},

gapSm: {
  gap: "6px",
},

gapMd: {
  gap: "10px",
},

gapLg: {
  gap: "16px",
},

/* =====================================================
   🧪 DEBUG (OPTIONAL)
===================================================== */

debugBox: {
  background: "#020617",
  color: "#22c55e",
  padding: "10px",
  borderRadius: "8px",
  fontSize: "11px",
  maxHeight: "200px",
  overflow: "auto",
},

};