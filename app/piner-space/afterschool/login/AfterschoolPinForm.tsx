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

export default function AfterschoolPinForm() {
  const [csrf, setCsrf] = useState<string | null>(null);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || memberCsrf) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const pin = String(fields.get("pin") ?? "");
    const phone = String(fields.get("phone") ?? "").replace(/\s/g, "");
    setMessage("");
    if (!/^\d{6}$/.test(pin)) {
      setMessage("PIN gồm đúng 6 chữ số.");
      return;
    }
    if (csrf && fields.get("confirm") !== pin) {
      setMessage("Hai lần nhập PIN mới chưa khớp.");
      return;
    }
    if (!csrf && !/^0[35789]\d{8}$/.test(phone)) {
      setMessage("Vui lòng nhập số điện thoại hợp lệ.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const session = csrf ? await changeAfterschoolPin(pin, csrf) : await loginAfterschool(phone, pin);
      form.reset();
      if (session.authState === "PIN_CHANGE_REQUIRED") {
        setCsrf(session.csrfToken);
      } else {
        setCsrf(null);
        setMemberCsrf(session.csrfToken);
      }
    } catch (error) {
      form.reset();
      if (csrf && error instanceof AfterschoolPinError && error.status === 401) setCsrf(null);
      setMessage(errorMessage(error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (restoring) return <p role="status" className={css.card}>Đang kiểm tra phiên đăng nhập…</p>;

  if (memberCsrf) {
    return <AfterschoolStudentPicker csrfToken={memberCsrf} onSignedOut={() => setMemberCsrf(null)} />;
  }

  return <section className={css.card+" "+css.authLayout} aria-label={csrf ? "Tạo PIN mới" : "Đăng nhập Piner APP"}>
    <div className={css["launch-brand"]} data-piner-canonical-brand="true">
      <img className={css["launch-sigil"]} src="https://assets.pinohouse.art/site/core/Pino%20Sigil.png" alt="PINO" width={45} height={45} loading="eager" decoding="async" />
      <img className={css["launch-wordmark"]} src="/piner_app_logo_no_yellow_transparent.png" alt="Piner APP" width={160} height={70} loading="eager" decoding="async" />
    </div>
    <div className={css.formBlock} data-piner-form-block="true">
    {csrf && <h2 className={css.formTitle}>Tạo PIN mới</h2>}
    {csrf && <p className={css.notice}>Đổi PIN tạm trước khi truy cập thông tin học viên.</p>}
    <form key={csrf ? "change" : "login"} className={css.form} onSubmit={submit} aria-busy={busy}>
      {!csrf && <label>
        <input name="phone" aria-label="Số điện thoại" placeholder="Số điện thoại" type="tel" autoComplete="tel" required />
      </label>}
      <label>
        <input name="pin" aria-label={csrf ? "PIN mới" : "PIN"} placeholder={csrf ? "PIN mới" : "PIN"} type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
          autoComplete={csrf ? "new-password" : "current-password"} required />
      </label>
      {csrf && <label>
        <input name="confirm" aria-label="Nhập lại PIN mới" placeholder="Nhập lại PIN mới" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
          autoComplete="new-password" required />
      </label>}
      <button type="submit" className={css.submit} disabled={busy}>
        {csrf ? "Lưu PIN mới" : "Đăng nhập"}
      </button>
    </form>
    {message && <p role="alert" className={css.error}>{message}</p>}
    <small>Quên PIN hoặc PIN tạm hết hạn? Liên hệ PINO để được cấp lại.</small>
    </div>
  </section>;
}
