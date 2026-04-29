import { useState, useEffect } from "react";
import { setAuth, getPrefillEmail, clearPrefillEmail } from "./auth";

const BASE_URL =
  import.meta.env.VITE_API_URL || "https://surveystudio.onrender.com";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = getPrefillEmail();
    if (savedEmail) {
      setEmail(savedEmail);
      clearPrefillEmail();
    }
  }, []);

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

      if (res.status === 401) {
        alert("Invalid email or password");
        return;
      }

      if (res.status === 403) {
        alert("Access denied. Contact admin.");
        return;
      }

      if (!res.ok) {
        throw new Error(data.detail || "Login failed");
      }

      setAuth(data.token, email.toLowerCase().trim());
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
      <div style={styles.bgGlow} />

      <div style={styles.card}>
        <h2 style={styles.title}>Survey Studio</h2>
        <p style={styles.subtitle}>Secure Access Portal</p>

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
          }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p style={styles.note}>
          Access restricted to authorized users only
        </p>
      </div>
    </div>
  );
}

// =============================
// 🎨 ELITE C5i STYLE
// =============================
const styles = {
  container: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    background: `
      radial-gradient(circle at 20% 20%, rgba(139,92,246,0.25), transparent 40%),
      radial-gradient(circle at 80% 0%, rgba(124,58,237,0.2), transparent 40%),
      linear-gradient(180deg, #05010f 0%, #0b0620 100%)
    `,

    position: "relative",
    overflow: "hidden",
  },

  bgGlow: {
    position: "absolute",
    width: "500px",
    height: "500px",

    background: "radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)",

    filter: "blur(80px)",
    zIndex: 0,
  },

  card: {
    position: "relative",
    zIndex: 1,

    width: "340px",

    padding: "28px",

    borderRadius: "20px",

    background: "rgba(20,10,50,0.7)",
    backdropFilter: "blur(20px)",

    border: "1px solid rgba(139,92,246,0.25)",

    boxShadow: "0 20px 60px rgba(0,0,0,0.6)",

    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },

  title: {
    textAlign: "center",
    margin: 0,

    fontSize: "20px",
    fontWeight: "700",

    background: "linear-gradient(90deg,#c4b5fd,#8b5cf6)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },

  subtitle: {
    textAlign: "center",
    fontSize: "12px",
    color: "#a1a1aa",
    marginBottom: "10px",
  },

  input: {
    padding: "12px",

    borderRadius: "12px",

    border: "1px solid rgba(139,92,246,0.2)",

    background: "rgba(10,5,30,0.9)",
    color: "#f1f5f9",

    fontSize: "13px",

    outline: "none",

    transition: "all 0.2s ease",
  },

  button: {
    padding: "12px",

    borderRadius: "12px",
    border: "none",

    background: "linear-gradient(135deg,#7c3aed,#8b5cf6)",
    color: "#fff",

    fontWeight: "600",

    marginTop: "6px",

    boxShadow: "0 10px 30px rgba(139,92,246,0.4)",

    cursor: "pointer",
  },

  note: {
    fontSize: "11px",
    textAlign: "center",
    color: "#9ca3af",
    marginTop: "10px",
  },
};