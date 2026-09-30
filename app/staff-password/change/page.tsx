"use client";
import { FormEvent, useEffect, useState } from "react";
import styles from "../../staff-login/staff-login.module.css";

function homePath() { return window.location.hostname === "bo.pinohouse.art" ? "/bo" : "/dashboard"; }

export default function StaffPasswordChange() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/staff-auth/status", { cache: "no-store" })
      .then(async response => response.json() as Promise<{ data?: { authenticated?: boolean; passwordChangeRequired?: boolean } }>)
      .then(body => {
        if (!body.data?.authenticated) window.location.assign("/staff-login");
        else if (!body.data.passwordChangeRequired) window.location.assign(homePath());
        else setReady(true);
      })
      .catch(() => window.location.assign("/staff-login"));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    if (password !== confirmPassword) { setError("Mật khẩu xác nhận không khớp."); setBusy(false); return; }
    try {
      const response = await fetch("/api/staff-auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể đổi mật khẩu.");
      window.location.assign(homePath());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đổi mật khẩu.");
    } finally { setBusy(false); }
  }

  if (!ready) return <main className={styles.page}><form><span>PINO TEAM OS</span><h1>Đang kiểm tra phiên…</h1></form></main>;

  return <main className={styles.page}><form onSubmit={submit}>
    <span>PINO TEAM OS</span>
    <h1>Đổi mật khẩu tạm</h1>
    <p>Mật khẩu tạm chỉ dùng để xác minh lần này. Hãy đặt mật khẩu mới trước khi tiếp tục.</p>
    <label>Mật khẩu mới<input type="password" autoComplete="new-password" minLength={10} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required /></label>
    <label>Nhập lại mật khẩu<input type="password" autoComplete="new-password" minLength={10} maxLength={128} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required /></label>
    {error ? <div role="alert">{error}</div> : null}
    <button disabled={busy || password.length < 10 || confirmPassword.length < 10}>{busy ? "Đang đổi…" : "Đổi mật khẩu & tiếp tục"}</button>
    <small>Email + mật khẩu là credential Staff duy nhất.</small>
  </form></main>;
}
