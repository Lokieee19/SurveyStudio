import React, { useMemo, useState } from "react";

/**
 * =========================================================
 * 🧩 SECTION HEADERS
 * =========================================================
 */

export function SectionHeader({
  styles = {},
  title,
  subtitle
}) {
  return (
    <div style={styles.sectionHeader || { marginBottom: 10 }}>
      <div>
        <h3 style={styles.sectionTitle || { margin: 0 }}>
          {title}
        </h3>

        {subtitle && (
          <p style={styles.sectionSub || { margin: 0 }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export function SectionMini({
  styles = {},
  title
}) {
  return (
    <h4 style={styles.sectionMini || { marginTop: 12 }}>
      {title}
    </h4>
  );
}

/**
 * =========================================================
 * 🧾 INPUT
 * =========================================================
 */

export function Input({
  styles = {},
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  disabled = false
}) {
  return (
    <div style={styles.inputWrap || {}}>
      {label && (
        <label style={styles.label || {}}>
          {label}
        </label>
      )}

      <input
        type={type}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...(styles.input || {}),
          ...(disabled ? { opacity: 0.6, cursor: "not-allowed" } : {})
        }}
      />
    </div>
  );
}

/**
 * =========================================================
 * 🔽 SELECT
 * =========================================================
 */

export function Select({
  styles = {},
  label,
  value,
  onChange,
  options = [],
  disabled = false
}) {
  return (
    <div style={styles.inputWrap || {}}>
      {label && (
        <label style={styles.label || {}}>
          {label}
        </label>
      )}

      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...(styles.select || {}),
          ...(disabled ? { opacity: 0.6 } : {})
        }}
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

/**
 * =========================================================
 * 📝 TEXTAREA
 * =========================================================
 */

export function Textarea({
  styles = {},
  label,
  value,
  onChange,
  placeholder = "",
  rows = 6
}) {
  return (
    <div style={styles.inputWrap || {}}>
      {label && (
        <label style={styles.label || {}}>
          {label}
        </label>
      )}

      <textarea
        rows={rows}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...(styles.optionTextarea || {}),
          resize: "vertical"
        }}
      />
    </div>
  );
}

/**
 * =========================================================
 * ☑️ CHECKBOX
 * =========================================================
 */

export function Check({
  styles = {},
  label,
  checked,
  onChange,
  disabled = false
}) {
  return (
    <label
      style={{
        ...(styles.checkbox || {}),
        display: "flex",
        alignItems: "center",
        gap: "8px",
        ...(disabled ? { opacity: 0.6 } : {})
      }}
    >
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function CheckInline({
  styles = {},
  label,
  checked,
  onChange,
  disabled = false
}) {
  return (
    <label
      style={{
        ...(styles.checkInline || {}),
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "11px",
        ...(disabled ? { opacity: 0.5 } : {})
      }}
    >
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

/**
 * =========================================================
 * ℹ️ INFO BOX
 * =========================================================
 */

export function InfoBox({
  styles = {},
  text,
  type = "info" // info | success | warning | danger
}) {
  const bgMap = {
    info: "#e0f2fe",
    success: "#dcfce7",
    warning: "#fef3c7",
    danger: "#fee2e2"
  };

  const colorMap = {
    info: "#075985",
    success: "#166534",
    warning: "#92400e",
    danger: "#991b1b"
  };

  return (
    <div
      style={{
        ...(styles.info || {}),
        background: bgMap[type],
        color: colorMap[type],
        padding: "10px",
        borderRadius: "8px",
        fontSize: "12px",
        lineHeight: "1.5"
      }}
    >
      {text}
    </div>
  );
}

/**
 * =========================================================
 * 💤 EMPTY STATE
 * =========================================================
 */

export function EmptyState({
  styles = {},
  text = "No data available"
}) {
  return (
    <div
      style={{
        ...(styles.empty || {}),
        padding: "20px",
        textAlign: "center",
        fontSize: "13px",
        color: "#64748b"
      }}
    >
      {text}
    </div>
  );
}

/**
 * =========================================================
 * 📋 COPY BLOCK (FIXED)
 * =========================================================
 */

export function CopyBlock({
  styles = {},
  title = "Code",
  code = ""
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.error(err);
      alert("Copy failed");
    }
  };

  const formattedCode = useMemo(() => {
    if (!code) return "";

    try {
      return code
        .replace(/></g, ">\n<")
        .replace(/\n\s*\n/g, "\n")
        .trim();
    } catch {
      return code;
    }
  }, [code]);

  return (
    <div
      style={{
        ...(styles.copyBlock || {}),
        borderRadius: "12px",
        overflow: "hidden"
      }}
    >
      <div style={styles.copyHeader || {}}>
        <div style={styles.copyTitle || {}}>
          {"</>"} {title}
        </div>

        <button
          style={styles.copyBtn || {}}
          onClick={handleCopy}
        >
          {copied ? "✓ Copied" : "⧉ Copy"}
        </button>
      </div>

      <pre style={styles.copyCode || {}}>
        <code>{formattedCode}</code>
      </pre>
    </div>
  );
}

/**
 * =========================================================
 * 🔘 BUTTON (IMPROVED)
 * =========================================================
 */

export function Button({
  styles = {},
  label,
  onClick,
  variant = "primary", // primary | secondary | danger
  disabled = false
}) {
  const variants = {
    primary: {
      background: "#2563eb",
      color: "#fff"
    },
    secondary: {
      background: "#e2e8f0",
      color: "#0f172a"
    },
    danger: {
      background: "#dc2626",
      color: "#fff"
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 12px",
        borderRadius: "8px",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontSize: "12px",
        transition: "all 0.2s ease",
        ...variants[variant],
        ...(styles.button || {})
      }}
    >
      {label}
    </button>
  );
}

/**
 * =========================================================
 * 🧱 LAYOUT HELPERS
 * =========================================================
 */

/* ROW */
export function Row({
  gap = 10,
  align = "center",
  justify = "flex-start",
  children
}) {
  return (
    <div
      style={{
        display: "flex",
        gap,
        alignItems: align,
        justifyContent: justify
      }}
    >
      {children}
    </div>
  );
}

/* STACK */
export function Stack({
  gap = 10,
  children
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap
      }}
    >
      {children}
    </div>
  );
}

/* GRID */
export function Grid({
  columns = 2,
  gap = 10,
  children
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap
      }}
    >
      {children}
    </div>
  );
}

