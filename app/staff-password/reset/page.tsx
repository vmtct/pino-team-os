"use client";
import { FormEvent, useEffect, useState } from "react";
import styles from "../../staff-login/staff-login.module.css";

export default function ResetStaffPassword() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const resetToken = fragment.get("token") ?? "";
    setToken(resetToken);
    window.history.replaceState(null, "", "/staff-password/reset");
    if (!resetToken) setError("Liên kết đặt lại mật khẩu không hợp lệ.");
    setReady(true);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    if (password !== confirmPassword) { setError("Mật khẩu xác nhận không khớp."); setBusy(false); return; }
    try {
      const response = await fetch("/api/staff-auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "Không thể đặt lại mật khẩu.");
      setDone(true);
      setToken("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đặt lại mật khẩu.");
    } finally { setBusy(false); }
  }

  if (!ready) return <main className={styles.page}><form><span>PINO TEAM OS</span><h1>Đang kiểm tra liên kết…</h1></form></main>;
  if (done) return <main className={styles.page}><form>
    <span>PINO TEAM OS</span>
    <h1>Đã đặt lại mật khẩu</h1>
    <p>Mật khẩu mới đã có hiệu lực. Tất cả phiên đăng nhập Staff cũ đã bị thu hồi.</p>
    <a className={styles.primaryLink} href="/staff-login">Đăng nhập lại</a>
  </form></main>;

  return <main className={styles.page}><form onSubmit={submit}>
    <span>PINO TEAM OS</span>
    <h1>Đặt mật khẩu mới</h1>
    <p>Liên kết chỉ dùng một lần và có hiệu lực trong 30 phút.</p>
    <label>Mật khẩu mới<input type="password" autoComplete="new-password" minLength={10} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required /></label>
    <label>Nhập lại mật khẩu<input type="password" autoComplete="new-password" minLength={10} maxLength={128} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required /></label>
    {error ? <div role="alert">{error}</div> : null}
    <button disabled={busy || !token || password.length < 10 || confirmPassword.length < 10}>{busy ? "Đang cập nhật…" : "Đặt mật khẩu mới"}</button>
    <a className={styles.recoveryLink} href="/staff-login">Quay lại đăng nhập</a>
  </form></main>;
}
