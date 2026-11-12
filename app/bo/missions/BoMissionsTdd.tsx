"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { readMissionAssignment, readMissionLinkedDiaries, type MissionAssignment, type LinkedMissionDiary } from "@/lib/bo-mission-assignments";
import { readBoMissionExecution, reopenBoMissionCompletion, type BoMissionExecution } from "@/lib/bo-mission-completion-client";
import { createBoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry, type TddActionBindings } from "@/lib/workspace-schema";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { TddRenderer } from "@/app/components/workspace-renderer/Renderer";
import { BusinessDataGrid, type SlotLoaders } from "@/app/components/workspace-renderer/Slots";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { formatMissionAuditTime } from "@/lib/bo-mission-audit-projection";
import styles from "./MissionDetailEnhancements.module.css";
import { BoRegistrationWorkspace } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { useBoStagingUser } from "@/app/bo/components/registration/BoRuntimeBoundary";
import { unifiedBoWorkspaceSource } from "@/app/bo/architecture/bo-unified-workspace-source";
import { assignmentDefinition, assignmentFields, assignmentProvider, assignmentQuery, canReadMissionProjectedSlot } from "./schema";
import { BoMissionHistory } from "./BoMissionHistory";
import { useBoCenterSelection } from "@/app/bo/components/registration/BoCenterSelection";
import type { DirectoryCenterSource } from "@/app/bo/pinoria-avatars/centers";

