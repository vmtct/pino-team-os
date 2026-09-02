"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type {
  BoAccessRole,
  BoCenter,
  BoPathProgram,
  BoRunningClass,
  BoStaffAccessAssignmentInput,
  BoStaffRegistrationApprovalResult,
  BoStaffRegistrationRequest,
} from "@/lib/bo-model";
import styles from "../bo.module.css";

type ScopeType = BoStaffAccessAssignmentInput["scopeType"];
type Draft = { key: string; roleId: string; scopeType: ScopeType; scopeId: string };
type Catalog = { centers: BoCenter[]; paths: BoPathProgram[]; classes: BoRunningClass[] };

const blankDraft = (): Draft => ({ key: crypto.randomUUID(), roleId: "", scopeType: "GLOBAL", scopeId: "" });

export function StaffRegistrationReviewQueue() {
  const [requests, setRequests] = useState<BoStaffRegistrationRequest[]>([]);
  const [roles, setRoles] = useState<BoAccessRole[]>([]);
  const [catalog, setCatalog] = useState<Catalog>({ centers: [], paths: [], classes: [] });
  const [selectedId, setSelectedId] = useState("");
  const [assignments, setAssignments] = useState<Draft[]>([blankDraft()]);  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [approval, setApproval] = useState<BoStaffRegistrationApprovalResult | null>(null);
  const [pinCopied, setPinCopied] = useState(false);

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    setAssignments([blankDraft()]);
    setRejectReason(""); setError("");
  }, [selectedId]);

  const selected = requests.find((item) => item.id === selectedId) ?? requests[0] ?? null;
  const activeRoles = useMemo(() => roles.filter((role) => role.status === "active" && role.roleKey !== "founder"), [roles]);

  async function refresh() {
    try {
      const [nextRequests, nextRoles, nextCatalog] = await Promise.all([
        boApi.staffRegistrationRequests(), boApi.accessRoles(), boApi.scopeCatalog(),
      ]);
      setRequests(nextRequests); setRoles(nextRoles); setCatalog(nextCatalog);
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

  async function approve() {
    if (!selected) return;
    const normalized = normalizedAssignments();
    if (!normalized) { setError("Chọn đầy đủ role và scope trước khi duyệt."); return; }
    if (!confirm(`Duyệt hồ sơ của ${selected.displayLabel} và tạo Staff + Access?`)) return;
    setBusy("approve"); setError(""); setApproval(null);
    try {
      const result = await boApi.approveStaffRegistration(selected.id, normalized, crypto.randomUUID());
      setApproval(result);
      setRequests((items) => items.filter((item) => item.id !== selected.id));
      setSelectedId("");
      window.dispatchEvent(new Event("bo:staff-updated"));
    } catch (cause) {
      setError(formatError(cause, "Không thể duyệt hồ sơ."));
    } finally { setBusy(""); }
  }

  async function reject() {
    if (!selected || !rejectReason.trim()) { setError("Nhập lý do từ chối."); return; }
    if (!confirm(`Từ chối hồ sơ của ${selected.displayLabel}?`)) return;
    setBusy("reject"); setError("");
    try {
      await boApi.rejectStaffRegistration(selected.id, rejectReason.trim(), crypto.randomUUID());
      setRequests((items) => items.filter((item) => item.id !== selected.id));
      setSelectedId("");
    } catch (cause) { setError(formatError(cause, "Không thể từ chối hồ sơ.")); }
    finally { setBusy(""); }
  }
  async function copyPin() {
    if (!approval?.initialPin) return;
    try { await navigator.clipboard.writeText(approval.initialPin); setPinCopied(true); }
    catch { setError("Không thể copy PIN tự động."); }
  }

  return <section id="staff-registration-review" className={styles.page}>
    <header className={styles.heading}>
      <span>WFM · ONBOARDING</span>
      <h1>Yêu cầu đăng ký nhân sự</h1>
      <p>Kiểm tra hồ sơ đã gửi, sau đó gán role/scope trước khi Core tạo Staff và Access.</p>
    </header>

    {error ? <p className={styles.ownerError}>{error}</p> : null}
    {approval?.initialPin ? <section className={styles.staffPinReveal} data-testid="registration-pin-reveal">
      <span>PIN tạm · hiển thị một lần</span>
      <code>{approval.initialPin}</code>
      <p>Staff phải đăng nhập bằng email đã đăng ký và đổi PIN ở lần đầu.</p>
      <div><button type="button" className={styles.secondaryButton} onClick={() => void copyPin()}>{pinCopied ? "Đã copy" : "Copy PIN"}</button><button type="button" className={styles.secondaryButton} onClick={() => { setApproval(null); setPinCopied(false); }}>Đã lưu PIN</button></div>
    </section> : null}

    <div className={styles.registrationReviewGrid}>
      <aside className={styles.registrationQueue}>
        <div className={styles.panelHeading}><div><h2>{requests.length} hồ sơ chờ duyệt</h2><p>Mới nhất ở cuối danh sách.</p></div></div>
        {!requests.length ? <div className={styles.empty}>Không có hồ sơ đang chờ duyệt.</div> : requests.map((request) => <button
          type="button" key={request.id}
          className={`${styles.registrationQueueItem} ${selected?.id === request.id ? styles.registrationQueueItemActive : ""}`}
          onClick={() => { setSelectedId(request.id); setApproval(null); setPinCopied(false); }}
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
              <button type="button" className={styles.primaryButton} disabled={Boolean(busy) || !selected.documents.front || !selected.documents.back} onClick={() => void approve()}>{busy === "approve" ? "Đang duyệt…" : "Duyệt & cấp quyền"}</button>
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
  if (cause instanceof BoApiError) return cause.requestId ? `${cause.message} · Request ${cause.requestId}` : cause.message;
  return cause instanceof Error ? cause.message : fallback;
}