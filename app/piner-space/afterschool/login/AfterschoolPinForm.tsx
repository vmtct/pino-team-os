"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AfterschoolPinError,
  changeAfterschoolPin,
  loginAfterschool,
  restoreAfterschoolSession,
} from "../../../../lib/piner-afterschool-pin-client";
import AfterschoolStudentPicker from "./AfterschoolStudentPicker";
import css from "./login.module.css";

function errorMessage(error: unknown) {
  if (error instanceof AfterschoolPinError) {
    if (error.status === 423 || error.status === 429) {
      return "Vui lòng chờ 15 phút trước khi thử lại.";
    }
    if (error.status >= 400 && error.status < 500) {
      return "Không thể xác thực PIN. Kiểm tra thông tin hoặc liên hệ PINO để được cấp lại PIN.";
    }
  }
  return "Chưa thể kết nối. Vui lòng thử lại.";
}

function PinCells({ name, label, value, onChange, disabled, autoFocus, newPin }: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  autoFocus?: boolean;
  newPin?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus && !disabled) input.current?.focus();
  }, [autoFocus, disabled]);
  return <label className={css.pinGroup}>
    <span className={css.pinLabel}>{label}</span>
    <div className={css.pinCells}>
      {Array.from({ length: 6 }, (_, index) => <span key={index}
        className={css.pinCell}
        data-filled={index < value.length}
        data-next={index === value.length || (value.length === 6 && index === 5)}
        aria-hidden="true">{index < value.length ? "•" : ""}</span>)}
      <input ref={input} className={css.pinInput} name={name} aria-label={label}
        type="password" inputMode="numeric" autoComplete={newPin ? "new-password" : "current-password"}
        pattern="[0-9]{6}" maxLength={6} value={value} disabled={disabled}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        onPaste={(event) => {
          event.preventDefault();
          const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
          if (digits) onChange(digits);
        }} required />
    </div>
  </label>;
}
export default function AfterschoolPinForm() {
  const [csrf, setCsrf] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "pin">("phone");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [memberCsrf, setMemberCsrf] = useState<string | null>(null);
  const submitting = useRef(false);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let current = true;
    restoreAfterschoolSession().then(
      (session) => {
        if (current) {
          setMemberCsrf(session.csrfToken);
          setRestoring(false);
        }
      },
      () => { if (current) setRestoring(false); },
    );
    return () => { current = false; };
  }, []);

  function resetToPhone() {
    setCsrf(null);
    setMemberCsrf(null);
    setStep("phone");
    setPhone("");
    setPin("");
    setConfirm("");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || memberCsrf) return;
    setMessage("");
    if (!csrf && step === "phone") {
      const normalized = phone.replace(/\s/g, "");
      if (!/^0[35789]\d{8}$/.test(normalized)) {
        setMessage("Vui lòng nhập số điện thoại hợp lệ.");
        return;
      }
      setPhone(normalized);
      setStep("pin");
      return;
    }
    await submitPin(pin);
  }

  async function submitPin(value: string) {
    if (submitting.current || memberCsrf) return;
    setMessage("");
    if (!/^\d{6}$/.test(value)) {
      setMessage("PIN gồm đúng 6 chữ số.");
      return;
    }
    if (csrf && confirm !== value) {
      setMessage("Hai lần nhập PIN mới chưa khớp.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const session = csrf ? await changeAfterschoolPin(value, csrf) : await loginAfterschool(phone, value);
      setPin("");
      setConfirm("");
      if (session.authState === "PIN_CHANGE_REQUIRED") {
        setCsrf(session.csrfToken);
      } else {
        setCsrf(null);
        setPhone("");
        setMemberCsrf(session.csrfToken);
      }
    } catch (error) {
      setPin("");
      setConfirm("");
      if (csrf && error instanceof AfterschoolPinError && error.status === 401) resetToPhone();
      setMessage(errorMessage(error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (restoring) return <p role="status" className={css.card}>Đang kiểm tra phiên đăng nhập…</p>;

  if (memberCsrf) {
    return <AfterschoolStudentPicker csrfToken={memberCsrf} onSignedOut={resetToPhone} />;
  }

  return <section className={css.card+" "+css.authLayout} aria-label={csrf ? "Tạo PIN mới" : "Đăng nhập Piner APP"}>
    <div className={css["launch-brand"]} data-piner-canonical-brand="true">
      <img className={css["launch-sigil"]} src="https://assets.pinohouse.art/site/core/Pino%20Sigil.png" alt="PINO" width={45} height={45} loading="eager" decoding="async" />
      <img className={css["launch-wordmark"]} src="/piner_app_logo_no_yellow_transparent.png" alt="Piner APP" width={160} height={70} loading="eager" decoding="async" />
    </div>
    <div className={css.formBlock} data-piner-form-block="true">
    {csrf ? <>
      <h2 className={css.formTitle}>Tạo PIN mới</h2>
      <p className={css.notice}>Đổi PIN tạm trước khi truy cập thông tin học viên.</p>
    </> : null}
    <form key={csrf ? "change" : step} className={css.form} onSubmit={submit} aria-busy={busy}>
      {!csrf && step === "phone" ? <label>
        <input name="phone" aria-label="Số điện thoại" placeholder="Số điện thoại" type="tel"
          autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required />
      </label> : <>
        <PinCells key={csrf ? "new" : "current"} name="pin" label={csrf ? "PIN mới" : "PIN"}
          value={pin} onChange={(value) => {
            if (submitting.current) return;
            setPin(value); setMessage("");
            if (!csrf && step === "pin" && value.length === 6) void submitPin(value);
          }}
          disabled={busy} autoFocus newPin={Boolean(csrf)} />
        {csrf && <PinCells name="confirm" label="Nhập lại PIN mới" value={confirm}
          onChange={(value) => { setConfirm(value); setMessage(""); }} disabled={busy} newPin />}
      </>}
      {(csrf || step === "phone") && <button type="submit" className={css.submit} disabled={busy}>
        {csrf ? "Lưu PIN mới" : "Tiếp tục"}
      </button>}
      {!csrf && step === "pin" && busy && <p role="status">Đang đăng nhập…</p>}
      {!csrf && step === "pin" && <button type="button" className={css.secondary}
        disabled={busy} onClick={() => { setStep("phone"); setPin(""); setMessage(""); }}>
        Đổi số điện thoại
      </button>}
    </form>
    {message && <p role="alert" className={css.error}>{message}</p>}
    <small>Quên PIN hoặc PIN tạm hết hạn? Liên hệ PINO để được cấp lại.</small>
    </div>
  </section>;
}
