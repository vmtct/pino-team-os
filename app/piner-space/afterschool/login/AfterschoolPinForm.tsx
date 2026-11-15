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

  return <section className={css.card}>
    <h1>{csrf ? "Tạo PIN mới" : "PINO Afterschool"}</h1>
    {csrf && <p className={css.notice}>Đổi PIN tạm trước khi truy cập thông tin học viên.</p>}
    <form key={csrf ? "change" : "login"} className={css.form} onSubmit={submit} aria-busy={busy}>
      {!csrf && <label>Số điện thoại phụ huynh
        <input name="phone" type="tel" autoComplete="tel" required />
      </label>}
      <label>{csrf ? "PIN mới" : "PIN"}
        <input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
          autoComplete={csrf ? "new-password" : "current-password"} required />
      </label>
      {csrf && <label>Nhập lại PIN mới
        <input name="confirm" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
          autoComplete="new-password" required />
      </label>}
      <button type="submit" className={css.submit} disabled={busy}>
        {csrf ? "Lưu PIN mới" : "Tiếp tục"}
      </button>
    </form>
    {message && <p role="alert" className={css.error}>{message}</p>}
    <small>Quên PIN hoặc PIN tạm hết hạn? Liên hệ PINO để được cấp lại.</small>
  </section>;
}
