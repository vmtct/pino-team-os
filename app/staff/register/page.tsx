"use client";
import { FormEvent, useEffect, useState } from "react";
import styles from "./staff-register.module.css";

type IntakeState = "LOADING" | "OPEN" | "CLOSED";

export default function StaffRegistrationPage() {
  const [state, setState] = useState<IntakeState>("LOADING");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/staff-registration", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { data?: { enabled?: boolean }; error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Không thể kiểm tra trạng thái đăng ký.");
        setState(body.data?.enabled ? "OPEN" : "CLOSED");
      })
      .catch(() => setState("CLOSED"));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/staff-registration", { method: "POST", body: form });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể gửi hồ sơ nhân sự.");
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gửi hồ sơ nhân sự.");
    } finally { setBusy(false); }
  }
  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <img className={styles.brandSigil} src="https://assets.pinohouse.art/core/Pino%20Sigil.png" alt="PINO House" />
        <div><strong>PINO House</strong><span>EMPLOYEE REGISTRATION</span></div>
      </header>

      <section className={styles.intro}>
        <span className={styles.eyebrow}>HỒ SƠ NHÂN SỰ</span>
        <h1>Đăng ký thông tin nhân viên</h1>
        <p>Vui lòng cung cấp thông tin chính xác theo giấy tờ cá nhân. Hồ sơ chỉ được dùng cho mục đích quản lý nhân sự, xác minh và thanh toán.</p>
        <div className={`${styles.status} ${state === "OPEN" ? styles.statusOpen : ""}`}>
          <i />{state === "LOADING" ? "Đang kiểm tra trạng thái" : state === "OPEN" ? "Đang tiếp nhận hồ sơ" : "Tạm ngưng tiếp nhận hồ sơ"}
        </div>
      </section>

      {state === "CLOSED" ? <section className={styles.notice}>
        <strong>Đăng ký nhân viên hiện đang đóng</strong>
        <p>Vui lòng liên hệ quản lý PINO House để được mở lại đường dẫn đăng ký.</p>
      </section> : null}

      {state === "OPEN" && submitted ? <section className={styles.notice}>
        <div className={styles.successIcon}>✓</div>
        <strong>Hồ sơ đã được gửi</strong>
        <p>Quản lý sẽ kiểm tra thông tin, xác minh hồ sơ và cấp quyền truy cập nếu được duyệt.</p>
      </section> : null}
      {state === "OPEN" && !submitted ? <form className={styles.form} onSubmit={submit}>
        <section className={styles.section}>
          <div className={styles.sectionHead}><span>01</span><div><h2>Thông tin cá nhân</h2><p>Thông tin cơ bản để tạo hồ sơ nhân sự.</p></div></div>
          <div className={styles.grid}>
            <label className={styles.span2}>Họ và tên theo CCCD<input name="legalName" autoComplete="name" maxLength={160} required /></label>
            <label>Email cá nhân<input name="email" type="email" autoComplete="email" maxLength={320} required /></label>
            <label>Số điện thoại<input name="mobile" type="tel" autoComplete="tel" maxLength={30} required /></label>
            <label>Ngày sinh<input name="dateOfBirth" type="date" required /></label>
            <label className={styles.span2}>Địa chỉ hiện tại<textarea name="currentAddress" rows={3} maxLength={500} required /></label>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}><span>02</span><div><h2>Xác minh CCCD</h2><p>Ảnh rõ nét, đầy đủ bốn góc và không che thông tin.</p></div></div>
          <div className={styles.grid}>
            <label className={styles.span2}>Số CCCD<input name="governmentIdNumber" inputMode="numeric" pattern="[0-9]{9,12}" maxLength={12} required /></label>
            <UploadField name="governmentIdFront" title="CCCD · Mặt trước" />
            <UploadField name="governmentIdBack" title="CCCD · Mặt sau" />
          </div>
          <p className={styles.privateNote}>Ảnh CCCD được lưu ở vùng tài liệu riêng tư; hệ thống không công khai file hoặc URL tải trực tiếp.</p>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHead}><span>03</span><div><h2>Thông tin nhận lương</h2><p>Tài khoản ngân hàng chính chủ dùng cho thanh toán.</p></div></div>
          <div className={styles.grid}>
            <label>Ngân hàng<input name="bankName" maxLength={120} placeholder="VD: Vietcombank" required /></label>
            <label>Số tài khoản<input name="bankAccountNumber" inputMode="numeric" maxLength={34} required /></label>
            <label className={styles.span2}>Tên chủ tài khoản<input name="bankAccountHolder" maxLength={160} required /></label>
            <label className={styles.span2}>Chi nhánh <span className={styles.optional}>Không bắt buộc</span><input name="bankBranch" maxLength={160} /></label>
          </div>
        </section>

        <label className={styles.consent}>
          <input type="checkbox" name="confirmAccuracy" value="yes" required />
          <span>Tôi xác nhận các thông tin trên là chính xác và đồng ý để PINO House sử dụng cho mục đích quản lý nhân sự, xác minh hồ sơ và thanh toán liên quan đến công việc.</span>
        </label>
        {error ? <div className={styles.error} role="alert">{error}</div> : null}
        <button className={styles.submit} disabled={busy}>{busy ? "Đang gửi hồ sơ…" : "Gửi hồ sơ nhân sự"}<span>→</span></button>
        <small className={styles.submitNote}>Việc gửi hồ sơ không tự động tạo tài khoản hoặc cấp quyền truy cập hệ thống.</small>
      </form> : null}

      <footer className={styles.footer}>Đã có tài khoản? <a href="/staff-login">Đăng nhập Staff</a></footer>
    </div>
  </main>;
}

function UploadField({ name, title }: { name: string; title: string }) {
  const [fileName, setFileName] = useState("");
  return <label className={styles.upload}>
    <span>{title}</span>
    <input name={name} type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")} />
    <div><strong>{fileName || "Chọn hoặc chụp ảnh"}</strong><small>JPG, PNG hoặc WEBP · tối đa 5 MB</small></div>
  </label>;
}
