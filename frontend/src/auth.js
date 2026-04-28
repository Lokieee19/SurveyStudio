// =============================
// 🔐 AUTH STORAGE HELPERS
// =============================

// ✅ Save token + user
export function setAuth(token, email) {
  if (!token || !email) return;

  localStorage.setItem("token", token);
  localStorage.setItem("user", email);
}

// ✅ Get token
export function getToken() {
  return localStorage.getItem("token");
}

// ✅ Get current user (email)
export function getUser() {
  return localStorage.getItem("user");
}

// ✅ Check if logged in
export function isLoggedIn() {
  const token = getToken();
  return !!token;
}

// =============================
// 🔐 LOGOUT (SAFE RESET)
// =============================
export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("prefillEmail");
}

// =============================
// 🔐 AUTH HEADER HELPER
// =============================
export function getAuthHeader() {
  const token = getToken();

  if (!token) return {};

  return {
    Authorization: `Bearer ${token}`,
  };
}

// =============================
// 🔐 TOKEN VALIDITY CHECK (BASIC)
// =============================
export function isTokenValid() {
  const token = getToken();

  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));

    // exp is in seconds
    const isExpired = payload.exp * 1000 < Date.now();

    return !isExpired;
  } catch {
    return false;
  }
}

// =============================
// 🔐 OPTIONAL HELPERS (UX)
// =============================

// (You can remove these if signup is removed)

// ✅ Prefill email (legacy support)
export function setPrefillEmail(email) {
  if (!email) return;
  localStorage.setItem("prefillEmail", email);
}

export function getPrefillEmail() {
  return localStorage.getItem("prefillEmail") || "";
}

export function clearPrefillEmail() {
  localStorage.removeItem("prefillEmail");
}