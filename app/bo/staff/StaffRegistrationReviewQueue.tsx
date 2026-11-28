"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import {formatPinoDateTime} from "@/lib/pino-datetime";
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

  BoStaffRecord,
} from "@/lib/bo-model";
import styles from "../bo.module.css";
import { BoDataGrid, BoDataGridBadge, BoDrawer, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import { BoProperties } from "@/app/bo/components/BoProperties";
import { DetailFrame } from "@/app/components/workspace-renderer/DetailFrame";
import {useStaffRegistrationConfirmation} from "./StaffRegistrationConfirmation";
import type {StaffDossierReviewPort,StaffDossierReviewRow} from "../workforce/staffs/staff-dossier-review";

function dossierStatus(row:StaffDossierReviewRow){return row.reviewStage==="HO_APPROVED"?"HO \u0111\u00e3 ph\u00ea duy\u1ec7t":row.reviewStage==="HO_REJECTED"?"HO t\u1eeb ch\u1ed1i":row.reviewStage==="REVIEWED_FOR_HO"?"Ch\u1edd HO ph\u00ea duy\u1ec7t":row.reviewStage==="REJECTED"?"T\u1eeb ch\u1ed1i":"Ch\u1edd duy\u1ec7t";}
const requestColumns: BoDataGridColumn<StaffDossierReviewRow>[] = [
  { key: "displayLabel", header: "H\u1ecd v\u00e0 t\u00ean", render: row => row.displayLabel, minWidth: 180 },
  { key: "submittedAt", header: "Ng\u00e0y g\u1eedi", render: row => formatSubmittedAt(row.submittedAt), minWidth: 160 },
  { key: "status", header: "Tr\u1ea1ng th\u00e1i", render: row => <BoDataGridBadge>{dossierStatus(row)}</BoDataGridBadge>, minWidth: 120 },
  {key:"createdAt",header:"Created Time",render:row=>formatPinoDateTime(row.createdAt),minWidth:170},
  {key:"createdBy",header:"Created By",render:row=>row.createdBy?.trim()||"—",minWidth:145},
  {key:"updatedAt",header:"Last Modified Time",render:row=>formatPinoDateTime(row.updatedAt),minWidth:170},
  {key:"updatedBy",header:"Last Modified By",render:row=>row.updatedBy?.trim()||"—",minWidth:145},
];
function formatSubmittedAt(value: string) {
  return formatPinoDateTime(value);
}

type ScopeType = BoStaffAccessAssignmentInput["scopeType"];
type IdentityMode = "" | BoStaffRegistrationPinoriaIdentity["mode"];
type Draft = { key: string; roleId: string; scopeType: ScopeType; scopeId: string };
type Catalog = { centers: BoCenter[]; paths: BoPathProgram[]; classes: BoRunningClass[] };
type ReviewAttempt = { requestId: string; fingerprint: string; key: string };

const liveReviewKey = () => crypto.randomUUID();

export type StaffRegistrationReviewService = Pick<typeof boApi,"accessUsers"|"staffRegistrationRequests"|"accessRoles"|"scopeCatalog"|"staffRecords"|"learners"|"approveStaffRegistration"|"rejectStaffRegistration">;
export function StaffRegistrationReviewQueue({service=boApi,newKey=liveReviewKey,dossierReview,onDetailChange}:{service?:StaffRegistrationReviewService;newKey?:()=>string;dossierReview?:StaffDossierReviewPort;onDetailChange?:(detail:boolean)=>void}={}) {
  const blankDraft = useCallback((): Draft => ({key:newKey(),roleId:"",scopeType:"GLOBAL",scopeId:""}),[newKey]);
  const [requests, setRequests] = useState<StaffDossierReviewRow[]>([]);
  const [roles, setRoles] = useState<BoAccessRole[]>([]);
  const [catalog, setCatalog] = useState<Catalog>({ centers: [], paths: [], classes: [] });
  const [selectedId, setSelectedId] = useState("");
  const [surface, setSurface] = useState<"table" | "drawer" | "detail">("table");
  useEffect(()=>{onDetailChange?.(Boolean(selectedId)&&surface==="detail");},[onDetailChange,selectedId,surface]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [staffRecords, setStaffRecords] = useState<BoStaffRecord[]>([]);
  const [accessUsers, setAccessUsers] = useState<BoAccessSystemUser[]>([]);
  const [search, setSearch] = useState("");
  const [existingStaffMemberId, setExistingStaffMemberId] = useState("");
  const [identityMode, setIdentityMode] = useState<IdentityMode>("");
  const [learnerSearch, setLearnerSearch] = useState("");
  const [learners, setLearners] = useState<BoLearnerDirectoryItem[]>([]);
  const [studentProfileId, setStudentProfileId] = useState("");
  const [assignments, setAssignments] = useState<Draft[]>(()=>[blankDraft()]);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState("");
  const confirmation=useStaffRegistrationConfirmation();
  const reviewInFlight=useRef(false);
  const reviewTarget=useRef(selectedId);
  const refreshGeneration=useRef(0);
  const invalidateRefresh=useCallback(()=>{refreshGeneration.current++;},[]);
  const [error, setError] = useState("");
  const [reviewNotice,setReviewNotice]=useState("");
  const [approval, setApproval] = useState<BoStaffRegistrationApprovalResult | null>(null);
  const approveAttempt = useRef<ReviewAttempt | null>(null);
  const rejectAttempt = useRef<ReviewAttempt | null>(null);


  const selectRecord=useCallback((id:string)=>{
    if(reviewTarget.current===id)return;
    reviewTarget.current=id;
    setSelectedId(id);
    setAssignments([blankDraft()]);
    setExistingStaffMemberId("");
    setIdentityMode("");
    setLearnerSearch("");
    setLearners([]);
    setStudentProfileId("");
    setRejectReason(""); setError("");
    approveAttempt.current = null;
    rejectAttempt.current = null;
  }, [blankDraft]);

  const selected = requests.find((item) => item.id === selectedId) ?? null;
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

  const refresh = useCallback(async () => {
    const generation=++refreshGeneration.current;
    const current=()=>refreshGeneration.current===generation;
    setLoading(true);
    try {
      if(dossierReview){const next=await (dossierReview.list?.()??service.staffRegistrationRequests());if(!current())return;setRequests(next);if(!next.some(r=>r.id===reviewTarget.current))selectRecord("");return;}
      const accessUsersRequest = service.accessUsers().catch((cause) => {
        if (cause instanceof BoApiError && (cause.status === 401 || cause.status === 403)) return [];
        throw cause;
      });
      const [nextRequests, nextRoles, nextCatalog, nextStaff, nextAccessUsers] = await Promise.all([
        service.staffRegistrationRequests(), service.accessRoles(), service.scopeCatalog(), service.staffRecords(), accessUsersRequest,
      ]);
      if(!current())return;
      setRequests(nextRequests); setRoles(nextRoles); setCatalog(nextCatalog); setStaffRecords(nextStaff); setAccessUsers(nextAccessUsers);
      if(!nextRequests.some(item=>item.id===reviewTarget.current))selectRecord("");
    } catch (cause) {
      if(!current())return;
      setError(cause instanceof Error ? cause.message : "Không thể tải hàng đợi đăng ký nhân sự.");
    }
    finally { if(current())setLoading(false); }
  }, [service,dossierReview,selectRecord]);
  useEffect(() => {
    let active=true;
    queueMicrotask(()=>{if(active)void refresh();});
    return()=>{active=false;invalidateRefresh();};
  }, [refresh,invalidateRefresh]);

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
      const result = await service.learners(learnerSearch.trim(), 50);
      setLearners(result);
      setStudentProfileId((current) => result.some((learner) => learner.id === current) ? current : "");
      if (!result.length) setError("Không tìm thấy learner phù hợp.");
    } catch (cause) {
      setError(formatError(cause, "Không thể tìm learner."));
    } finally { setBusy(""); }
  }

  async function approve() {
    if (!selected || selected.reviewStage || reviewInFlight.current) return;
    if(dossierReview){
      if(!dossierReview.submit||!dossierReview.centerId||!selected.documents.front||!selected.documents.back)return;
      reviewInFlight.current=true;
      if(!await confirmation.ask("Duy\u1ec7t h\u1ed3 s\u01a1 v\u00e0 chuy\u1ec3n HO ho\u00e0n t\u1ea5t?")||reviewTarget.current!==selected.id){reviewInFlight.current=false;return;}
      setBusy("approve");setError("");
      try{const fingerprint=JSON.stringify([selected.id,selected.version,dossierReview.centerId]);const attempt=approveAttempt.current;const key=attempt?.requestId===selected.id&&attempt.fingerprint===fingerprint?attempt.key:newKey();approveAttempt.current={requestId:selected.id,fingerprint,key};const receipt=await dossierReview.submit(selected.id,selected.version,dossierReview.centerId,key);if(receipt.registrationRequestId!==selected.id||receipt.centerId!==dossierReview.centerId||receipt.status!=="REVIEWED_FOR_HO"||receipt.reviewedVersion!==selected.version||typeof receipt.reviewedBy!=="string"||!receipt.reviewedBy.trim())throw Error("Review receipt mismatch");approveAttempt.current=null;setReviewNotice("\u0110\u00e3 duy\u1ec7t h\u1ed3 s\u01a1. Ch\u1edd HO ho\u00e0n t\u1ea5t.");if(dossierReview.list){await refresh();}else{setRequests(items=>items.map(r=>r.id===selected.id?{...r,reviewStage:"REVIEWED_FOR_HO"}:r));}selectRecord("");setSurface("table");}catch(cause){setError(formatError(cause,"Kh\u00f4ng th\u1ec3 duy\u1ec7t h\u1ed3 s\u01a1."));}finally{reviewInFlight.current=false;setBusy("");}return;
    }
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
    reviewInFlight.current=true;
    if (!await confirmation.ask(confirmMessage) || reviewTarget.current!==selected.id) {reviewInFlight.current=false;return;}
    setBusy("approve"); setError(""); setApproval(null);
    try {
      const fingerprint = JSON.stringify({ normalized, pinoriaIdentity: identity, existingStaffMemberId: existingStaffMemberId || null });
      const attempt = approveAttempt.current;
      const idempotencyKey = attempt?.requestId === selected.id && attempt.fingerprint === fingerprint
        ? attempt.key
        : newKey();
      approveAttempt.current = { requestId: selected.id, fingerprint, key: idempotencyKey };
      const result = await service.approveStaffRegistration(selected.id, normalized, identity, idempotencyKey, existingStaffMemberId || undefined);
      approveAttempt.current = null;
      setApproval(result);
      setSurface("table");
      setRequests((items) => items.filter((item) => item.id !== selected.id));
      selectRecord("");
      window.dispatchEvent(new Event("bo:staff-updated"));
    } catch (cause) {
      if (cause instanceof BoApiError && cause.message.includes("Access email already exists")) {
        await refresh();
      }
      setError(formatError(cause, "Không thể duyệt hồ sơ."));
    } finally { reviewInFlight.current=false;setBusy(""); }
  }

  async function reject() {
    if (reviewInFlight.current) return;
    if (!selected || selected.reviewStage || !rejectReason.trim()) { setError("Nh\u1eadp l\u00fd do t\u1eeb ch\u1ed1i."); return; }
    reviewInFlight.current=true;
    if (!await confirmation.ask(`Từ chối hồ sơ của ${selected.displayLabel}?`) || reviewTarget.current!==selected.id) {reviewInFlight.current=false;return;}
    setBusy("reject"); setError("");
    try {
      const reason = rejectReason.trim();
      const attempt = rejectAttempt.current;
      const idempotencyKey = attempt?.requestId === selected.id && attempt.fingerprint === reason
        ? attempt.key
        : newKey();
      rejectAttempt.current = { requestId: selected.id, fingerprint: reason, key: idempotencyKey };
      await service.rejectStaffRegistration(selected.id, reason, idempotencyKey);
      rejectAttempt.current = null;
      setSurface("table");
      if(dossierReview?.list){await refresh();}
      else{setRequests(items=>items.filter(item=>item.id!==selected.id));}
      selectRecord("");
    } catch (cause) { setError(formatError(cause, "Không thể từ chối hồ sơ.")); }
    finally { reviewInFlight.current=false;setBusy(""); }
  }
  return <section id="staff-registration-review" className={dossierReview?undefined:styles.page} data-staff-registration-surface={selected?surface:"table"}>
    {!dossierReview&&<header className={styles.heading} data-staff-registration-legacy-heading>
      <span>WFM · ONBOARDING</span>
      <h1>Yêu cầu đăng ký nhân sự</h1>
      <p>Kiểm tra hồ sơ đã gửi, sau đó gán role/scope trước khi Core tạo Staff và Access.</p>
    </header>}

    {error ? <p className={styles.ownerError}>{error}</p> : null}
    {reviewNotice?<p role="status">{reviewNotice}</p>:null}
    {approval ? <section className={styles.staffPinReveal} data-testid="registration-password-ready">
      <span>Access đã sẵn sàng</span>
      <p>Staff đăng nhập bằng email + mật khẩu đã tạo lúc đăng ký. Không có Staff PIN.</p>
      <div><button type="button" className={styles.secondaryButton} onClick={() => setApproval(null)}>Đã hiểu</button></div>
    </section> : null}

    {(!selected || surface !== "detail") && <BoDataGrid rows={visibleRequests} columns={requestColumns} rowKey={row => row.id}
      caption={dossierReview?"H\u1ed3 s\u01a1 \u0111\u0103ng k\u00fd nh\u00e2n s\u1ef1":"H\u1ed3 s\u01a1 nh\u00e2n s\u1ef1 ch\u1edd duy\u1ec7t"} state={loading ? "loading" : error && !requests.length ? "error" : "ready"}
      stateMessage={error} search={search} onSearchChange={setSearch} searchPlaceholder={"T\u00ecm t\u00ean ho\u1eb7c email"}
      onRowOpen={row => { if(reviewInFlight.current||busy)return;selectRecord(row.id); setApproval(null); setTab("overview"); setSurface("drawer"); }} quickViewOpener
      emptyTitle={"Ch\u01b0a c\u00f3 h\u1ed3 s\u01a1"} emptyMessage={"Kh\u00f4ng c\u00f3 h\u1ed3 s\u01a1 ph\u00f9 h\u1ee3p."} resultLabel={visibleRequests.length + " h\u1ed3 s\u01a1"}
      toolbarActions={<button type="button" className={styles.secondaryButton} disabled={Boolean(busy) || loading} onClick={() => { setError(""); void refresh(); }}>{"T\u1ea3i l\u1ea1i"}</button>} /> }
    {selected && surface === "drawer" && <BoDrawer title={selected.displayLabel} eyebrow={dossierStatus(selected)} onClose={() => { if(reviewInFlight.current||busy)return;setSurface("table"); selectRecord(""); }}
      footer={<button type="button" className={styles.primaryButton} onClick={() => setSurface("detail")}>{"M\u1edf chi ti\u1ebft"}</button>}>
      <BoProperties authority items={requestProperties(selected)} />
    </BoDrawer>}
    {selected && surface === "detail" && <DetailFrame title={selected.displayLabel} subtitle={dossierStatus(selected)}
      tabs={[{ id: "overview", label: "T\u1ed5ng quan" }, { id: "history", label: "L\u1ecbch s\u1eed" }]} selected={tab} onSelect={id => { if (!busy) setTab(id); }}
      onBack={() => { if (!busy&&!reviewInFlight.current) { setSurface("table"); selectRecord(""); } }}>
      {tab === "history" ? <p role="status">{"L\u1ecbch s\u1eed chi ti\u1ebft ch\u01b0a c\u00f3 trong d\u1eef li\u1ec7u h\u1ed3 s\u01a1 n\u00e0y."}</p> : <div className={styles.registrationReviewDetail}>
          <section className={styles.panel}>
            <BoProperties authority items={requestProperties(selected)} />
            <p className={styles.registrationPrivacyNote}>{"CCCD v\u00e0 th\u00f4ng tin ng\u00e2n h\u00e0ng ch\u1ec9 hi\u1ec3n th\u1ecb d\u1eef li\u1ec7u \u0111\u00e3 che."}</p>
          </section>

          {dossierReview?<section className={styles.panel}><BoProperties authority items={[{key:"center",label:"C\u01a1 s\u1edf",value:dossierReview.centerName}]}/><p className={styles.registrationPrivacyNote}>{"HO qu\u1ea3n l\u00fd danh t\u00ednh v\u00e0 quy\u1ec1n truy c\u1eadp sau khi duy\u1ec7t."}</p>{!dossierReview.submit?<p role="status">{"Ch\u01b0a c\u00f3 k\u1ebft n\u1ed1i duy\u1ec7t h\u1ed3 s\u01a1."}</p>:null}</section>:<>
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
          </>}
          {selected.reviewStage?<section className={styles.panel}><BoProperties authority items={[{key:"stage",label:"Tr\u1ea1ng th\u00e1i",value:dossierStatus(selected)},{key:"reviewer",label:"Ng\u01b0\u1eddi duy\u1ec7t",value:selected.reviewedBy??"\u2014"},{key:"version",label:"Phi\u00ean b\u1ea3n h\u1ed3 s\u01a1",value:String(selected.reviewedVersion??selected.version)},...(selected.rejectReason?[{key:"reason",label:"L\u00fd do t\u1eeb ch\u1ed1i",value:selected.rejectReason}]:[]),...(selected.finalizedStaffId?[{key:"staffId",label:"Staff ID",value:selected.finalizedStaffId}]:[]),...(selected.hoRejectReason?[{key:"hoReason",label:"L\u00fd do HO t\u1eeb ch\u1ed1i",value:selected.hoRejectReason}]:[])]}/></section>:<section className={styles.registrationDecisionBar}>
            <label className={styles.field}>Lý do từ chối<input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Chỉ cần khi từ chối" /></label>
            <div className={styles.registrationDecisionActions}>
              <button type="button" className={styles.secondaryButton} disabled={Boolean(busy) || !rejectReason.trim()} onClick={() => void reject()}>{busy === "reject" ? "Đang từ chối…" : "Từ chối"}</button>
              <button type="button" className={styles.primaryButton} disabled={Boolean(busy)||!selected.documents.front||!selected.documents.back||(dossierReview?!dossierReview.submit||!dossierReview.centerId:!identityReady||Boolean(existingAccess?.staffMemberId)||Boolean(existingAccess&&!existingStaffMemberId))} onClick={() => void approve()}>{busy==="approve"?"\u0110ang duy\u1ec7t...":dossierReview?"Duy\u1ec7t h\u1ed3 s\u01a1":existingAccess?"Duy\u1ec7t & li\u00ean k\u1ebft":"Duy\u1ec7t & c\u1ea5p quy\u1ec1n"}</button>
            </div>
          </section>}
      </div>}
    </DetailFrame>}
    {confirmation.dialog}
  </section>;
}

function requestProperties(row: StaffDossierReviewRow) {
  return [
    { key: "submittedAt", label: "Ng\u00e0y g\u1eedi", value: formatSubmittedAt(row.submittedAt) },
    { key: "email", label: "Email", value: row.email },
    { key: "mobile", label: "\u0110i\u1ec7n tho\u1ea1i", value: row.mobile ?? "\u2014" },
    { key: "governmentId", label: "CCCD", value: "\u2022\u2022\u2022\u2022 " + row.governmentIdLast4 },
    { key: "documents", label: "\u1ea2nh CCCD", value: (row.documents.front ? "M\u1eb7t tr\u01b0\u1edbc \u2713" : "M\u1eb7t tr\u01b0\u1edbc thi\u1ebfu") + " \u00b7 " + (row.documents.back ? "M\u1eb7t sau \u2713" : "M\u1eb7t sau thi\u1ebfu") },
    { key: "bank", label: "T\u00e0i kho\u1ea3n nh\u1eadn l\u01b0\u01a1ng", value: "\u2022\u2022\u2022\u2022 " + row.bankAccountLast4 },
  ];
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