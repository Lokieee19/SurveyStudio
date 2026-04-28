import { useState } from "react";

const BASE_URL = "https://surveystudio.onrender.com";

export default function Signup({ setShowSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    try {
      if (!email || !password) {
        alert("Please enter email and password");
        return;
      }

      setLoading(true);

      const res = await fetch(`${BASE_URL}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Signup failed");
      }

      alert("✅ Account created! Please login.");
      setShowSignup(false);

    } catch (err) {
      console.error("❌ Signup error:", err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Create Account</h2>

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
        />

        <button
          style={styles.button}
          onClick={handleSignup}
          disabled={loading}
        >
          {loading ? "Creating..." : "Sign Up"}
        </button>

        <p style={styles.switchText}>
          Already have an account?{" "}
          <span
            style={styles.link}
            onClick={() => setShowSignup(false)}
          >
            Login
          </span>
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
    background: "#22c55e",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },
  switchText: {
    fontSize: "14px",
    textAlign: "center",
  },
  link: {
    color: "#38bdf8",
    cursor: "pointer",
  },
};