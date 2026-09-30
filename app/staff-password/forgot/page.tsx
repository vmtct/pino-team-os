"use client";
import { FormEvent, useState } from "react";
import styles from "../../staff-login/staff-login.module.css";

export default function ForgotStaffPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/staff-auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "Không thể gửi email đặt lại mật khẩu.");
      setMessage(body.message ?? "Nếu email đã đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gửi email đặt lại mật khẩu.");
    } finally {
      setBusy(false);
    }
  }

  return <main className={styles.page}><form onSubmit={submit}>
    <span>PINO TEAM OS</span>
    <h1>Quên mật khẩu</h1>
    <p>Nhập email Staff đã đăng ký. PINO sẽ gửi liên kết đặt lại mật khẩu nếu email hợp lệ.</p>
    <label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
    {message ? <div className={styles.success} role="status">{message}</div> : null}
    {error ? <div role="alert">{error}</div> : null}
    <button disabled={busy || !email.trim()}>{busy ? "Đang gửi…" : "Gửi link đặt lại"}</button>
    <a className={styles.recoveryLink} href="/staff-login">Quay lại đăng nhập</a>
    <small>Thông báo luôn giống nhau để bảo vệ thông tin tài khoản Staff.</small>
  </form></main>;
}
