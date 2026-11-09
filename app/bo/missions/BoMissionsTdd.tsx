"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { readMissionAssignment, readMissionLinkedDiaries, type MissionAssignment, type LinkedMissionDiary } from "@/lib/bo-mission-assignments";
import { readBoMissionExecution, reopenBoMissionCompletion, type BoMissionExecution } from "@/lib/bo-mission-completion-client";
import { submitBoMissionAssignment, type AssignmentWrite } from "@/lib/bo-mission-assignment-command";
import { createBoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry, type TddActionBindings } from "@/lib/workspace-schema";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { TddRenderer } from "@/app/components/workspace-renderer/Renderer";
import { BusinessDataGrid, type SlotLoaders } from "@/app/components/workspace-renderer/Slots";
import { BoRegistrationWorkspace } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { useBoStagingUser } from "@/app/bo/components/registration/BoRuntimeBoundary";
import { unifiedBoWorkspaceSource } from "@/app/bo/architecture/bo-unified-workspace-source";
import { assignmentDefinition, assignmentFields, assignmentProvider, assignmentQuery } from "./schema";
import { AssignmentFields, assignmentFormError, emptyAssignmentDraft, type AssignmentDraft } from "./AssignmentFields";
import { useBoCenterSelection } from "@/app/bo/components/registration/BoCenterSelection";
import type { DirectoryCenterSource } from "@/app/bo/pinoria-avatars/centers";

