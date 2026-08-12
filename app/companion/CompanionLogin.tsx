"use client";

import { FormEvent, useState } from "react";

export default function CompanionLogin() {
  const [username, setUsername] = useState("companion");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/companion/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        const messages: Record<string, string> = { invalid_credentials: "Sai tài khoản hoặc mật khẩu.", staff_not_authorized: "Tài khoản chưa được cấp quyền Companion.", disabled: "Companion hiện đang tạm tắt." };
        throw new Error(messages[result.error] || "Không thể đăng nhập.");
      }
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể đăng nhập."); }
    finally { setLoading(false); }
  }

  return <main className="main"><div className="page" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><section className="card" style={{ width: "min(460px, 100%)", padding: 32 }}><div className="eyebrow">PINO HOUSE · COMPANION</div><h1>Hộ Linh</h1><p className="subtitle">Không gian quan sát và đồng hành cùng hành trình của từng bạn nhỏ.</p><form onSubmit={submit} style={{ display: "grid", gap: 14 }}><label style={{ display: "grid", gap: 7 }}><span style={{ fontWeight: 700 }}>Tài khoản</span><input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" style={{ padding: "13px 14px", borderRadius: 10, border: "1px solid #d9d1c7" }} /></label><label style={{ display: "grid", gap: 7 }}><span style={{ fontWeight: 700 }}>Mật khẩu</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" style={{ padding: "13px 14px", borderRadius: 10, border: "1px solid #d9d1c7" }} /></label>{error ? <div style={{ padding: 12, borderRadius: 10, background: "#fff1f2", color: "#991b1b" }}>{error}</div> : null}<button className="button" disabled={loading} style={{ width: "100%", marginTop: 4 }}>{loading ? "Đang xác nhận..." : "Đăng nhập"}</button></form></section></div></main>;
}
