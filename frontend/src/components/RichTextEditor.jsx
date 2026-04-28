import React, { useEffect, useRef } from "react";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";

/**
 * =========================================================
 * 🧠 EXTENSIONS CONFIG
 * =========================================================
 */

const CustomTextAlign = TextAlign.configure({
  types: ["heading", "paragraph"]
});

const CustomLink = Link.configure({
  openOnClick: false,
  autolink: true,
  linkOnPaste: true
});

/**
 * =========================================================
 * ✍️ RICH TEXT EDITOR (FIXED)
 * =========================================================
 */

export default function RichTextEditor({
  styles = {},
  label,
  value,
  onChange,
  placeholder = "Write something..."
}) {

  const debounceRef = useRef(null);

  /**
   * =========================================================
   * 🧠 EDITOR INSTANCE
   * =========================================================
   */
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      CustomLink,
      CustomTextAlign,
      Placeholder.configure({ placeholder })
    ],

    content: value || "",

    onUpdate({ editor }) {
      const html = editor.getHTML();

      // 🔥 debounce to prevent heavy rerenders
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange(html);
      }, 150);
    }
  });

  /**
   * =========================================================
   * 🔄 SYNC EXTERNAL VALUE (SAFE)
   * =========================================================
   */
  useEffect(() => {
    if (!editor) return;

    const current = editor.getHTML();
    const incoming = value || "";

    if (current !== incoming) {
      editor.commands.setContent(incoming, false);
    }

  }, [value, editor]);

  if (!editor) return null;

  /**
   * =========================================================
   * 🧱 UI
   * =========================================================
   */
  return (
    <div style={styles.inputWrap || {}}>

      {label && (
        <label style={styles.label || {}}>
          {label}
        </label>
      )}

      <div style={{
        ...defaultStyles.container,
        ...(styles.richEditor || {})
      }}>

        {/* TOOLBAR */}
        <Toolbar editor={editor} styles={styles} />

        {/* EDITOR */}
        <EditorContent
          editor={editor}
          style={{
            ...defaultStyles.content,
            ...(styles.richContent || {})
          }}
        />

      </div>
    </div>
  );
}

/**
 * =========================================================
 * 🎛 TOOLBAR (SAFE + CLEAN)
 * =========================================================
 */

