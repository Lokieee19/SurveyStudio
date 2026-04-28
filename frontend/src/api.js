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
        // ✅ ALWAYS SEND STRING
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
      throw new Error("Preview API failed");
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

    // 🔐 GET TOKEN
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("User not logged in");
    }

    const res = await fetch(`${BASE_URL}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // 🔥 CRITICAL
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

    // 🔐 SESSION EXPIRED / INVALID TOKEN
    if (res.status === 401) {
      console.error("❌ Unauthorized - token invalid/expired");

      // 🔥 AUTO LOGOUT
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      throw new Error("Session expired. Please login again.");
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

// =============================
// 🔐 AUTH HELPERS
// =============================

// ✅ Check login
export function isLoggedIn() {
  return !!localStorage.getItem("token");
}

// ✅ Get current user (email)
export function getUser() {
  return localStorage.getItem("user");
}

// ✅ Logout
export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}