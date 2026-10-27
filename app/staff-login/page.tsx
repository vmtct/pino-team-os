"use client";
import { FormEvent, useEffect, useState } from "react";
import styles from "./staff-login.module.css";
import { safeHoReturnTo, HO_HOME_PATH } from "@/lib/ho-routes";

function homePath() { if (window.location.hostname === "tos.staging.pinohouse.art") return "/tos-v4"; if (window.location.hostname === "ho.staging.pinohouse.art") return safeHoReturnTo(new URLSearchParams(window.location.search).get("returnTo")) ?? HO_HOME_PATH; return ["bo.pinohouse.art", "bo.staging.pinohouse.art"].includes(window.location.hostname) ? "/bo" : "/dashboard"; }

function passwordChangePath() { const ret = window.location.hostname === "ho.staging.pinohouse.art" ? safeHoReturnTo(new URLSearchParams(window.location.search).get("returnTo")) : null; return "/staff-password/change" + (ret ? "?returnTo=" + encodeURIComponent(ret) : ""); }

export default function StaffLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const hostname = window.location.hostname;
    setShowRecovery(hostname === "tos.pinohouse.art" || hostname === "tos.staging.pinohouse.art" || hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".workers.dev"));
    void fetch("/api/staff-auth/status", { cache: "no-store" })
      .then(async response => response.json() as Promise<{ data?: { authenticated?: boolean; passwordChangeRequired?: boolean } }>)
      .then(body => { if (body.data?.authenticated) window.location.assign(body.data.passwordChangeRequired ? passwordChangePath() : homePath()); })
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
      const body = await response.json() as { data?: { passwordChangeRequired?: boolean }; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Đăng nhập thất bại");
      window.location.assign(body.data?.passwordChangeRequired ? passwordChangePath() : homePath());
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

    {showRecovery ? <a className={styles.recoveryLink} href="/staff-password/forgot">Quên mật khẩu?</a> : null}

    <small>Identity và session do PINO quản lý. Email + mật khẩu là credential Staff duy nhất.</small>
  </form></main>;
}
