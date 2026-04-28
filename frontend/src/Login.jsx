import { useState, useEffect } from "react";
import { setAuth, getPrefillEmail, clearPrefillEmail } from "./auth";

const BASE_URL =
  import.meta.env.VITE_API_URL || "https://surveystudio.onrender.com";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // =============================
  // 🔹 PREFILL EMAIL (OPTIONAL)
  // =============================
  useEffect(() => {
    const savedEmail = getPrefillEmail();
    if (savedEmail) {
      setEmail(savedEmail);
      clearPrefillEmail();
    }
  }, []);

  // =============================
  // 🔐 HANDLE LOGIN
  // =============================
  const handleLogin = async () => {
    if (loading) return;

    try {
      if (!email || !password) {
        alert("Please enter email and password");
        return;
      }

      setLoading(true);

      const res = await fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
        }),
      });

      const data = await res.json();

      // 🔐 INVALID CREDENTIALS
      if (res.status === 401) {
        alert("Invalid email or password");
        return;
      }

      // 🔐 ACCESS BLOCKED
      if (res.status === 403) {
        alert("Access denied. Contact admin.");
        return;
      }

      if (!res.ok) {
        throw new Error(data.detail || "Login failed");
      }

      // ✅ SAVE AUTH
      setAuth(data.token, email.toLowerCase().trim());

      // ✅ UPDATE APP STATE
      onLogin(email.toLowerCase().trim());

    } catch (err) {
      console.error("❌ Login error:", err);
      alert(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Login</h2>

        <input
          style={styles.input}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin();
          }}
        />

        <button
          style={{
            ...styles.button,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {/* 🔒 Signup removed */}
        <p style={styles.note}>
          Access restricted to authorized users only
        </p>
      </div>
    </div>
  );
}

// =============================
// 🎨 STYLES
// =============================
const styles = {
  container: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f172a",
  },
  card: {
    background: "#1e293b",
    padding: "30px",
    borderRadius: "12px",
    width: "320px",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  title: {
    textAlign: "center",
  },
  input: {
    padding: "10px",
    borderRadius: "6px",
    border: "none",
    outline: "none",
  },
  button: {
    padding: "10px",
    borderRadius: "6px",
    border: "none",
    background: "#3b82f6",
    color: "#fff",
    fontWeight: "bold",
  },
  note: {
    fontSize: "12px",
    textAlign: "center",
    opacity: 0.7,
    marginTop: "8px",
  },
};