function Toolbar({ editor, styles }) {
  if (!editor) return null;

  return (
    <div style={{
      ...defaultStyles.toolbar,
      ...(styles.toolbar || {})
    }}>

      {/* =====================================================
          🅰️ TEXT FORMATTING
      ===================================================== */}
      <Group>

        <Btn
          active={editor.isActive("bold")}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          onClick={() =>
            editor.chain().focus().toggleBold().run()
          }
          label="B"
        />

        <Btn
          active={editor.isActive("italic")}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          onClick={() =>
            editor.chain().focus().toggleItalic().run()
          }
          label="I"
        />

        <Btn
          active={editor.isActive("underline")}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
          onClick={() =>
            editor.chain().focus().toggleUnderline().run()
          }
          label="U"
        />

      </Group>

      {/* =====================================================
          🔠 HEADINGS
      ===================================================== */}
      <Group>
        {[1, 2, 3].map(level => (
          <Btn
            key={level}
            active={editor.isActive("heading", { level })}
            disabled={!editor.can().chain().focus().toggleHeading({ level }).run()}
            onClick={() =>
              editor.chain()
                .focus()
                .toggleHeading({ level })
                .run()
            }
            label={`H${level}`}
          />
        ))}
      </Group>

      {/* =====================================================
          📋 LISTS
      ===================================================== */}
      <Group>

        <Btn
          active={editor.isActive("bulletList")}
          disabled={!editor.can().chain().focus().toggleBulletList().run()}
          onClick={() =>
            editor.chain()
              .focus()
              .toggleBulletList()
              .run()
          }
          label="•"
        />

        <Btn
          active={editor.isActive("orderedList")}
          disabled={!editor.can().chain().focus().toggleOrderedList().run()}
          onClick={() =>
            editor.chain()
              .focus()
              .toggleOrderedList()
              .run()
          }
          label="1."
        />

      </Group>

      {/* =====================================================
          📐 ALIGNMENT
      ===================================================== */}
      <Group>

        <Btn
          active={editor.isActive({ textAlign: "left" })}
          disabled={!editor.can().chain().focus().setTextAlign("left").run()}
          onClick={() =>
            editor.chain()
              .focus()
              .setTextAlign("left")
              .run()
          }
          label="L"
        />

        <Btn
          active={editor.isActive({ textAlign: "center" })}
          disabled={!editor.can().chain().focus().setTextAlign("center").run()}
          onClick={() =>
            editor.chain()
              .focus()
              .setTextAlign("center")
              .run()
          }
          label="C"
        />

        <Btn
          active={editor.isActive({ textAlign: "right" })}
          disabled={!editor.can().chain().focus().setTextAlign("right").run()}
          onClick={() =>
            editor.chain()
              .focus()
              .setTextAlign("right")
              .run()
          }
          label="R"
        />

      </Group>

      {/* =====================================================
          🔗 LINKS (IMPROVED)
      ===================================================== */}
      <Group>

        <Btn
          onClick={() => {
            const url = window.prompt("Enter URL");

            if (!url) return;

            try {
              new URL(url);
            } catch {
              alert("Invalid URL");
              return;
            }

            editor.chain()
              .focus()
              .extendMarkRange("link")
              .setLink({ href: url })
              .run();
          }}
          label="🔗"
        />

        <Btn
          disabled={!editor.isActive("link")}
          onClick={() =>
            editor.chain()
              .focus()
              .unsetLink()
              .run()
          }
          label="❌"
        />

      </Group>

      {/* =====================================================
          🧹 CLEAR FORMATTING
      ===================================================== */}
      <Group>

        <Btn
          disabled={!editor.can().chain().focus().clearNodes().run()}
          onClick={() =>
            editor.chain()
              .focus()
              .clearNodes()
              .unsetAllMarks()
              .run()
          }
          label="Clear"
        />

      </Group>

    </div>
  );
}

/**
 * =========================================================
 * 🔘 BUTTON
 * =========================================================
 */

function Btn({
  active,
  disabled,
  onClick,
  label
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // 🔥 prevent focus loss
      onClick={onClick}
      disabled={disabled}
      style={{
        ...defaultStyles.btn,
        ...(active ? defaultStyles.btnActive : {}),
        ...(disabled ? defaultStyles.btnDisabled : {})
      }}
    >
      {label}
    </button>
  );
}

/**
 * =========================================================
 * 📦 GROUP WRAPPER
 * =========================================================
 */

function Group({ children }) {
  return (
    <div style={defaultStyles.group}>
      {children}
    </div>
  );
}

/**
 * =========================================================
 * 🎨 DEFAULT STYLES (REFINED)
 * =========================================================
 */

const defaultStyles = {

  /* ================= CONTAINER ================= */

  container: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    overflow: "hidden",
    background: "#ffffff",
    transition: "all 0.2s ease"
  },

  /* ================= TOOLBAR ================= */

  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    padding: "6px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc"
  },

  group: {
    display: "inline-flex",
    gap: "4px",
    paddingRight: "6px",
    marginRight: "6px",
    borderRight: "1px solid #e2e8f0"
  },

  /* ================= BUTTON ================= */

  btn: {
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    fontSize: "12px",
    cursor: "pointer",
    transition: "all 0.15s ease",
    color: "#0f172a"
  },

  btnActive: {
    background: "#2563eb",
    color: "#ffffff",
    borderColor: "#2563eb"
  },

  btnDisabled: {
    opacity: 0.4,
    cursor: "not-allowed"
  },

  /* ================= EDITOR ================= */

  content: {
    minHeight: "140px",
    padding: "14px",
    outline: "none",
    fontSize: "13px",
    lineHeight: "1.7",
    color: "#0f172a",
    background: "#ffffff"
  }

};

/**
 * =========================================================
 * ✨ UX NOTES
 * =========================================================
 */

/**
 * You can extend this editor further with:
 *
 * - Image uploads
 * - Mentions (@user)
 * - Variables (survey piping)
 * - HTML sanitization layer
 *
 * This setup is already clean and extensible.
 */