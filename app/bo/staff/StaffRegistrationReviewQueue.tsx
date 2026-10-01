"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoAccessSystemUser } from "@/lib/bo-access-model";
import type {
  BoAccessRole,
  BoCenter,
  BoLearnerDirectoryItem,
  BoPathProgram,
  BoRunningClass,
  BoStaffAccessAssignmentInput,
  BoStaffRegistrationApprovalResult,
  BoStaffRegistrationPinoriaIdentity,
  BoStaffRegistrationRequest,
  BoStaffRecord,
} from "@/lib/bo-model";
import styles from "../bo.module.css";

type ScopeType = BoStaffAccessAssignmentInput["scopeType"];
type IdentityMode = "" | BoStaffRegistrationPinoriaIdentity["mode"];
type Draft = { key: string; roleId: string; scopeType: ScopeType; scopeId: string };
type Catalog = { centers: BoCenter[]; paths: BoPathProgram[]; classes: BoRunningClass[] };
type ReviewAttempt = { requestId: string; fingerprint: string; key: string };

const blankDraft = (): Draft => ({ key: crypto.randomUUID(), roleId: "", scopeType: "GLOBAL", scopeId: "" });

export function StaffRegistrationReviewQueue() {
  const [requests, setRequests] = useState<BoStaffRegistrationRequest[]>([]);
  const [roles, setRoles] = useState<BoAccessRole[]>([]);
  const [catalog, setCatalog] = useState<Catalog>({ centers: [], paths: [], classes: [] });
  const [selectedId, setSelectedId] = useState("");
  const [staffRecords, setStaffRecords] = useState<BoStaffRecord[]>([]);
  const [accessUsers, setAccessUsers] = useState<BoAccessSystemUser[]>([]);
  const [search, setSearch] = useState("");
  const [existingStaffMemberId, setExistingStaffMemberId] = useState("");
  const [identityMode, setIdentityMode] = useState<IdentityMode>("");
  const [learnerSearch, setLearnerSearch] = useState("");
  const [learners, setLearners] = useState<BoLearnerDirectoryItem[]>([]);
  const [studentProfileId, setStudentProfileId] = useState("");
  const [assignments, setAssignments] = useState<Draft[]>([blankDraft()]);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [approval, setApproval] = useState<BoStaffRegistrationApprovalResult | null>(null);
  const approveAttempt = useRef<ReviewAttempt | null>(null);
  const rejectAttempt = useRef<ReviewAttempt | null>(null);

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    setAssignments([blankDraft()]);
    setExistingStaffMemberId("");
    setIdentityMode("");
    setLearnerSearch("");
    setLearners([]);
    setStudentProfileId("");
    setRejectReason(""); setError("");
    approveAttempt.current = null;
    rejectAttempt.current = null;
  }, [selectedId]);

  const selected = requests.find((item) => item.id === selectedId) ?? requests[0] ?? null;
  const activeRoles = useMemo(() => roles.filter((role) => role.status === "active" && role.roleKey !== "founder"), [roles]);
  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...requests]
      .filter((request) => !query || request.displayLabel.toLowerCase().includes(query) || request.email.toLowerCase().includes(query))
      .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
  }, [requests, search]);
  const existingAccess = useMemo(() => selected
    ? accessUsers.find((user) => user.email?.trim().toLowerCase() === selected.email.trim().toLowerCase()) ?? null
    : null, [accessUsers, selected]);
  const linkedStaffIds = useMemo(() => new Set(accessUsers.map((user) => user.staffMemberId).filter((id): id is string => Boolean(id))), [accessUsers]);
  const linkableStaff = useMemo(() => staffRecords.filter((staff) => staff.status === "active" && (!linkedStaffIds.has(staff.id) || existingAccess?.staffMemberId === staff.id)), [staffRecords, linkedStaffIds, existingAccess]);
  const identityReady = identityMode === "CREATE_STAFF_ONLY_PERSON" || (identityMode === "LINK_EXISTING_STUDENT" && Boolean(studentProfileId));

  async function refresh() {
    try {
      const accessUsersRequest = boApi.accessUsers().catch((cause) => {
        if (cause instanceof BoApiError && (cause.status === 401 || cause.status === 403)) return [];
        throw cause;
      });
      const [nextRequests, nextRoles, nextCatalog, nextStaff, nextAccessUsers] = await Promise.all([
        boApi.staffRegistrationRequests(), boApi.accessRoles(), boApi.scopeCatalog(), boApi.staffRecords(), accessUsersRequest,
      ]);
      setRequests(nextRequests); setRoles(nextRoles); setCatalog(nextCatalog); setStaffRecords(nextStaff); setAccessUsers(nextAccessUsers);
      setSelectedId((current) => nextRequests.some((item) => item.id === current) ? current : nextRequests[0]?.id ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải hàng đợi đăng ký nhân sự.");
    }
  }

  function patchDraft(key: string, patch: Partial<Draft>) {
    setAssignments((items) => items.map((item) => item.key === key ? { ...item, ...patch } : item));
  }
  function normalizedAssignments(): BoStaffAccessAssignmentInput[] | null {
    const next: BoStaffAccessAssignmentInput[] = [];
    for (const item of assignments) {
      if (!item.roleId) return null;
      if (item.scopeType === "GLOBAL") next.push({ roleId: item.roleId, scopeType: "GLOBAL", scopeId: null });
      else {
        if (!item.scopeId) return null;
        next.push({ roleId: item.roleId, scopeType: item.scopeType, scopeId: item.scopeId });
      }
    }
    return next.length ? next : null;
  }

  function pinoriaIdentity(): BoStaffRegistrationPinoriaIdentity | null {
    if (identityMode === "CREATE_STAFF_ONLY_PERSON") return { mode: identityMode };
    if (identityMode === "LINK_EXISTING_STUDENT" && studentProfileId) return { mode: identityMode, studentProfileId };
    return null;
  }

  async function searchLearners() {
    if (!learnerSearch.trim()) { setError("Nhập tên học viên cần liên kết."); return; }
    setBusy("learner-search"); setError("");
    try {
      const result = await boApi.learners(learnerSearch.trim(), 50);
      setLearners(result);
      setStudentProfileId((current) => result.some((learner) => learner.id === current) ? current : "");
      if (!result.length) setError("Không tìm thấy learner phù hợp.");
    } catch (cause) {
      setError(formatError(cause, "Không thể tìm learner."));
    } finally { setBusy(""); }
  }

  async function approve() {
    if (!selected) return;
    const normalized = normalizedAssignments();
    if (!normalized) { setError("Chọn đầy đủ role và scope trước khi duyệt."); return; }
    const identity = pinoriaIdentity();
    if (!identity) { setError("Chọn rõ Pinoria identity: staff-only hoặc learner hiện hữu."); return; }
    if (existingAccess?.staffMemberId) {
      setError("Email này đã được liên kết với một Staff khác. Kiểm tra Access trước khi duyệt.");
      return;
    }
    if (existingAccess && !existingStaffMemberId) {
      setError("Email này đã có Access account. Chọn Staff hiện hữu để liên kết.");
      return;
    }
    const targetStaff = staffRecords.find((staff) => staff.id === existingStaffMemberId);
    const confirmMessage = existingAccess
      ? `Duyệt hồ sơ của ${selected.displayLabel} và liên kết Access hiện hữu với Staff “${targetStaff?.displayLabel ?? "đã chọn"}”?`
      : `Duyệt hồ sơ của ${selected.displayLabel} và tạo Staff + Access?`;
    if (!confirm(confirmMessage)) return;
    setBusy("approve"); setError(""); setApproval(null);
    try {
      const fingerprint = JSON.stringify({ normalized, pinoriaIdentity: identity, existingStaffMemberId: existingStaffMemberId || null });
      const attempt = approveAttempt.current;
      const idempotencyKey = attempt?.requestId === selected.id && attempt.fingerprint === fingerprint
        ? attempt.key
        : crypto.randomUUID();
      approveAttempt.current = { requestId: selected.id, fingerprint, key: idempotencyKey };
      const result = await boApi.approveStaffRegistration(selected.id, normalized, identity, idempotencyKey, existingStaffMemberId || undefined);
      approveAttempt.current = null;
      setApproval(result);
      setRequests((items) => items.filter((item) => item.id !== selected.id));
      setSelectedId("");
      window.dispatchEvent(new Event("bo:staff-updated"));
    } catch (cause) {
      if (cause instanceof BoApiError && cause.message.includes("Access email already exists")) {
        await refresh();
      }
      setError(formatError(cause, "Không thể duyệt hồ sơ."));
    } finally { setBusy(""); }
  }

  async function reject() {
    if (!selected || !rejectReason.trim()) { setError("Nhập lý do từ chối."); return; }
    if (!confirm(`Từ chối hồ sơ của ${selected.displayLabel}?`)) return;
    setBusy("reject"); setError("");
    try {
      const reason = rejectReason.trim();
      const attempt = rejectAttempt.current;
      const idempotencyKey = attempt?.requestId === selected.id && attempt.fingerprint === reason
        ? attempt.key
        : crypto.randomUUID();
      rejectAttempt.current = { requestId: selected.id, fingerprint: reason, key: idempotencyKey };
      await boApi.rejectStaffRegistration(selected.id, reason, idempotencyKey);
      rejectAttempt.current = null;
      setRequests((items) => items.filter((item) => item.id !== selected.id));
      setSelectedId("");
    } catch (cause) { setError(formatError(cause, "Không thể từ chối hồ sơ.")); }
    finally { setBusy(""); }
  }
  return <section id="staff-registration-review" className={styles.page}>
    <header className={styles.heading}>
      <span>WFM · ONBOARDING</span>
      <h1>Yêu cầu đăng ký nhân sự</h1>
      <p>Kiểm tra hồ sơ đã gửi, sau đó gán role/scope trước khi Core tạo Staff và Access.</p>
    </header>

    {error ? <p className={styles.ownerError}>{error}</p> : null}
    {approval ? <section className={styles.staffPinReveal} data-testid="registration-password-ready">
      <span>Access đã sẵn sàng</span>
      <p>Staff đăng nhập bằng email + mật khẩu đã tạo lúc đăng ký. Không có Staff PIN.</p>
      <div><button type="button" className={styles.secondaryButton} onClick={() => setApproval(null)}>Đã hiểu</button></div>
    </section> : null}

    <div className={styles.registrationReviewGrid}>
      <aside className={styles.registrationQueue}>
        <div className={styles.panelHeading}><div><h2>{requests.length} hồ sơ chờ duyệt</h2><p>Mới nhất trước.</p></div></div>
        <label className={styles.field}>Tìm hồ sơ<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên hoặc email" /></label>
        {!visibleRequests.length ? <div className={styles.empty}>{requests.length ? "Không tìm thấy hồ sơ phù hợp." : "Không có hồ sơ đang chờ duyệt."}</div> : visibleRequests.map((request) => <button
          type="button" key={request.id}
          className={`${styles.registrationQueueItem} ${selected?.id === request.id ? styles.registrationQueueItemActive : ""}`}
          onClick={() => { setSelectedId(request.id); setApproval(null); }}
        >
          <strong>{request.displayLabel}</strong>
          <span>{request.email}</span>
          <small>{new Date(request.submittedAt).toLocaleString("vi-VN")}</small>
        </button>)}
      </aside>
      <div className={styles.registrationReviewDetail}>
        {!selected ? <section className={styles.panel}><p>Chọn một hồ sơ để review.</p></section> : <>
          <section className={styles.panel}>
            <div className={styles.panelHeading}><div><h2>{selected.displayLabel}</h2><p>Submitted {new Date(selected.submittedAt).toLocaleString("vi-VN")}</p></div><span className={styles.writePill}>PENDING</span></div>
            <dl className={styles.registrationFacts}>
              <div><dt>Email</dt><dd>{selected.email}</dd></div>
              <div><dt>Điện thoại</dt><dd>{selected.mobile ?? "—"}</dd></div>
              <div><dt>CCCD</dt><dd>•••• •••• {selected.governmentIdLast4}</dd></div>
              <div><dt>Ảnh CCCD</dt><dd>{selected.documents.front ? "Mặt trước ✓" : "Mặt trước thiếu"} · {selected.documents.back ? "Mặt sau ✓" : "Mặt sau thiếu"}</dd></div>
              <div><dt>Tài khoản nhận lương</dt><dd>•••• •••• {selected.bankAccountLast4}</dd></div>
            </dl>
            <p className={styles.registrationPrivacyNote}>CCCD và thông tin ngân hàng đầy đủ được mã hoá tại Core; queue mặc định chỉ surface dữ liệu đã mask.</p>
          </section>

          {existingAccess ? <section className={styles.panel}>
            <div className={styles.panelHeading}><div><h2>Access hiện hữu</h2><p>Email đăng ký đã có tài khoản Access; không tạo tài khoản trùng.</p></div><span className={styles.writePill}>LINK</span></div>
            {existingAccess.staffMemberId ? <p className={styles.ownerError}>Access này đã liên kết với Staff <code>{existingAccess.staffMemberId}</code>. Không thể duyệt vào Staff khác.</p> : <>
              <p>Chọn đúng StaffMember để liên kết. Hệ thống không tự suy đoán identity theo tên hoặc email.</p>
              <label className={styles.field}>Staff cần liên kết<select value={existingStaffMemberId} onChange={(event) => setExistingStaffMemberId(event.target.value)}>
                <option value="">Chọn Staff…</option>
                {linkableStaff.map((staff) => <option key={staff.id} value={staff.id}>{staff.displayLabel}{staff.roleLabel ? ` · ${staff.roleLabel}` : ""}</option>)}
              </select></label>
            </>}
          </section> : null}

          <section className={styles.panel}>
            <div className={styles.panelHeading}><div><h2>Pinoria identity</h2><p>Chọn explicit; hệ thống không suy đoán theo tên hoặc email.</p></div></div>
            <label className={styles.field}>Identity<select value={identityMode} onChange={(event) => { setIdentityMode(event.target.value as IdentityMode); setStudentProfileId(""); setLearners([]); }}>
              <option value="">Chọn identity…</option>
              <option value="CREATE_STAFF_ONLY_PERSON">Staff-only · tạo Person riêng</option>
              <option value="LINK_EXISTING_STUDENT">Đã là learner · dùng Person hiện hữu</option>
            </select></label>
            {identityMode === "LINK_EXISTING_STUDENT" ? <>
              <div className={styles.assignmentRow}>
                <label className={styles.field}>Tìm learner<input value={learnerSearch} onChange={(event) => setLearnerSearch(event.target.value)} placeholder="Tên learner" /></label>
                <button type="button" className={styles.secondaryButton} disabled={Boolean(busy)} onClick={() => void searchLearners()}>{busy === "learner-search" ? "Đang tìm…" : "Tìm learner"}</button>
              </div>
              <label className={styles.field}>Learner<select value={studentProfileId} onChange={(event) => setStudentProfileId(event.target.value)}>
                <option value="">Chọn learner…</option>
                {learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.displayName}{learner.birthYear ? ` · ${learner.birthYear}` : ""}</option>)}
              </select></label>
              <p className={styles.registrationPrivacyNote}>Chỉ link khi xác nhận đây đúng là cùng một người. Không match tự động bằng tên/email.</p>
            </> : null}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeading}><div><h2>Quyền truy cập</h2><p>Ít nhất một role/scope explicit trước khi duyệt.</p></div></div>
            <div className={styles.assignmentList}>
              {assignments.map((draft, index) => <div className={styles.assignmentRow} key={draft.key}>
                <label className={styles.field}>Role<select value={draft.roleId} onChange={(event) => patchDraft(draft.key, { roleId: event.target.value })}><option value="">Chọn role…</option>{activeRoles.map((role) => <option key={role.id} value={role.id}>{role.displayName}</option>)}</select></label>
                <label className={styles.field}>Scope<select value={draft.scopeType} onChange={(event) => patchDraft(draft.key, { scopeType: event.target.value as ScopeType, scopeId: "" })}><option value="GLOBAL">Global</option><option value="CENTER">Center</option><option value="PATH">Path</option><option value="RUNNING_CLASS">Running Class</option></select></label>
                {draft.scopeType === "GLOBAL" ? <div /> : <TargetSelect draft={draft} catalog={catalog} onChange={(scopeId) => patchDraft(draft.key, { scopeId })} />}
                <button type="button" className={styles.secondaryButton} disabled={assignments.length === 1} onClick={() => setAssignments((items) => items.filter((item) => item.key !== draft.key))}>Gỡ</button>
                <span className={styles.assignmentIndex}>#{index + 1}</span>
              </div>)}
            </div>
            <button type="button" className={styles.secondaryButton} onClick={() => setAssignments((items) => [...items, blankDraft()])}>+ Thêm role assignment</button>
          </section>
          <section className={styles.registrationDecisionBar}>
            <label className={styles.field}>Lý do từ chối<input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Chỉ cần khi từ chối" /></label>
            <div className={styles.registrationDecisionActions}>
              <button type="button" className={styles.secondaryButton} disabled={Boolean(busy) || !rejectReason.trim()} onClick={() => void reject()}>{busy === "reject" ? "Đang từ chối…" : "Từ chối"}</button>
              <button type="button" className={styles.primaryButton} disabled={Boolean(busy) || !identityReady || !selected.documents.front || !selected.documents.back || Boolean(existingAccess?.staffMemberId) || Boolean(existingAccess && !existingStaffMemberId)} onClick={() => void approve()}>{busy === "approve" ? "Đang duyệt…" : existingAccess ? "Duyệt & liên kết" : "Duyệt & cấp quyền"}</button>
            </div>
          </section>
        </>}
      </div>
    </div>
  </section>;
}

function TargetSelect({ draft, catalog, onChange }: { draft: Draft; catalog: Catalog; onChange: (value: string) => void }) {
  const options = draft.scopeType === "CENTER"
    ? catalog.centers.map((item) => [item.id, item.displayName] as const)
    : draft.scopeType === "PATH"
      ? catalog.paths.map((item) => [item.id, item.displayName] as const)
      : catalog.classes.map((item) => [item.id, item.name] as const);
  return <label className={styles.field}>Target<select value={draft.scopeId} onChange={(event) => onChange(event.target.value)}><option value="">Chọn target…</option>{options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>;
}

function formatError(cause: unknown, fallback: string): string {
  if (cause instanceof BoApiError && cause.message.includes("Access email already exists")) {
    return `Email này đã có Access account. Chọn Staff hiện hữu để liên kết thay vì tạo Access mới.${cause.requestId ? ` · Request ${cause.requestId}` : ""}`;
  }
  if (cause instanceof BoApiError) return cause.requestId ? `${cause.message} · Request ${cause.requestId}` : cause.message;
  return cause instanceof Error ? cause.message : fallback;
}