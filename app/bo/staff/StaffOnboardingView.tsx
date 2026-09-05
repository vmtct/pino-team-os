"use client";

import { useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoStaffOnboardingResult } from "@/lib/bo-model";
import styles from "../bo.module.css";

type Attempt = { serialized: string; key: string };

export function StaffOnboardingView() {
  const [displayLabel, setDisplayLabel] = useState("");
  const [email, setEmail] = useState("");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BoStaffOnboardingResult | null>(null);
  const [submitError, setSubmitError] = useState<{ message: string; requestId: string | null } | null>(null);

  const canSubmit = Boolean(displayLabel.trim() && !submitting);

  async function submit() {
    if (!canSubmit) return;
    const command = {
      commandType: "ONBOARD_STAFF_RECORD_ONLY" as const,
      staff: { displayLabel: displayLabel.trim(), ...(email.trim() ? { email: email.trim() } : {}) },
    };
    const serialized = JSON.stringify(command);
    const idempotencyKey = attempt?.serialized === serialized ? attempt.key : crypto.randomUUID();
    setAttempt({ serialized, key: idempotencyKey });
    setSubmitting(true); setSubmitError(null); setResult(null);
    try {
      const response = await boApi.onboardStaff(command, idempotencyKey);
      setResult(response); setAttempt(null);
      window.dispatchEvent(new Event("bo:staff-updated"));
    } catch (error) {
      setSubmitError({ message: error instanceof Error ? error.message : "Không thể tạo hồ sơ nhân viên.", requestId: error instanceof BoApiError ? error.requestId : null });
    } finally { setSubmitting(false); }
  }

  return <section id="add-staff" className={styles.page}>
    <header className={styles.heading}>
      <span>PINO TEAM · BACK OFFICE</span>
      <h1>Thêm hồ sơ nhân viên</h1>
      <p>Flow này chỉ tạo StaffMember nội bộ. Quyền đăng nhập phải được provision qua form đăng ký nhân sự và Manager approval để Staff tự sở hữu password.</p>
    </header>

    <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Thông tin nhân viên</h2><p>Không tạo Access account, password hay PIN tại đây.</p></div><span className={styles.writePill}>Record only</span></div>
      <div className={styles.formGrid}>
        <Field required label="Tên nhân viên" value={displayLabel} onChange={setDisplayLabel} />
        <Field label="Email liên hệ" type="email" value={email} onChange={setEmail} />
      </div>
    </section>

    <section className={styles.commandBar}>
      <div><strong>CREATE STAFF RECORD</strong><span>Access vẫn NOT_PROVISIONED. Dùng Registration Review để cấp quyền local-password.</span></div>
      <button type="button" className={styles.primaryButton} disabled={!canSubmit} onClick={() => void submit()}>{submitting ? "Đang tạo…" : "Tạo hồ sơ"}</button>
    </section>
    {submitError ? <State error title="Tạo hồ sơ thất bại" message={submitError.message} requestId={submitError.requestId} /> : null}
    {result ? <section className={styles.successCard}>
      <strong>Đã tạo Staff record</strong>
      <span>{result.accessState.replaceAll("_", " ")}</span>
      <code>{result.staffMemberId}</code>
    </section> : null}
  </section>;
}

function Field({ label, value, onChange, required = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return <label className={styles.field}>{label}{required ? " *" : ""}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function State({ title, message, requestId, error = false }: { title: string; message: string; requestId?: string | null; error?: boolean }) {
  return <div className={`${styles.state} ${error ? styles.errorState : ""}`}><strong>{title}</strong><span>{message}</span>{requestId ? <code className={styles.id}>Request {requestId}</code> : null}</div>;
}