type F = typeof assignmentFields;
type Ready = { centerId: string; adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
type FormMode = "create" | "edit" | "cancel";
type MissionWriteLease = { centerId:string; state:"pending" | "unverified" };
export const assignmentUnavailable = {
  results: "Kết quả chưa khả dụng: nguồn kết quả học viên chưa được kết nối. Trạng thái giao nhiệm vụ không phải kết quả hoàn tất.",
  diary: "Nhật Ký chưa khả dụng: cần nguồn liên kết trực tiếp với nhiệm vụ được giao. Không suy diễn từ Student hoặc Mission.",
  create: "Chọn học viên và nhiệm vụ đang hoạt động để giao nhiệm vụ.",
} as const;
const businessLoaders: SlotLoaders = {
  results: async () => <p role="status">{assignmentUnavailable.results}</p>,
  "assignment-linked-diaries": async (_slot, record, context, signal) => {
    const centerId = context.surface === "BO" ? context.centerId : null;
    if (context.surface !== "BO" || !centerId || record.center !== centerId ||
        !context.authorize("student.mission_assignment.view"))
      return <p role="status">Không có quyền xem Nhật Ký liên kết.</p>;
    return missionLinkedDiaryContent(await readMissionLinkedDiaries(fetch, centerId, record.id, signal));
  },
};
/** PAP-1210 / Epic PAP-1188: BO typed TDD and declared shared Action Host only.
 * Source-backed Student/Mission selectors; receipt/readback, no optimistic fake status.
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
  const [mode, setMode] = useState<FormMode | null>(null);
  const [target, setTarget] = useState<MissionAssignment | null>(null);
  const [draft, setDraft] = useState<AssignmentDraft>(emptyAssignmentDraft);
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
    setMode(null);setReopenOpen(false);setReopenReason("");setReopenVersion(null);
    setTarget(null); setFormError("");
  };
  const openCreate = () => {
    if (!ready || ready.centerId !== centerId || writing.current || pending || uncertain || leaseBlocked || mode || reopenOpen) return;
    if (!ready.adapter.context.authorize("student.mission_assignment.manage")) return;
    commandKey.current = "mission-assignment-create-" + crypto.randomUUID();
    setDraft(emptyAssignmentDraft); setTarget(null); setFormError(""); setLoadError(""); setConfirmed(""); setMode("create");
  };
  const openChange = async (kind: "edit" | "cancel") => {
    if (!ready || ready.centerId !== centerId || writing.current || pending || uncertain || leaseBlocked || mode || reopenOpen) return;
    if (!ready.adapter.context.authorize("student.mission_assignment.manage")) return;
    const selected = ready.navigation.read();
    if (selected.kind !== "detail" || !selected.recordId) return;
    setPending(true);setLoadError("");
    try {
      const current = await readMissionAssignment(fetch, centerId, selected.recordId, new AbortController().signal);
      if (!current || current.status !== "ASSIGNED") {
        setLoadError("Nhiệm vụ không còn đang giao. Tải lại bản ghi trước khi thao tác.");
        return;
      }
      if (ready.centerId !== centerId || effectiveCenter.current !== centerId ||
          ready.navigation.read().recordId !== current.id) return;
      setTarget(current);
      setDraft({ ...emptyAssignmentDraft, studentId: current.studentId, missionId: current.missionId,
        contextLabel: current.contextLabel ?? "" });
      commandKey.current = "mission-assignment-" + kind + "-" + crypto.randomUUID();
      setFormError("");setConfirmed("");setMode(kind);
    } catch {
      setLoadError("Không đọc được bản ghi hiện tại từ Core; không thao tác trên bản cũ.");
    } finally { setPending(false); }
  };
  // Core Completion state is independent of ASSIGNED/CANCELLED and Diary Result.
  const openReopen=async()=>{
    if(!ready || ready.centerId!==centerId || writing.current || pending || uncertain ||
      leaseBlocked || mode || reopenOpen || !detailId ||
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
  const submit = async () => {
    if (!mode || !ready || ready.centerId !== centerId || effectiveCenter.current !== centerId ||
        !commandKey.current || writing.current || uncertain || pending || leaseBlocked) return { state: "unverified" as const };
    if (!ready.adapter.context.authorize("student.mission_assignment.manage")) return { state: "denied" as const };
    const invalid = assignmentFormError(mode, draft);
    if (invalid) { setFormError(invalid); return { state: "invalid" as const }; }
    if (mode !== "create" && (!target || target.centerId !== centerId || target.status !== "ASSIGNED")) {
      setFormError("Nhiệm vụ đã thay đổi hoặc khác Center. Tải lại bản ghi.");
      return { state: "invalid" as const };
    }
    let command: AssignmentWrite;
    if (mode === "create") command = { kind: "create", centerId, studentId: draft.studentId,
      missionId: draft.missionId, contextLabel: draft.contextLabel.trim() || null, idempotencyKey: commandKey.current };
    else if (mode === "edit") command = { kind: "update", centerId, id: target!.id,
      expectedVersion: target!.version, contextLabel: draft.contextLabel.trim() || null, idempotencyKey: commandKey.current };
    else command = { kind: "cancel", centerId, id: target!.id, expectedVersion: target!.version,
      reason: draft.cancelReason.trim(), idempotencyKey: commandKey.current };
    writing.current = true;setPending(true);setFormError("");
    setWriteLease({centerId,state:"pending"});
    try {
      const result = await submitBoMissionAssignment(command);
      setWriteLease(result.state === "unverified" ? {centerId,state:"unverified"} : null);
      if (result.state === "verified") {
        if (effectiveCenter.current !== centerId) return result;
        setConfirmed("Đã đối chiếu giao Nhiệm vụ trên Core (" + result.record.missionCodeSnapshot + ").");
        setMode(null); setTarget(null); setReady(null); setRetry(n => n + 1);
      } else {
        setFormError(result.message);
        if (result.state === "unverified") setUncertain(true);
      }
      return result;
    } catch {
      // A lost response may hide a successful Core write. Never replay automatically.
      setUncertain(true);setWriteLease({centerId,state:"unverified"});
      setFormError("Kết quả ghi chưa xác minh. Đối chiếu Core trước khi thử lại.");
      return {state:"unverified" as const};
    } finally { writing.current = false;setPending(false); }
  };
  const actions: TddActionBindings = {
    openCreate: { kind: "navigation", disabled: pending || uncertain || leaseBlocked || mode !== null || reopenOpen, run: openCreate },
    openEdit: { kind: "navigation", disabled: pending || uncertain || leaseBlocked || mode !== null || reopenOpen, run: () => openChange("edit") },
    openCancel: { kind: "navigation", disabled: pending || uncertain || leaseBlocked || mode !== null || reopenOpen, run: () => openChange("cancel") },
    openReopen: { kind: "navigation", visible: !reopenOpen && mode===null && !!detailId &&
      detailExecution?.assignmentId===detailId && detailExecution.centerId===centerId &&
      detailExecution.executionStatus==="COMPLETED" &&
      detailExecution.assignmentStatus==="ASSIGNED",
      disabled: pending || uncertain || leaseBlocked, run: openReopen },
    cancelCreate: { kind: "navigation", disabled: pending, run: close },
    saveCreate: { kind: "mutation", disabled: pending || uncertain || leaseBlocked || mode !== "create" ||
      Boolean(assignmentFormError("create", draft)), run: submit },
    cancelEdit: { kind: "navigation", disabled: pending, run: close },
    saveEdit: { kind: "mutation", visible: mode === "edit", disabled: pending || uncertain || leaseBlocked ||
      Boolean(assignmentFormError("edit", draft)), run: submit },
    confirmCancel: { kind: "mutation", visible: mode === "cancel", disabled: pending || uncertain || leaseBlocked ||
      Boolean(assignmentFormError("cancel", draft)), run: submit },
    confirmReopen: { kind: "mutation", visible: reopenOpen, disabled: pending || uncertain || leaseBlocked ||
      reopenReason.trim().length<10 || reopenReason.trim().length>500, run: submitReopen },
  };
  return <>
    <p role="note">{assignmentUnavailable.create}</p>
    {confirmed ? <p role="status">{confirmed}</p> : null}
    {loadError ? <p role="alert">{loadError}</p> : null}
    {uncertain ? <p role="alert">Kết quả ghi chưa xác minh. Đối chiếu Core trước khi gửi lại hoặc mở lệnh mới.</p> : null}
    {error ? <p role="alert">{error} <button type="button" onClick={() => { setError("");setRetry(n => n + 1); }}>Thử lại</button></p> :
      ready?.centerId === centerId ? <>
        <SurfaceWorkspace key={centerId} adapter={ready.adapter} navigation={ready.navigation} initialQuery={assignmentQuery}
          businessLoaders={businessLoaders} actionBindings={actions} />
        {mode ? <TddRenderer view={{ kind: "form", props: {
          registry: ready.adapter.registry, schema: ready.adapter.schema, context: ready.adapter.context,
          mode: mode === "create" ? "create" : "edit",
          ...(target ? { recordId: target.id } : {}),
          title: mode === "create" ? "Giao Nhiệm vụ" : mode === "edit" ? "Sửa Nhiệm vụ" : "Hủy giao Nhiệm vụ",
          onClose: close, actionBindings: actions,
          content: <>
            <AssignmentFields key={centerId + ":" + mode} centerId={centerId} mode={mode}
              value={draft} setValue={setDraft} disabled={pending || uncertain} target={target ?
                { studentId: target.studentId, missionName: target.missionNameSnapshot, status: target.status } : null} />
            {formError ? <p role="alert">{formError}</p> : null}
          </>,
        } }} /> : null}
        {reopenOpen && target ? <TddRenderer view={{kind:"form",props:{
          registry:ready.adapter.registry,schema:ready.adapter.schema,context:ready.adapter.context,
          mode:"edit",recordId:target.id,title:"Mở lại nhiệm vụ",
          onClose:close,actionBindings:actions,
          content:<section className="v24-prop-section" aria-label="Lý do mở lại nhiệm vụ">
            <p>Không duyệt lần hoàn tất này? Mở lại để học viên tiếp tục thực hiện. Nhật ký và lịch sử cũ được giữ nguyên.</p>
            <p><strong>{target.missionNameSnapshot}</strong> · C1 COMPLETED v{reopenVersion}</p>
            <label htmlFor="pap1210-reopen-reason">Lý do không duyệt *</label>
            <textarea id="pap1210-reopen-reason" rows={3} maxLength={500}
              required aria-required="true"
              placeholder="Nêu nội dung cần chỉnh sửa hoặc bổ sung"
              value={reopenReason} disabled={pending || uncertain}
              onChange={e=>setReopenReason(e.target.value)} />
            {formError?<p role="alert">{formError}</p>:null}
          </section>,
        } }} /> : null}
      </> : <p role="status">Đang xác thực Center và quyền đọc Nhiệm vụ…</p>}
  </>;
}


/** PAP-1193: content-only business slot, DS DataGrid owns internal table. */
function missionLinkedDiaryContent(rows: readonly LinkedMissionDiary[]): ReactNode {
 if (!rows.length) return <section className="v24-prop-section">
  <p role="status">Chưa có Nhật Ký nào liên kết trực tiếp với lần giao nhiệm vụ này.</p>
 </section>;
 const columns = [
  { key:"registeredAt", header:"Ngày ghi", render:(row:LinkedMissionDiary)=>row.registeredAt??"—" },
  { key:"diaryId", header:"Diary ID", render:(row:LinkedMissionDiary)=>row.diaryId },
  { key:"teachingContextKey", header:"Bối cảnh dạy", render:(row:LinkedMissionDiary)=>row.teachingContextKey||"—" },
  { key:"runningClassId", header:"Lớp", render:(row:LinkedMissionDiary)=>row.runningClassId??"—" },
  { key:"registeredByUserId", header:"Giáo viên", render:(row:LinkedMissionDiary)=>row.registeredByUserId??"—" },
  { key:"status", header:"Trạng thái", render:(row:LinkedMissionDiary)=>row.status==="CLOSED"?"Đã đóng":"Đã ghi" },
 ];
 return <section className="v24-prop-section">
  <h3>Nhật Ký đã liên kết</h3>
  <BusinessDataGrid rows={[...rows]} columns={columns} rowKey={row=>row.linkId}
   caption="Nhật Ký theo nhiệm vụ được giao" showToolbar={false}
   emptyTitle="Chưa có Nhật Ký liên kết" emptyMessage="Chưa có bản ghi được cấp quyền." />
 </section>;
}
