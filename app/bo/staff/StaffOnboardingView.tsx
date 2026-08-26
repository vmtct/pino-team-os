"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type {
  BoAccessRole,
  BoAccessUser,
  BoCenter,
  BoPathProgram,
  BoRunningClass,
  BoStaffAccessAssignmentInput,
  BoStaffOnboardingCommand,
  BoStaffOnboardingResult,
  BoStaffRecord,
} from "@/lib/bo-model";
import styles from "../bo.module.css";

type Mode = "record" | "with-access" | "provision";
type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string; requestId: string | null }
  | { status: "ready"; centers: BoCenter[]; paths: BoPathProgram[]; classes: BoRunningClass[]; roles: BoAccessRole[]; users: BoAccessUser[]; staff: BoStaffRecord[] };

type AssignmentDraft = { key: string; roleId: string; scopeType: BoStaffAccessAssignmentInput["scopeType"]; scopeId: string };
type Attempt = { serialized: string; key: string };

const emptyAssignment = (): AssignmentDraft => ({ key: crypto.randomUUID(), roleId: "", scopeType: "GLOBAL", scopeId: "" });

export function StaffOnboardingView() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [mode, setMode] = useState<Mode>("with-access");
  const [displayLabel, setDisplayLabel] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [department, setDepartment] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [existingStaffId, setExistingStaffId] = useState("");
  const [accessEmail, setAccessEmail] = useState("");
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([emptyAssignment()]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BoStaffOnboardingResult | null>(null);
  const [submitError, setSubmitError] = useState<{ message: string; requestId: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      boApi.centers(),
      boApi.pathPrograms(),
      boApi.runningClasses(),
      boApi.accessRoles(),
      boApi.accessUsers(),
      boApi.staffRecords(),
    ]).then(([centers, paths, classes, roles, users, staff]) => {
      if (active) setLoad({ status: "ready", centers, paths, classes, roles, users, staff });
    }).catch((error: unknown) => {
      if (active) setLoad({ status: "error", message: error instanceof Error ? error.message : "Staff onboarding data could not be loaded.", requestId: error instanceof BoApiError ? error.requestId : null });
    });
    return () => { active = false; };
  }, []);

  const availableRoles = useMemo(() => load.status === "ready" ? load.roles.filter((role) => role.status === "active" && role.roleKey !== "founder") : [], [load]);
  const linkedStaffIds = useMemo(() => load.status === "ready" ? new Set(load.users.map((user) => user.staffMemberId).filter((id): id is string => Boolean(id))) : new Set<string>(), [load]);
  const provisionCandidates = useMemo(() => load.status === "ready" ? load.staff.filter((staff) => staff.status === "active" && !linkedStaffIds.has(staff.id)) : [], [load, linkedStaffIds]);

  if (load.status === "loading") return <State title="Loading Workforce onboarding…" message="Resolving canonical Staff, Access roles, and scope catalogs." />;
  if (load.status === "error") return <State error title="Unable to load Workforce onboarding" message={load.message} requestId={load.requestId} />;

  const accessMode = mode !== "record";
  const command = buildCommand();
  const canSubmit = command !== null && (!accessMode || assignments.length > 0) && !submitting;

  async function submit() {
    if (!command || !canSubmit) return;
    setSubmitError(null);
    setResult(null);
    setSubmitting(true);
    const serialized = JSON.stringify(command);
    const idempotencyKey = attempt?.serialized === serialized ? attempt.key : crypto.randomUUID();
    setAttempt({ serialized, key: idempotencyKey });
    try {
      const response = await boApi.onboardStaff(command, idempotencyKey);
      setResult(response);
      setAttempt(null);
    } catch (error) {
      setSubmitError({ message: error instanceof Error ? error.message : "Staff onboarding failed.", requestId: error instanceof BoApiError ? error.requestId : null });
    } finally {
      setSubmitting(false);
    }
  }

  function buildCommand(): BoStaffOnboardingCommand | null {
    const staff = profile();
    if (mode === "record") return displayLabel.trim() ? { commandType: "ONBOARD_STAFF_RECORD_ONLY", staff } : null;
    const accessAssignments = assignments.map(normalizeAssignment).filter((item): item is BoStaffAccessAssignmentInput => item !== null);
    if (!accessEmail.trim() || accessAssignments.length !== assignments.length || accessAssignments.length === 0) return null;
    if (mode === "with-access") return displayLabel.trim() ? { commandType: "ONBOARD_STAFF_WITH_ACCESS", staff, email: accessEmail.trim(), assignments: accessAssignments } : null;
    return existingStaffId ? { commandType: "PROVISION_ACCESS_FOR_STAFF", staffMemberId: existingStaffId, email: accessEmail.trim(), assignments: accessAssignments } : null;
  }

  function profile() {
    return compact({
      displayLabel: displayLabel.trim(),
      email: profileEmail.trim(), mobile: mobile.trim(), department: department.trim(), roleLabel: roleLabel.trim(), employmentType: employmentType.trim(), startDate: startDate.trim(),
    });
  }

  function normalizeAssignment(draft: AssignmentDraft): BoStaffAccessAssignmentInput | null {
    if (!draft.roleId) return null;
    if (draft.scopeType === "GLOBAL") return { roleId: draft.roleId, scopeType: "GLOBAL", scopeId: null };
    if (!draft.scopeId) return null;
    return { roleId: draft.roleId, scopeType: draft.scopeType, scopeId: draft.scopeId };
  }

  function patchAssignment(key: string, patch: Partial<AssignmentDraft>) {
    setAssignments((items) => items.map((item) => item.key === key ? { ...item, ...patch } : item));
  }

  return (
    <section className={styles.page}>
      <header className={styles.heading}>
        <span>PINO TEAM · BACK OFFICE</span>
        <h1>Staff onboarding</h1>
        <p>Create native Workforce records and explicitly provision Access. No Notion identity import, inferred roles, or roleless Access users.</p>
      </header>

      <div className={styles.modeGrid}>
        <ModeButton active={mode === "record"} title="Staff record only" text="Create canonical StaffMember without login." onClick={() => setMode("record")} />
        <ModeButton active={mode === "with-access"} title="Staff + Access" text="Create StaffMember and full Access graph atomically." onClick={() => setMode("with-access")} />
        <ModeButton active={mode === "provision"} title="Provision existing Staff" text="Add Access to an active StaffMember without recreating it." onClick={() => setMode("provision")} />
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>{mode === "provision" ? "Existing StaffMember" : "Staff record"}</h2><p>Canonical Workforce identity. Fields are explicit; no legacy mapping is created.</p></div><span className={styles.writePill}>Write</span></div>
        {mode === "provision" ? (
          <label className={styles.field}>StaffMember
            <select value={existingStaffId} onChange={(event) => setExistingStaffId(event.target.value)}>
              <option value="">Select active Staff without Access…</option>
              {provisionCandidates.map((staff) => <option key={staff.id} value={staff.id}>{staff.displayLabel}{staff.department ? ` · ${staff.department}` : ""}</option>)}
            </select>
            <small>{provisionCandidates.length} candidate(s); already linked Staff are excluded.</small>
          </label>
        ) : (
          <div className={styles.formGrid}>
            <Field required label="Display name" value={displayLabel} onChange={setDisplayLabel} />
            <Field label="Profile email" type="email" value={profileEmail} onChange={setProfileEmail} />
            <Field label="Mobile" value={mobile} onChange={setMobile} />
            <Field label="Department" value={department} onChange={setDepartment} />
            <Field label="Role label" value={roleLabel} onChange={setRoleLabel} />
            <Field label="Employment type" value={employmentType} onChange={setEmploymentType} />
            <Field label="Start date" type="date" value={startDate} onChange={setStartDate} />
          </div>
        )}
      </section>

      {accessMode ? (
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><h2>Access provisioning</h2><p>At least one explicit active non-Founder role is mandatory.</p></div><span className={styles.writePill}>Role required</span></div>
          <Field required label="Access email" type="email" value={accessEmail} onChange={setAccessEmail} />
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
      ) : null}

      <section className={styles.commandBar}>
        <div><strong>{modeLabel(mode)}</strong><span>{accessMode ? "Core will re-verify role, scope, authorization, uniqueness, and Staff state at commit time." : "Creates one native StaffMember only."}</span></div>
        <button type="button" className={styles.primaryButton} disabled={!canSubmit} onClick={() => void submit()}>{submitting ? "Submitting…" : "Confirm & execute"}</button>
      </section>

      {submitError ? <State compact error title="Command failed" message={submitError.message} requestId={submitError.requestId} /> : null}
      {result ? <section className={styles.successCard}><strong>Command committed</strong><span>{result.accessState.replaceAll("_", " ")}</span><code>{result.staffMemberId}</code>{result.userId ? <code>{result.userId}</code> : null}</section> : null}
    </section>
  );
}

