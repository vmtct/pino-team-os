"use client";
import { FormEvent, useEffect, useState } from "react";
import styles from "../../staff-login/staff-login.module.css";

export default function StaffPinChangePage() {
  const [currentPin, setCurrentPin] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/staff-pin/status", { cache: "no-store" }).then(async response => {
      const body = await response.json() as { data?: { state?: string }; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể kiểm tra Staff PIN");
      if (body.data?.state === "ACTIVE") { window.location.assign("/bo"); return; }
      if (body.data?.state !== "ROTATION_REQUIRED") throw new Error("Tài khoản chưa có PIN tạm để kích hoạt.");
      setReady(true);
    }).catch(cause => setError(cause instanceof Error ? cause.message : "Không thể kiểm tra Staff PIN"));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      if (pin !== confirmPin) throw new Error("Hai lần nhập PIN mới chưa khớp.");
      if (currentPin === pin) throw new Error("PIN mới phải khác PIN tạm.");
      const response = await fetch("/api/staff-pin/change", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPin, pin }) });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể đổi PIN");
      window.location.assign("/bo");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể đổi PIN"); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}><form onSubmit={submit}>
    <span>PINO TEAM · SECURITY</span><h1>Đổi PIN lần đầu</h1>
    <p>Google đã xác thực tài khoản. Hoàn tất PIN chính thức trước khi vào Back Office.</p>
    <label>PIN tạm<input type="password" inputMode="numeric" maxLength={6} value={currentPin} onChange={event => setCurrentPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
    <label>PIN mới<input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
    <label>Nhập lại PIN mới<input type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={event => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
    {error ? <div role="alert">{error}</div> : null}
    <button disabled={!ready || busy || currentPin.length !== 6 || pin.length !== 6 || confirmPin.length !== 6}>{busy ? "Đang đổi PIN…" : "Kích hoạt PIN chính thức"}</button>
  </form></main>;
}
