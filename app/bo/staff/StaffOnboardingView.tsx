"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoAccessRole, BoCenter, BoPathProgram, BoRunningClass, BoStaffAccessAssignmentInput, BoStaffOnboardingResult } from "@/lib/bo-model";
import styles from "../bo.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string; requestId: string | null }
  | { status: "ready"; centers: BoCenter[]; paths: BoPathProgram[]; classes: BoRunningClass[]; roles: BoAccessRole[] };
type AssignmentDraft = { key: string; roleId: string; scopeType: BoStaffAccessAssignmentInput["scopeType"]; scopeId: string };
type Attempt = { serialized: string; key: string };

const emptyAssignment = (): AssignmentDraft => ({ key: crypto.randomUUID(), roleId: "", scopeType: "GLOBAL", scopeId: "" });

export function StaffOnboardingView() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [displayLabel, setDisplayLabel] = useState("");
  const [email, setEmail] = useState("");
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([emptyAssignment()]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BoStaffOnboardingResult | null>(null);
  const [submitError, setSubmitError] = useState<{ message: string; requestId: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([boApi.scopeCatalog(), boApi.accessRoles()])
      .then(([catalog, roles]) => {
        if (active) setLoad({ status: "ready", centers: catalog.centers, paths: catalog.paths, classes: catalog.classes, roles });
      })
      .catch((error: unknown) => {
        if (active) setLoad({ status: "error", message: error instanceof Error ? error.message : "Không thể tải dữ liệu thêm nhân viên.", requestId: error instanceof BoApiError ? error.requestId : null });
      });
    return () => { active = false; };
  }, []);

  const availableRoles = useMemo(() => load.status === "ready" ? load.roles.filter((role) => role.status === "active" && role.roleKey !== "founder") : [], [load]);
  if (load.status === "loading") return <State title="Đang tải…" message="Đang lấy role và scope canonical từ Core." />;
  if (load.status === "error") return <State error title="Không thể mở Add Staff" message={load.message} requestId={load.requestId} />;

  const normalizedAssignments = assignments.map(normalizeAssignment);
  const canSubmit = Boolean(displayLabel.trim() && email.trim() && normalizedAssignments.length > 0 && normalizedAssignments.every(Boolean) && !submitting);

  async function submit() {
    if (!canSubmit) return;
    const command = {
      commandType: "ONBOARD_STAFF_WITH_ACCESS" as const,
      staff: { displayLabel: displayLabel.trim(), email: email.trim() },
      email: email.trim(),
      assignments: normalizedAssignments as BoStaffAccessAssignmentInput[],
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
      setSubmitError({ message: error instanceof Error ? error.message : "Không thể thêm nhân viên.", requestId: error instanceof BoApiError ? error.requestId : null });
    } finally { setSubmitting(false); }
  }

  function patchAssignment(key: string, patch: Partial<AssignmentDraft>) {
    setAssignments((items) => items.map((item) => item.key === key ? { ...item, ...patch } : item));
  }

  return (
    <section id="add-staff" className={styles.page}>
      <header className={styles.heading}>
        <span>PINO TEAM · BACK OFFICE</span>
        <h1>Thêm nhân viên</h1>
        <p>Manager nhập tên + email. Core tạo StaffMember, Access identity và PIN tạm; staff phải đăng nhập Google qua Cloudflare Access rồi đổi PIN trước khi dùng hệ thống.</p>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>Thông tin nhân viên</h2><p>Email này là canonical identity để bind lần đăng nhập Cloudflare đầu tiên.</p></div><span className={styles.writePill}>Manager add</span></div>
        <div className={styles.formGrid}>
          <Field required label="Tên nhân viên" value={displayLabel} onChange={setDisplayLabel} />
          <Field required label="Email Google" type="email" value={email} onChange={setEmail} />
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>Quyền truy cập</h2><p>Role/scope vẫn bắt buộc và được Core re-authorize; flow không tự suy đoán quyền.</p></div><span className={styles.writePill}>Role bắt buộc</span></div>
        <div className={styles.assignmentList}>
          {assignments.map((assignment, index) => (
            <div className={styles.assignmentRow} key={assignment.key}>
              <label className={styles.field}>Role
                <select value={assignment.roleId} onChange={(event) => patchAssignment(assignment.key, { roleId: event.target.value })}>
                  <option value="">Select role…</option>
                  {availableRoles.map((role) => <option value={role.id} key={role.id}>{role.displayName}</option>)}
                </select>
              </label>
              <label className={styles.field}>Scope
                <select value={assignment.scopeType} onChange={(event) => patchAssignment(assignment.key, { scopeType: event.target.value as AssignmentDraft["scopeType"], scopeId: "" })}>
                  <option value="GLOBAL">Global</option><option value="CENTER">Center</option><option value="PATH">Path</option><option value="RUNNING_CLASS">Running Class</option>
                </select>
              </label>
              {assignment.scopeType !== "GLOBAL" ? <ScopeSelect assignment={assignment} centers={load.centers} paths={load.paths} classes={load.classes} onChange={(scopeId) => patchAssignment(assignment.key, { scopeId })} /> : <div />}
              <button type="button" className={styles.secondaryButton} disabled={assignments.length === 1} onClick={() => setAssignments((items) => items.filter((item) => item.key !== assignment.key))}>Remove</button>
              <span className={styles.assignmentIndex}>#{index + 1}</span>
            </div>
          ))}
        </div>
        <button type="button" className={styles.secondaryButton} onClick={() => setAssignments((items) => [...items, emptyAssignment()])}>+ Add role assignment</button>
      </section>

      <section className={styles.commandBar}>
        <div><strong>ADD STAFF</strong><span>Core atomically creates Staff + Access + temporary PIN. No CSV import and no manager-selected PIN.</span></div>
        <button type="button" className={styles.primaryButton} disabled={!canSubmit} onClick={() => void submit()}>{submitting ? "Đang tạo…" : "Thêm nhân viên"}</button>
      </section>

      {submitError ? <State compact error title="Add Staff failed" message={submitError.message} requestId={submitError.requestId} /> : null}
      {result ? (
        <section className={styles.successCard}>
          <strong>Đã tạo nhân viên</strong>
          <span>{result.staffPinState === "ROTATION_REQUIRED" ? "PIN tạm đã được tạo. Gửi PIN này cho staff qua kênh phù hợp; staff bắt buộc đổi PIN sau Google login." : result.accessState.replaceAll("_", " ")}</span>
          <code>{result.staffMemberId}</code>
          {result.initialPin ? <><span>PIN tạm</span><code>{result.initialPin}</code></> : null}
        </section>
      ) : null}
    </section>
  );
}