function ScopeSelect({ assignment, centers, paths, classes, onChange }: { assignment: AssignmentDraft; centers: BoCenter[]; paths: BoPathProgram[]; classes: BoRunningClass[]; onChange: (value: string) => void }) {
  const options = assignment.scopeType === "CENTER" ? centers.map((item) => ({ id: item.id, label: item.displayName })) : assignment.scopeType === "PATH" ? paths.map((item) => ({ id: item.id, label: item.displayName })) : classes.map((item) => ({ id: item.id, label: item.name }));
  return <label className={styles.field}>Target<select value={assignment.scopeId} onChange={(event) => onChange(event.target.value)}><option value="">Select target…</option>{options.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>;
}

function Field({ label, value, onChange, required = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return <label className={styles.field}>{label}{required ? " *" : ""}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ModeButton({ active, title, text, onClick }: { active: boolean; title: string; text: string; onClick: () => void }) {
  return <button type="button" className={`${styles.modeButton} ${active ? styles.modeButtonActive : ""}`} onClick={onClick}><strong>{title}</strong><span>{text}</span></button>;
}

function State({ title, message, requestId, error = false, compact = false }: { title: string; message: string; requestId?: string | null; error?: boolean; compact?: boolean }) {
  return <div className={`${styles.state} ${error ? styles.errorState : ""} ${compact ? styles.compactState : ""}`}><strong>{title}</strong><span>{message}</span>{requestId ? <code className={styles.id}>Request {requestId}</code> : null}</div>;
}

function compact<T extends Record<string, string>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== "")) as T;
}

function modeLabel(mode: Mode) {
  if (mode === "record") return "ONBOARD_STAFF_RECORD_ONLY";
  if (mode === "with-access") return "ONBOARD_STAFF_WITH_ACCESS";
  return "PROVISION_ACCESS_FOR_STAFF";
}
