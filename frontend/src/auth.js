// =============================
// 🔐 AUTH STORAGE HELPERS
// =============================

// ✅ Save token + user
export function setAuth(token, email) {
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
  return !!getToken();
}

// ✅ Logout user
export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

// =============================
// 🔐 AUTH HEADER HELPER
// =============================

export function getAuthHeader() {
  const token = getToken();
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

// =============================
// 🔐 OPTIONAL HELPERS (NICE UX)
// =============================

// ✅ Prefill email (for signup → login flow)
export function setPrefillEmail(email) {
  localStorage.setItem("prefillEmail", email);
}

export function getPrefillEmail() {
  return localStorage.getItem("prefillEmail") || "";
}

export function clearPrefillEmail() {
  localStorage.removeItem("prefillEmail");
}