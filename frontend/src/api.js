import { getAuthHeader, logout } from "./auth";

// =============================
// 🔐 CONFIG
// =============================
const BASE_URL =
  import.meta.env.VITE_API_URL || "https://surveystudio.onrender.com";

// =============================
// 🔍 PREVIEW API (PUBLIC)
// =============================
export async function previewQuestion(payload) {
  try {
    if (import.meta.env.DEV) {
      console.log("🔍 PREVIEW PAYLOAD:", payload);
    }

    const res = await fetch(`${BASE_URL}/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text:
          typeof payload === "string"
            ? payload
            : JSON.stringify(payload, null, 2),
      }),
    });

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("❌ Invalid JSON from preview:", text);
      return { questions: [] };
    }

    // 🔐 ACCESS BLOCKED (rare but safe)
    if (res.status === 403) {
      alert("Access denied.");
      return { questions: [] };
    }

    if (!res.ok) {
      throw new Error(data?.error || "Preview API failed");
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return data;

  } catch (err) {
    console.error("❌ Preview request failed:", err);
    return { questions: [] };
  }
}

// =============================
// ⚙️ GENERATE XML API (PROTECTED)
// =============================
export async function generateXML(payload) {
  try {
    if (import.meta.env.DEV) {
      console.log("🚀 GENERATE PAYLOAD:", payload);
    }

    const res = await fetch(`${BASE_URL}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(), // ✅ attach token
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("❌ Invalid JSON from generate:", text);
      throw new Error("Invalid generate response");
    }

    // 🔐 TOKEN EXPIRED
    if (res.status === 401) {
      console.warn("⚠️ Session expired");
      logout();
      alert("Session expired. Please login again.");
      window.location.reload();
      return { xml: "" };
    }

    // 🔐 ACCESS BLOCKED
    if (res.status === 403) {
      console.warn("⚠️ Access denied");
      logout();
      alert("Access denied.");
      window.location.reload();
      return { xml: "" };
    }

    // ❌ HTTP ERROR
    if (!res.ok) {
      throw new Error(data?.error || "Generate API failed");
    }

    // ❌ BACKEND ERROR
    if (data.error) {
      throw new Error(data.error);
    }

    return data;

  } catch (err) {
    console.error("❌ Generate request failed:", err);
    return { xml: "" };
  }
}