type F = typeof assignmentFields;
type Ready = { centerId: string; adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
type MissionWriteLease = { centerId:string; state:"pending" | "unverified" };
export const assignmentUnavailable = {
  results: "Kết quả chưa khả dụng: nguồn kết quả học viên chưa được kết nối. Trạng thái giao nhiệm vụ không phải kết quả hoàn tất.",
  diary: "Nhật Ký chưa khả dụng: cần nguồn liên kết trực tiếp với nhiệm vụ được giao. Không suy diễn từ Student hoặc Mission.",
} as const;
const missionBusinessLoaders = (onOpenDiary: (row: LinkedMissionDiary) => void): SlotLoaders => ({
  results: async () => <p role="status">{assignmentUnavailable.results}</p>,
  "assignment-linked-diaries": async (_slot, record, context, signal) => {
    const centerId = context.surface === "BO" ? context.centerId : null;
    // PAP-1924: the TDD projection intentionally strips hidden row.center.
    // Check effective BO context and canonical record ID; Core BFF reauthorizes Center on GET.
    if (!centerId || !canReadMissionProjectedSlot(context, record.id))
      return <p role="status">Không có quyền xem Nhật Ký liên kết.</p>;
    return missionLinkedDiaryContent(await readMissionLinkedDiaries(fetch, centerId, record.id, signal), onOpenDiary);
  },
});
/** PAP-1210 / Epic PAP-1188: BO typed TDD and declared shared Action Host only.
 * Read-only Assignment TDD plus narrow audited Manager Reopen exception.
 * Core independently owns every Center grant and mutation.
 */
/** PAP-1460 / Epic PAP-1316: BO shell owns the workspace Center.
 * Keyed children discard stale TDD/Drawer/navigation state on Center switch.
 * Original Core assignment command IDs and CAS remain Center-bound.
 */
export function BoMissionsTdd() {
  const user = useBoStagingUser();
  const center = useBoCenterSelection();
  // Kept in the BO module root across keyed Center switches: no second
  // business command while an earlier Center mutation has unknown outcome.
  const [writeLease,setWriteLease] = useState<MissionWriteLease | null>(null);
  const selected = (!center || center.loading || center.error) ? "" : center.selected;
  const content = <section data-testid="bo-missions-tdd" aria-label="Nhiệm vụ tại Center">
    {!center ? <p role="alert">Không tìm thấy Center context của BO.</p> :
      center.loading ? <p role="status">Đang xác thực cơ sở được cấp quyền…</p> :
      center.error ? <p role="alert">{center.error}</p> :
      !selected ? <p role="status">Chọn trung tâm tại góc trên trái để xem Nhiệm vụ.</p> :
      <>
        {writeLease && writeLease.centerId !== selected ?
          <p role="alert">Lệnh tại cơ sở trước đang chờ kết quả hoặc chưa xác minh. Đối chiếu Core trước khi thao tác.</p> : null}
        <ScopedMissionAssignment key={selected+":"+center.source} centerId={selected} centerSource={center.source}
          writeLease={writeLease} setWriteLease={setWriteLease}/>
      </>}
  </section>;
  return <BoRegistrationWorkspace source={unifiedBoWorkspaceSource} moduleKey="missions" currentUser={user ?? { displayName: null }} content={content} />;
}

function ScopedMissionAssignment({centerId,centerSource,writeLease,setWriteLease}:{
  centerId:string;centerSource:DirectoryCenterSource;writeLease:MissionWriteLease|null;
  setWriteLease:(lease:MissionWriteLease|null)=>void;
}) {
  const leaseBlocked=writeLease !== null;
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [target, setTarget] = useState<MissionAssignment | null>(null);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [formError, setFormError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [confirmed, setConfirmed] = useState("");
  // PAP-1210: Core-owned C1 read enables narrow Manager Reopen in Full Detail.
  const [detailExecution,setDetailExecution]=useState<BoMissionExecution|null>(null);
  const [reopenOpen,setReopenOpen]=useState(false);
  const [reopenVersion,setReopenVersion]=useState<number|null>(null);
  const [reopenReason,setReopenReason]=useState("");
  const commandKey = useRef<string | null>(null);
  const writing = useRef(false);
  const effectiveCenter = useRef(centerId);
  useEffect(() => { effectiveCenter.current = centerId; }, [centerId]);
  useEffect(() => {
    if (!centerId) return;
    const controller = new AbortController();
    let adapter: AuthenticatedSurfaceAdapter<F> | null = null;
    void createBoTddAdapter({ registry: new TddRegistry(), definition: assignmentDefinition,
      provider: assignmentProvider, centerId: centerId, centerSource }, controller.signal)
      .then(bound => {
        adapter = bound;
        if (controller.signal.aborted) { bound.dispose(); return; }
        setReady({ centerId, adapter: bound, navigation: browserTddNavigation("BO", "missions", assignmentQuery) });
      }).catch(e => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Không đủ quyền đọc Nhiệm vụ.");
      });
    return () => { controller.abort(); adapter?.dispose(); };
  }, [centerId, centerSource, retry]);
  const detailId=useSyncExternalStore(
    ready?.navigation.subscribe ?? (()=>()=>{}),
    ()=>{
      if(!ready || ready.centerId!==centerId)return null;
      const nav=ready.navigation.read();
      return nav.kind==="detail"?nav.recordId??null:null;
    },
    ()=>null,
  );
  const [selectedDiary,setSelectedDiary] = useState<LinkedMissionDiary|null>(null);
  const businessLoaders = useMemo(() => missionBusinessLoaders(row => setSelectedDiary(row)), []);
  useEffect(() => setSelectedDiary(null), [centerId,detailId]);
  useEffect(()=>{
    if(!ready || ready.centerId!==centerId || !detailId)return;
    const controller=new AbortController();
    void readBoMissionExecution(fetch,centerId,detailId,controller.signal).then(value=>{
      if(!controller.signal.aborted)setDetailExecution(value);
    }).catch(()=>{if(!controller.signal.aborted)setDetailExecution(null);});
    return ()=>controller.abort();
  },[ready,centerId,detailId]);
  const close = () => {
    if (writing.current || pending) return;
    setReopenOpen(false);setReopenReason("");setReopenVersion(null);
    setTarget(null); setFormError("");
  };
  // Core Completion state is independent of ASSIGNED/CANCELLED and Diary Result.
  const openReopen=async()=>{
    if(!ready || ready.centerId!==centerId || writing.current || pending || uncertain ||
      leaseBlocked || reopenOpen || !detailId ||
      detailExecution?.assignmentId!==detailId ||
      detailExecution?.executionStatus!=="COMPLETED" ||
      !ready.adapter.context.authorize("student.mission_assignment.manage"))return;
    const currentId=detailId;
    setPending(true);setLoadError("");
    try{
      const controller=new AbortController();
      const [assignment,execution]=await Promise.all([
        readMissionAssignment(fetch,centerId,currentId,controller.signal),
        readBoMissionExecution(fetch,centerId,currentId,controller.signal),
      ]);
      if(!assignment || assignment.centerId!==centerId || assignment.status!=="ASSIGNED" ||
        execution.assignmentId!==currentId || execution.assignmentStatus!=="ASSIGNED" ||
        execution.executionStatus!=="COMPLETED" || execution.executionVersion<1){
        setLoadError("Core chưa xác minh Nhiệm vụ Hoàn tất; tải lại bản ghi.");return;
      }
      if(effectiveCenter.current!==centerId || ready.navigation.read().recordId!==currentId ||
        ready.navigation.read().kind!=="detail")return;
      setTarget(assignment);setReopenVersion(execution.executionVersion);setReopenReason("");
      commandKey.current="pap1210-bo-reopen-"+crypto.randomUUID();
      setFormError("");setConfirmed("");setReopenOpen(true);
    }catch{setLoadError("Không đọc được Completion từ Core; không mở lệnh.");}
    finally{setPending(false);}
  };
  const submitReopen=async()=>{
    if(!reopenOpen || !ready || ready.centerId!==centerId || effectiveCenter.current!==centerId ||
      !target || target.centerId!==centerId || target.status!=="ASSIGNED" ||
      ready.navigation.read().kind!=="detail" || ready.navigation.read().recordId!==target.id ||
      reopenVersion===null || reopenVersion<1 || !commandKey.current ||
      writing.current || pending || uncertain || leaseBlocked ||
      !ready.adapter.context.authorize("student.mission_assignment.manage"))
      return {state:"denied" as const};
    const reason=reopenReason.trim();
    if(reason.length<10 || reason.length>500){
      setFormError("Lý do không duyệt phải dài từ 10 đến 500 ký tự.");
      return {state:"invalid" as const};
    }
    writing.current=true;setPending(true);setFormError("");
    setWriteLease({centerId,state:"pending"});
    try{
      const result=await reopenBoMissionCompletion({
        centerId,assignmentId:target.id,expectedVersion:reopenVersion,
        reason,idempotencyKey:commandKey.current,
      });
      setWriteLease(result.state==="unverified"?{centerId,state:"unverified"}:null);
      if(result.state==="verified"){
        if(effectiveCenter.current!==centerId)return result;
        setConfirmed("Core xác minh Mở lại: IN_PROGRESS v"+
          result.execution.executionVersion+". Lịch sử gốc được giữ nguyên.");
        setReopenOpen(false);setReopenVersion(null);setReopenReason("");
        setTarget(null);setDetailExecution(null);setReady(null);setRetry(n=>n+1);
      }else{
        setFormError(result.message);
        if(result.state==="unverified")setUncertain(true);
      }
      return result;
    }catch{
      setUncertain(true);setWriteLease({centerId,state:"unverified"});
      setFormError("Kết quả mở lại chưa xác minh. Không tự gửi lại; đối chiếu Core.");
      return {state:"unverified" as const};
    }finally{writing.current=false;setPending(false);}
  };
  const actions: TddActionBindings = {
    openReopen: { kind:"navigation",
      visible: !reopenOpen && !!detailId &&
        detailExecution?.assignmentId===detailId && detailExecution.centerId===centerId &&
        detailExecution.assignmentStatus==="ASSIGNED" && detailExecution.executionStatus==="COMPLETED",
      disabled:pending || uncertain || leaseBlocked, run:openReopen },
    cancelReopen: { kind:"navigation", visible:reopenOpen, disabled:pending, run:close },
    confirmReopen: { kind:"mutation", visible:reopenOpen,
      disabled:pending || uncertain || leaseBlocked || reopenReason.trim().length<10 ||
        reopenReason.trim().length>500, run:submitReopen },
  };
  return <>
    {confirmed ? <p role="status">{confirmed}</p> : null}
    {loadError ? <p role="alert">{loadError}</p> : null}
    {uncertain ? <p role="alert">Kết quả ghi chưa xác minh. Đối chiếu Core trước khi gửi lại hoặc mở lệnh mới.</p> : null}
    {error ? <p role="alert">{error} <button type="button" onClick={() => { setError("");setRetry(n => n + 1); }}>Thử lại</button></p> :
      ready?.centerId === centerId ? <>
        <SurfaceWorkspace key={centerId} adapter={ready.adapter} navigation={ready.navigation} initialQuery={assignmentQuery}
          businessLoaders={businessLoaders} actionBindings={actions}
          detailHistory={(row, context) => context.surface === "BO" &&
            canReadMissionProjectedSlot(context, row.id)
              ? <div className={styles.missionHistory}>
                  <BoMissionHistory key={context.centerId + ":" + row.id} id={row.id}
                    centerId={context.centerId} context={context} />
                </div>
              : <p role="status">Không có quyền xem lịch sử tại Center này.</p>} />
        {selectedDiary ? <DrawerFrame title={"Nhật Ký · " + formatMissionAuditTime(selectedDiary.registeredAt)}
          path="Nhiệm vụ / Nhật Ký" onClose={() => setSelectedDiary(null)}
          footer={<button className="secondary-btn" type="button" onClick={() => setSelectedDiary(null)}>Đóng</button>}>
          <section className={styles.diaryDrawer} aria-label="Chi tiết Nhật Ký">
            <h3>Thông tin Nhật Ký</h3>
            <div className={styles.diaryDrawerGrid}>{([
              ["Ngày ghi",formatMissionAuditTime(selectedDiary.registeredAt)],
              ["Giáo viên",selectedDiary.teacherLegalFullName ?? "—"],
              ["Ghi chú",selectedDiary.notes?.trim() || "—"],
              ["Học viên","—"], // PAP-1875: Directory name not part of this linked Diary read.
              ["Lớp","—"], // PAP-1875: class title unavailable, do not display UUID.
              ["Ngày học",missionContextDay(selectedDiary.teachingContextKey)],
              ["Trạng thái",selectedDiary.status === "CLOSED" ? "Đã đóng" : "Đã ghi"],
              ["Created Time","—"],["Created By","—"],
              ["Last Modified Time",formatMissionAuditTime(selectedDiary.updatedAt)],
              ["Last Modified By","—"],
            ] as readonly (readonly [string,string])[]).map(([label,value]) =>
              <div className="v24-prop-item" key={label}>
                <div className="v24-prop-key">{label}</div>
                <div className="v24-prop-value readonly">{label === "Ghi chú"
                  ? <span className={styles.noteLines}>{value.split(String.fromCharCode(10)).map((line,index) =>
                      <span key={index}>{line || " "}</span>)}</span>
                  : value}</div>
              </div>)}</div>
          </section>
        </DrawerFrame> : null}
        {reopenOpen && target ? <TddRenderer view={{kind:"form",props:{
          registry:ready.adapter.registry,schema:ready.adapter.schema,context:ready.adapter.context,
          mode:"edit",recordId:target.id,title:"Mở lại nhiệm vụ",
          onClose:close,actionBindings:actions,
          content:<section className={styles.reopenReason} aria-label="Lý do mở lại nhiệm vụ">
            <p>Không duyệt lần hoàn tất này? Mở lại để học viên tiếp tục thực hiện. Nhật ký và lịch sử cũ được giữ nguyên.</p>
            <p><strong>{target.missionNameSnapshot}</strong> · C1 COMPLETED v{reopenVersion}</p>
            <label className="v25-form-field" htmlFor="pap1210-reopen-reason"><span>Lý do không duyệt *</span>
            <textarea id="pap1210-reopen-reason" className="edit-input" rows={3} maxLength={500}
              required aria-required="true"
              placeholder="Nêu nội dung cần chỉnh sửa hoặc bổ sung"
              value={reopenReason} disabled={pending || uncertain}
              onChange={e=>setReopenReason(e.target.value)} /></label>
            {formError?<p role="alert">{formError}</p>:null}
          </section>,
        } }} /> : null}
      </> : <p role="status">Đang xác thực Center và quyền đọc Nhiệm vụ…</p>}
  </>;
}


/** PAP-1875 / Epic PAP-1676: redact opaque context identifier, retain only an
 * independently validated ISO local-date suffix when present.
 */
function missionContextDay(key: string): string {
  const match = /(?:^|:)(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return "—";
  const [year, month, day] = match.slice(1).map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() + 1 !== month ||
      value.getUTCDate() !== day) return "—";
  return String(day).padStart(2, "0") + "/" + String(month).padStart(2, "0") + "/" + year;
}
/** PAP-1818: content-only related Grid; onRowOpen is handled by parent shared DrawerFrame. */
function missionLinkedDiaryContent(
 rows: readonly LinkedMissionDiary[], onRowOpen: (row: LinkedMissionDiary) => void,
): ReactNode {
 if (!rows.length) return <section className="v24-prop-section">
  <p role="status">Chưa có Nhật Ký nào liên kết trực tiếp với lần giao nhiệm vụ này.</p>
 </section>;
 const columns = [
  { key:"registeredAt", header:"Ngày ghi", render:(row:LinkedMissionDiary)=>
    row.registeredAt ? <time dateTime={row.registeredAt}>{formatMissionAuditTime(row.registeredAt)}</time> : "—" },
  { key:"teacherLegalFullName", header:"Giáo viên", render:(row:LinkedMissionDiary)=>row.teacherLegalFullName??"—" },
  { key:"notes", header:"Ghi chú", render:(row:LinkedMissionDiary)=>
    <span className={styles.diaryNotePreview}>{row.notes?.trim()
      ? row.notes.trim().length > 100 ? row.notes.trim().slice(0, 100) + "…" : row.notes.trim()
      : "—"}</span> },
  { key:"status", header:"Trạng thái", render:(row:LinkedMissionDiary)=>row.status==="CLOSED"?"Đã đóng":"Đã ghi" },
  { key:"teachingContextKey", header:"Ngày học", render:(row:LinkedMissionDiary)=>missionContextDay(row.teachingContextKey) },
 ];
 return <section className="v24-prop-section">
  <h3>Nhật Ký đã liên kết</h3>
  <BusinessDataGrid rows={[...rows]} columns={columns} rowKey={row=>row.linkId}
   onRowOpen={onRowOpen}
   caption="Nhật Ký theo nhiệm vụ được giao" showToolbar={false}
   emptyTitle="Chưa có Nhật Ký liên kết" emptyMessage="Chưa có bản ghi được cấp quyền." />
 </section>;
}
