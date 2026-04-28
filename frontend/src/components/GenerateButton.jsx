import { useState } from "react";

export default function GenerateButton({ onClick, loading, disabled }) {
  const [hover, setHover] = useState(false);

  const isDisabled = loading || disabled;

  return (
    <button
      onClick={(e) => {
        if (isDisabled) return;
        onClick(e);
      }}
      disabled={isDisabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...styles.button,
        ...(isDisabled ? styles.loading : {}),
        ...(hover && !isDisabled ? styles.hover : {}),
      }}
    >
      {/* ICON + TEXT */}
      <span style={styles.content}>
        <span style={styles.icon}>
          {loading ? "⏳" : "⚡"}
        </span>

        {loading ? "Generating XML..." : "Generate XML"}
      </span>

      {/* GLOW EFFECT */}
      {!isDisabled && (
        <span
          style={{
            ...styles.glow,
            ...(hover ? { opacity: 1 } : {})
          }}
        />
      )}
    </button>
  );
}

const styles = {
  button: {
    position: "relative",
    flex: 1,
    padding: "12px 16px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    overflow: "hidden",

    background:
      "linear-gradient(135deg, #22c55e, #16a34a)",

    color: "#ffffff",
    fontWeight: 600,
    fontSize: "14px",
    letterSpacing: "0.3px",

    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",

    boxShadow:
      "0 6px 20px rgba(34, 197, 94, 0.35)",

    transition: "all 0.2s ease",
  },

  hover: {
    transform: "translateY(-1px) scale(1.01)",
    boxShadow:
      "0 10px 30px rgba(34, 197, 94, 0.5)",
  },

  loading: {
    background: "#334155",
    cursor: "not-allowed",
    opacity: 0.8,
    boxShadow: "none",
  },

  content: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  icon: {
    fontSize: "16px",
    display: "flex",
    alignItems: "center",
  },

  /* GLOW ANIMATION */
  glow: {
    position: "absolute",
    width: "120%",
    height: "120%",
    top: "-10%",
    left: "-10%",
    background:
      "radial-gradient(circle, rgba(255,255,255,0.25), transparent 60%)",
    opacity: 0,
    transition: "opacity 0.3s ease",
    pointerEvents: "none",
  },
};