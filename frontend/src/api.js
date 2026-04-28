import { getAuthHeader, logout } from "./auth";

const BASE_URL = "https://surveystudio.onrender.com";

// =============================
// 🔍 PREVIEW API (PUBLIC)
// =============================
export async function previewQuestion(payload) {
  try {
    console.log("🔍 PREVIEW PAYLOAD:", payload);

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
    console.log("📥 PREVIEW RAW RESPONSE:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("❌ Invalid JSON from preview:", text);
      throw new Error("Invalid preview response");
    }

    if (!res.ok) {
      console.error("❌ Preview API HTTP error:", text);
      throw new Error(data?.error || "Preview API failed");
    }

    if (data.error) {
      console.error("❌ Backend preview error:", data.error);
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
    console.log("🚀 GENERATE PAYLOAD:", payload);

    const res = await fetch(`${BASE_URL}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(), // ✅ token automatically added
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    console.log("📥 GENERATE RAW RESPONSE:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("❌ Invalid JSON from generate:", text);
      throw new Error("Invalid generate response");
    }

    // 🔐 TOKEN EXPIRED / INVALID
    if (res.status === 401) {
      console.error("❌ Unauthorized - token expired");

      logout(); // ✅ clear session automatically
      alert("Session expired. Please login again.");

      window.location.reload(); // 🔄 force back to login

      return { xml: "" };
    }

    // ❌ HTTP ERROR
    if (!res.ok) {
      console.error("❌ Generate API HTTP error:", text);
      throw new Error(data?.error || "Generate API failed");
    }

    // ❌ BACKEND ERROR
    if (data.error) {
      console.error("❌ Backend generate error:", data.error);
      console.error("🔍 DEBUG PAYLOAD:", payload);
      throw new Error(data.error);
    }

    return data;

  } catch (err) {
    console.error("❌ Generate request failed:", err);
    return { xml: "" };
  }
}