function normalizeAssignment(draft: AssignmentDraft): BoStaffAccessAssignmentInput | null {
  if (!draft.roleId) return null;
  if (draft.scopeType === "GLOBAL") return { roleId: draft.roleId, scopeType: "GLOBAL", scopeId: null };
  if (!draft.scopeId) return null;
  return { roleId: draft.roleId, scopeType: draft.scopeType, scopeId: draft.scopeId };
}

function ScopeSelect({ assignment, centers, paths, classes, onChange }: { assignment: AssignmentDraft; centers: BoCenter[]; paths: BoPathProgram[]; classes: BoRunningClass[]; onChange: (value: string) => void }) {
  const options = assignment.scopeType === "CENTER" ? centers.map((item) => ({ id: item.id, label: item.displayName })) : assignment.scopeType === "PATH" ? paths.map((item) => ({ id: item.id, label: item.displayName })) : classes.map((item) => ({ id: item.id, label: item.name }));
  return <label className={styles.field}>Target<select value={assignment.scopeId} onChange={(event) => onChange(event.target.value)}><option value="">Select target…</option>{options.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>;
}

function Field({ label, value, onChange, required = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return <label className={styles.field}>{label}{required ? " *" : ""}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function State({ title, message, requestId, error = false, compact = false }: { title: string; message: string; requestId?: string | null; error?: boolean; compact?: boolean }) {
  return <div className={`${styles.state} ${error ? styles.errorState : ""} ${compact ? styles.compactState : ""}`}><strong>{title}</strong><span>{message}</span>{requestId ? <code className={styles.id}>Request {requestId}</code> : null}</div>;
}
