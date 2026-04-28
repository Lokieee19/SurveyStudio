export function signup(email, password) {
  const users = JSON.parse(localStorage.getItem("users") || "[]");

  const exists = users.find(u => u.email === email);
  if (exists) throw new Error("User already exists");

  users.push({ email, password });
  localStorage.setItem("users", JSON.stringify(users));
}

export function login(email, password) {
  const users = JSON.parse(localStorage.getItem("users") || "[]");

  const user = users.find(
    u => u.email === email && u.password === password
  );

  if (!user) throw new Error("Invalid credentials");

  localStorage.setItem("currentUser", JSON.stringify(user));
  return user;
}

export function logout() {
  localStorage.removeItem("currentUser");
}

export function getCurrentUser() {
  return JSON.parse(localStorage.getItem("currentUser"));
}