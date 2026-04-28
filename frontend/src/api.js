const BASE_URL = "http://127.0.0.1:8000";

// =============================
// 🔍 PREVIEW API
// =============================
export async function previewQuestion(payload) {
  try {
    console.log("🔍 PREVIEW PAYLOAD:", payload);

    const res = await fetch(`${BASE_URL}/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    // 🔥 RAW RESPONSE LOG
    console.log("📥 PREVIEW RAW RESPONSE:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("❌ Invalid JSON from preview:", text);
      throw new Error("Invalid preview response");
    }

    // 🔥 HANDLE API FAILURE
    if (!res.ok) {
      console.error("❌ Preview API HTTP error:", text);
      throw new Error("Preview API failed");
    }

    // 🔥 HANDLE BACKEND ERROR
    if (data.error) {
      console.error("❌ Backend preview error:", data.error);
      console.error("🔍 DEBUG PAYLOAD:", payload);
      throw new Error(data.error);
    }

    return data;

  } catch (err) {
    console.error("❌ Preview request failed:", err);

    // SAFE FALLBACK
    return { questions: [] };
  }
}

// =============================
// ⚙️ GENERATE XML API
// =============================
export async function generateXML(payload) {
  try {
    console.log("🚀 GENERATE PAYLOAD:", payload);

    const res = await fetch(`${BASE_URL}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    // 🔥 RAW RESPONSE LOG
    console.log("📥 GENERATE RAW RESPONSE:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("❌ Invalid JSON from generate:", text);
      throw new Error("Invalid generate response");
    }

    // 🔥 HANDLE HTTP ERROR
    if (!res.ok) {
      console.error("❌ Generate API HTTP error:", text);
      throw new Error(data?.error || "Generate API failed");
    }

    // 🔥 HANDLE BACKEND ERROR
    if (data.error) {
      console.error("❌ Backend generate error:", data.error);

      // 🔍 SHOW FULL PAYLOAD (CRITICAL FOR DEBUG)
      console.error("🔍 DEBUG PAYLOAD:", payload);

      throw new Error(data.error);
    }

    return data;

  } catch (err) {
    console.error("❌ Generate request failed:", err);

    // SAFE FALLBACK
    return { xml: "" };
  }
}