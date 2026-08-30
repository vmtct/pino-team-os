"use client";
import Script from "next/script";
import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./staff-login.module.css";

type GoogleAccounts = { accounts: { id: {
  initialize(input: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(element: HTMLElement, options: Record<string, unknown>): void;
} } };
declare global { interface Window { google?: GoogleAccounts } }

export default function StaffLogin() {
  const [pin, setPin] = useState("");
  const [credential, setCredential] = useState("");
  const [clientId, setClientId] = useState("");
  const [scriptReady, setScriptReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const googleButton = useRef<HTMLElement | null>(null);

  useEffect(() => {
    fetch("/api/google-sso/config", { cache: "no-store" })
      .then(async response => {
        const json = await response.json() as { data?: { clientId?: string }; error?: { message?: string } };
        if (!response.ok || !json.data?.clientId) throw new Error(json.error?.message ?? "Google SSO chưa sẵn sàng");
        setClientId(json.data.clientId);
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : "Google SSO chưa sẵn sàng"));
  }, []);

  useEffect(() => {
    if (!scriptReady || !clientId || !googleButton.current || !window.google) return;
    window.google.accounts.id.initialize({ client_id: clientId, callback: response => setCredential(response.credential) });
    googleButton.current.replaceChildren();
    window.google.accounts.id.renderButton(googleButton.current, { theme: "outline", size: "large", width: 358 });
  }, [clientId, scriptReady]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/staff-pin/login", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential, pin }),
      });
      const json = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(json.error?.message ?? "Đăng nhập thất bại");
      window.location.assign("/dashboard");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Đăng nhập thất bại"); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}><form onSubmit={submit}>
    <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setScriptReady(true)} />
    <span>PINO TEAM OS</span><h1>Staff login</h1>
    <p>Đăng nhập Google bằng email staff, sau đó nhập PIN 6 số đã được Admin cấp.</p>
    <section ref={googleButton} aria-label="Google Sign-In" />
    <label>PIN<input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
    {error ? <div role="alert">{error}</div> : null}
    <button disabled={busy || pin.length !== 6 || !credential}>{busy ? "Đang đăng nhập…" : "Vào TOS"}</button>
    <small>Google xác thực email; pino-core xác thực Staff + Access + PIN.</small>
  </form></main>;
}