/**
 * =========================================================
 * 🎛 OPTION ROW
 * =========================================================
 */

export function OptionRow({
  styles = {},
  left,
  center,
  right
}) {
  return (
    <div
      style={{
        ...(styles.optionRow || {}),
        display: "flex",
        gap: "14px",
        padding: "12px",
        borderRadius: "10px",
        border: "1px solid #e2e8f0",
        background: "#f9fafb"
      }}
    >
      {left && (
        <div style={styles.optionIndex || { minWidth: 40 }}>
          {left}
        </div>
      )}

      {center && (
        <div style={styles.optionCenter || { flex: 1 }}>
          {center}
        </div>
      )}

      {right && (
        <div style={styles.optionRight || {}}>
          {right}
        </div>
      )}
    </div>
  );
}

/**
 * =========================================================
 * 🧾 INLINE FIELD
 * =========================================================
 */

export function InlineField({
  styles = {},
  label,
  children
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10
      }}
    >
      {label && (
        <label style={styles.label || {}}>
          {label}
        </label>
      )}

      <div style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

/**
 * =========================================================
 * 🧾 LABEL VALUE
 * =========================================================
 */

export function LabelValue({
  label,
  value,
  styles = {}
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div
        style={{
          fontSize: "11px",
          color: "#64748b"
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "13px",
          fontWeight: 500
        }}
      >
        {value || "-"}
      </div>
    </div>
  );
}

/**
 * =========================================================
 * ➖ DIVIDER
 * =========================================================
 */

export function Divider({
  margin = "12px 0"
}) {
  return (
    <div
      style={{
        height: 1,
        background: "#e5e7eb",
        margin
      }}
    />
  );
}

/**
 * =========================================================
 * 📏 SPACER
 * =========================================================
 */

export function Spacer({ size = 10 }) {
  return <div style={{ height: size }} />;
}

/**
 * =========================================================
 * 🧠 SAFE VALUE
 * =========================================================
 */

export function safeValue(val, fallback = "") {
  if (val === null || val === undefined) return fallback;
  return val;
}

/**
 * =========================================================
 * 🔄 CONTROLLED INPUTS
 * =========================================================
 */

export function ControlledInput({
  value,
  onChange,
  ...props
}) {
  return (
    <input
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    />
  );
}

export function ControlledTextarea({
  value,
  onChange,
  ...props
}) {
  return (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    />
  );
}

/**
 * =========================================================
 * 🎯 CLICKABLE ROW
 * =========================================================
 */

export function ClickableRow({
  styles = {},
  active,
  onClick,
  children
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: "10px",
        border: "1px solid #e2e8f0",
        background: active ? "#eff6ff" : "#fff",
        cursor: "pointer",
        transition: "0.2s",
        ...(active && {
          borderColor: "#2563eb"
        }),
        ...(styles.clickableRow || {})
      }}
    >
      {children}
    </div>
  );
}

/**
 * =========================================================
 * 🔔 BADGE
 * =========================================================
 */

export function Badge({
  label,
  color = "#2563eb"
}) {
  return (
    <span
      style={{
        fontSize: "10px",
        padding: "2px 6px",
        borderRadius: "6px",
        background: `${color}20`,
        color,
        fontWeight: 600
      }}
    >
      {label}
    </span>
  );
}

/**
 * =========================================================
 * 🧪 DEBUG BLOCK
 * =========================================================
 */

export function DebugBlock({
  data,
  title = "Debug"
}) {
  return (
    <div
      style={{
        background: "#020617",
        color: "#22c55e",
        padding: "10px",
        borderRadius: "8px",
        fontSize: "11px",
        overflow: "auto",
        maxHeight: 200
      }}
    >
      <div style={{ marginBottom: 6 }}>
        <strong>{title}</strong>
      </div>

      <pre>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}