"use client";
import { FormEvent, useEffect, useState } from "react";
import styles from "./staff-login.module.css";

type PinState = "LOADING" | "ROTATION_REQUIRED" | "ACTIVE" | "NOT_CONFIGURED";

export default function StaffLogin() {
  const [state, setState] = useState<PinState>("LOADING");
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/staff-pin/status", { cache: "no-store" }).then(async (response) => {
      const json = await response.json() as { data?: { state?: PinState }; error?: { message?: string } };
      if (!response.ok) throw new Error(json.error?.message ?? "Không thể kiểm tra trạng thái PIN");
      if (active) setState(json.data?.state ?? "NOT_CONFIGURED");
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Không thể kiểm tra trạng thái PIN"); });
    return () => { active = false; };
  }, []);

  async function login(currentPin: string) {
    const response = await fetch("/api/staff-pin/login", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin: currentPin }),
    });
    const json = await response.json() as { error?: { message?: string } };
    if (!response.ok) throw new Error(json.error?.message ?? "Đăng nhập thất bại");
    window.location.assign("/dashboard");
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (state === "ROTATION_REQUIRED") {
        if (newPin !== confirmPin) throw new Error("Hai lần nhập PIN mới chưa khớp.");
        if (pin === newPin) throw new Error("PIN mới phải khác PIN tạm.");
        const response = await fetch("/api/staff-pin/change", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPin: pin, pin: newPin }),
        });
        const json = await response.json() as { error?: { message?: string } };
        if (!response.ok) throw new Error(json.error?.message ?? "Không thể đổi PIN");
        await login(newPin);
        return;
      }
      if (state === "ACTIVE") await login(pin);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Đăng nhập thất bại"); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}><form onSubmit={submit}>
    <span>PINO TEAM OS</span>
    <h1>{state === "ROTATION_REQUIRED" ? "Đổi PIN lần đầu" : "Staff login"}</h1>
    {state === "LOADING" ? <p>Đang kiểm tra tài khoản sau Google login…</p> : null}
    {state === "ROTATION_REQUIRED" ? <>
      <p>Google đã xác thực email. Nhập PIN tạm do Manager cấp, sau đó đặt PIN 6 số chính thức của bạn.</p>
      <label>PIN tạm<input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
      <label>PIN mới<input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="new-password" value={newPin} onChange={event => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
      <label>Nhập lại PIN mới<input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="new-password" value={confirmPin} onChange={event => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
    </> : null}
    {state === "ACTIVE" ? <>
      <p>Email đăng nhập được lấy trực tiếp từ Cloudflare Access. Nhập PIN chính thức của bạn.</p>
      <label>PIN<input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
    </> : null}
    {state === "NOT_CONFIGURED" ? <p>Tài khoản chưa có Staff PIN. Liên hệ Manager để kiểm tra onboarding.</p> : null}
    {error ? <div role="alert">{error}</div> : null}
    <button disabled={busy || state === "LOADING" || state === "NOT_CONFIGURED" || pin.length !== 6 || (state === "ROTATION_REQUIRED" && (newPin.length !== 6 || confirmPin.length !== 6))}>{busy ? "Đang xử lý…" : state === "ROTATION_REQUIRED" ? "Đổi PIN & vào TOS" : "Vào TOS"}</button>
    <small>Cloudflare Google IdP xác thực identity; pino-core giữ Staff + Access + PIN authority.</small>
  </form></main>;
}
