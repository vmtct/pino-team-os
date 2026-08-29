"use client";
import { FormEvent, useState } from "react";
import styles from "./staff-login.module.css";

export default function StaffLogin() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/staff-pin/login", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }),
      });
      const json = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(json.error?.message ?? "Đăng nhập thất bại");
      window.location.assign("/dashboard");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Đăng nhập thất bại"); }
    finally { setBusy(false); }
  }  return <main className={styles.page}><form onSubmit={submit}>
    <span>PINO TEAM OS</span><h1>Staff login</h1>
    <p>Email đăng nhập được lấy trực tiếp từ Cloudflare Access. Chỉ cần nhập PIN 6 số đã được Admin cấp.</p>
    <label>PIN<input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
    {error ? <div role="alert">{error}</div> : null}
    <button disabled={busy || pin.length !== 6}>{busy ? "Đang đăng nhập…" : "Vào TOS"}</button>
    <small>Cloudflare xác thực email; pino-core xác thực Staff + Access + PIN.</small>
  </form></main>;
}
