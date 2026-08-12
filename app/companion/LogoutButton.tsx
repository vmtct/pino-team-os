"use client";

export default function LogoutButton() {
  async function logout() { await fetch("/api/companion/login", { method: "DELETE" }); window.location.reload(); }
  return <button onClick={logout} style={{ border: "1px solid #d9d1c7", background: "transparent", borderRadius: 10, padding: "9px 12px", fontWeight: 700, cursor: "pointer" }}>Đăng xuất</button>;
}
