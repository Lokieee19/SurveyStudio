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

// ✅ Get current user
export function getUser() {
  return localStorage.getItem("user");
}

// ✅ Check login
export function isLoggedIn() {
  return !!localStorage.getItem("token");
}

// ✅ Logout
export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

// ✅ Auth header helper
export function getAuthHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}