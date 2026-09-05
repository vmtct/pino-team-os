"use client";
import { FormEvent, useEffect, useState } from "react";
import styles from "./staff-login.module.css";

export default function StaffLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/staff-auth/status", { cache: "no-store" })
      .then(async response => response.json() as Promise<{ data?: { authenticated?: boolean } }>)
      .then(body => { if (body.data?.authenticated) window.location.assign("/dashboard"); })
      .catch(() => undefined);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/staff-auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Đăng nhập thất bại");
      window.location.assign("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Đăng nhập thất bại");
    } finally { setBusy(false); }
  }

  return <main className={styles.page}><form onSubmit={submit}>
    <span>PINO TEAM OS</span>
    <h1>Staff login</h1>
    <p>Dùng email và mật khẩu PINO đã tạo khi đăng ký nhân sự.</p>
    <label>Email<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required /></label>
    <label>Mật khẩu<input type="password" autoComplete="current-password" minLength={10} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required /></label>
    {error ? <div role="alert">{error}</div> : null}
    <button disabled={busy || !email.trim() || password.length < 10}>{busy ? "Đang đăng nhập…" : "Vào PINO Team"}</button>
    <small>Identity và session do PINO quản lý. PIN chỉ dùng cho shared-device mode.</small>
  </form></main>;
}
