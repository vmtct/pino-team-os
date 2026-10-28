"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoLearnerDirectoryItem, BoLearnerLifecycle, BoPathProgram, BoRunningClass, BoSubscriptionProjectedCompletion } from "@/lib/bo-model";
import { LatestRequestFence, collectPagedDirectory } from "@/lib/bo-school-students-state";
import { SubscriptionHistoryGrid } from "./SubscriptionHistoryGrid";
import { BoFullDetail } from "@/app/bo/components/registration/BoFullDetail";
import { subscriptionModule } from "@/app/bo/components/registration/BoStudentSubscriptionRelation";
import type { BoRecord } from "@/lib/bo-registration";
import { BillingWorkspace, type BillingReplayState } from "./BillingWorkspace";
import { SubscriptionCreateDrawer } from "./SubscriptionCreateDrawer";
import { SpecialtyWorkspace } from "./SpecialtyWorkspace";
import styles from "./bo-subscriptions.module.css";
import {readSubscriptionDetailRoute,subscriptionDetailUrl,type SubscriptionDetailTab} from "@/lib/bo-subscription-detail-url";

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };
type Catalog = { paths: BoPathProgram[]; classes: BoRunningClass[] };
type CommandAttempt = { key: string; idempotencyKey: string; action: (idempotencyKey: string) => Promise<unknown>; success: string };
const EMPTY_BILLING_REPLAY: BillingReplayState = { pending: null, busy: null, notice: null, error: null };

export function BoSubscriptionsView({embedded = false}: {embedded?:boolean} = {}) {
  const [directory, setDirectory] = useState<Load<BoLearnerDirectoryItem[]>>({ state: "loading" });
  const [catalog, setCatalog] = useState<Load<Catalog>>({ state: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState<Load<BoLearnerLifecycle> | null>(null);
  const [query, setQuery] = useState("");
  const [placementClass, setPlacementClass] = useState<Record<string, string>>({});
  const [placementDate, setPlacementDate] = useState<Record<string, string>>({});
  const [commandState, setCommandState] = useState<{ busy: string | null; notice: string | null; error: string | null }>({ busy: null, notice: null, error: null });
  const [pendingAttempt, setPendingAttempt] = useState<CommandAttempt | null>(null);
  const [billingReplay, setBillingReplay] = useState<BillingReplayState>(EMPTY_BILLING_REPLAY);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [historyDetail, setHistoryDetail] = useState<BoRecord | null>(null);
  const [historyTab,setHistoryTab]=useState<SubscriptionDetailTab>("Detail");
  const [detailRoute,setDetailRoute]=useState<{state:"loading"|"error";message?:string}|null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const requestedStudentIdRef = useRef<string | null>(null);
  const operationsRef = useRef<HTMLDetailsElement>(null);
  const detailFence = useRef(new LatestRequestFence());
  const selectedRef = useRef<string | null>(null);

  // PAP-1102 legacy-query compatibility until /bo/subscriptions/:id is separately admitted.
  // URL is identity only: Core independently authorizes each read.
  useEffect(()=>{
    let alive=true,epoch=0;
    const syncRoute=()=>{
      const token=++epoch;
      const route=readSubscriptionDetailRoute(window.location.search);
      setHistoryTab(route.tab);
      if(route.invalid){setHistoryDetail(null);setDetailRoute({state:"error",message:"Subscription ID trên URL không hợp lệ."});return;}
      if(!route.id){setHistoryDetail(null);setDetailRoute(null);return;}
      setHistoryDetail(null);setDetailRoute({state:"loading"});
      void (async()=>{
        try{
          const subscription=await boApi.subscriptionById(route.id!);
          if(subscription.id!==route.id)throw new Error("Subscription ID Core trả về không khớp.");
          let name="Subscription";
          try{
            const learner=await boApi.learnerLifecycle(subscription.studentProfileId);
            if(learner.student?.id===subscription.studentProfileId && learner.student.displayName)name=learner.student.displayName;
          }catch{ /* An unauthorized Student read must not reveal or invent a name. */ }
          if(!alive||token!==epoch)return;
          setHistoryDetail({id:subscription.id,name,path:subscription.pathDisplayName,status:subscription.lifecycle});
          setDetailRoute(null);
        }catch(error){
          if(!alive||token!==epoch)return;
          setHistoryDetail(null);setDetailRoute({state:"error",message:message(error)});
        }
      })();
    };
    window.addEventListener("popstate",syncRoute);
    syncRoute();
    return()=>{alive=false;epoch++;window.removeEventListener("popstate",syncRoute);};
  },[]);

  function openHistoryDetail(record:BoRecord){
    const url=subscriptionDetailUrl(window.location.href,record.id);
    window.history.pushState(null,"",url);
    setHistoryDetail(record);setHistoryTab("Detail");setDetailRoute(null);
  }
  function closeHistoryDetail(){
    const url=subscriptionDetailUrl(window.location.href,null);
    window.history.replaceState(null,"",url);
    setHistoryDetail(null);setDetailRoute(null);setHistoryTab("Detail");
  }

  async function readDirectory() {
    return collectPagedDirectory((beforeStudentId, limit) => boApi.learners("", limit, beforeStudentId));
  }

  async function refreshDirectory(preferId?: string | null) {
    const rows = await readDirectory();
    setDirectory({ state: "ready", data: rows });
    const preferred = preferId ?? selectedRef.current;
    if (preferred && rows.some((row) => row.id === preferred)) return preferred;
    return rows[0]?.id ?? null;
  }

  function selectStudent(id: string | null) {
    if (pendingAttempt || billingReplay.pending || billingReplay.busy) return;
    selectedRef.current = id;
    detailFence.current.invalidate();
    setSelectedId(id);
    setCommandState({ busy: null, notice: null, error: null });
  }

  async function refreshLifecycle(id: string) {
    const ticket = detailFence.current.begin(id);
    setLifecycle({ state: "loading" });
    try {
      const data = await boApi.learnerLifecycle(id);
      if (detailFence.current.isCurrent(ticket, selectedRef.current)) setLifecycle({ state: "ready", data });
    } catch (error) {
      if (detailFence.current.isCurrent(ticket, selectedRef.current)) setLifecycle({ state: "error", message: message(error) });
    }
  }

  async function refreshSelected() {
    const id = selectedRef.current;
    if (!id) return;
    await Promise.all([refreshDirectory(id), refreshLifecycle(id)]);
    setHistoryRevision((value) => value + 1);
  }

  useEffect(() => {
    let active = true;
    const requested = new URLSearchParams(window.location.search).get("studentId");
    requestedStudentIdRef.current = requested;
    void Promise.all([readDirectory(), boApi.scopeCatalog()]).then(([rows, scope]) => {
      if (!active) return;
      setDirectory({ state: "ready", data: rows });
      setCatalog({ state: "ready", data: { paths: scope.paths, classes: scope.classes } });
      const next = requested && rows.some((row) => row.id === requested) ? requested : rows[0]?.id ?? null;
      selectedRef.current = next;
      setSelectedId(next);
      // Student Detail links must reveal the selected student's existing workflow;
      // a global Core cursor page cannot be falsely filtered by client studentId.
      if (requested && next === requested && operationsRef.current) operationsRef.current.open = true;
    }).catch((error: unknown) => {
      if (!active) return;
      const text = message(error);
      setDirectory({ state: "error", message: text });
      setCatalog({ state: "error", message: text });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (selectedId) void refreshLifecycle(selectedId); }, [selectedId]);

  const rows = useMemo(() => directory.state === "ready" ? directory.data : [], [directory]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("vi");
    if (!term) return rows;
    return rows.filter((student) => `${student.displayName} ${student.activePaths.map((path) => path.displayName).join(" ")}`.toLocaleLowerCase("vi").includes(term));
  }, [query, rows]);

  async function executeAttempt(attempt: CommandAttempt) {
    if (commandState.busy) return;
    setCommandState({ busy: attempt.key, notice: null, error: null });
    try {
      await attempt.action(attempt.idempotencyKey);
      await refreshSelected();
      setPendingAttempt(null);
      setCommandState({ busy: null, notice: attempt.success, error: null });
    } catch (error) {
      const definitiveRejection = error instanceof BoApiError && error.structuredResponse && error.status >= 400 && error.status < 500;
      if (definitiveRejection) setPendingAttempt(null);
      setCommandState({ busy: null, notice: null, error: message(error) });
    }
  }

  async function runCommand(key: string, action: (idempotencyKey: string) => Promise<unknown>, success: string) {
    if (commandState.busy || billingReplay.busy || billingReplay.pending) return;
    if (pendingAttempt) {
      if (pendingAttempt.key === key) await executeAttempt(pendingAttempt);
      return;
    }
    const attempt = { key, idempotencyKey: crypto.randomUUID(), action, success };
    setPendingAttempt(attempt);
    await executeAttempt(attempt);
  }

  async function retryPending() {
    if (pendingAttempt) await executeAttempt(pendingAttempt);
  }

  async function place(subscriptionId: string) {
    const runningClassId = placementClass[subscriptionId];
    const effectiveFromLocalDate = placementDate[subscriptionId] ?? today();
    if (!runningClassId) {
      setCommandState({ busy: null, notice: null, error: "Chọn Running Class trước khi xếp lớp." });
      return;
    }
    const body = { subscriptionId, runningClassId, effectiveFromLocalDate, commandEffectiveLocalDate: today(), policyEffectiveAt: new Date().toISOString() };
    await runCommand(`place:${subscriptionId}`, (idempotencyKey) => boApi.placeEnrollment(body, idempotencyKey), "Đã xếp lớp; capacity/commitment được Core kiểm tra.");
  }

  async function renew(subscription: BoLearnerLifecycle["subscriptions"][number]["subscription"]) {
    const unitsText = window.prompt("Số Service Units cho renewal", "24");
    if (unitsText === null) return;
    const start = window.prompt("Ngày bắt đầu gia hạn (YYYY-MM-DD)", today());
    if(!start?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(start.trim())) return;
    const contractualEndsOn = window.prompt("Contractual end date (YYYY-MM-DD)", subscription.contractualEndsOn ?? "");
    if (!contractualEndsOn?.trim() || contractualEndsOn.trim()<start.trim()) return;
    const ref = window.prompt("Commercial reference (tuỳ chọn)", subscription.commercialReference ?? "") ?? "";
    const body = { contractualEndsOn: contractualEndsOn.trim(), weeklyCommitment: subscription.weeklyCommitment, purchasedUnits: Number(unitsText), ...(start.trim() ? { serviceStartsOn: start.trim() } : {}), ...(ref.trim() ? { commercialReference: ref.trim() } : {}) };
    await runCommand(`renew:${subscription.id}`, (idempotencyKey) => boApi.renewSubscription(subscription.id, body, idempotencyKey), "Đã tạo renewal successor; predecessor không bị supersede sớm.");
  }

  async function finishRenewal(subscription: BoLearnerLifecycle["subscriptions"][number]["subscription"]) {
    const serviceStartsOn=subscription.serviceStartsOn ?? subscription.contractualStartsOn;
    if(!subscription.predecessorSubscriptionId || !serviceStartsOn){
      setCommandState({busy:null,notice:null,error:"Gia hạn chưa có ngày bắt đầu hợp lệ."});
      return;
    }
    try{
      const placement=await boApi.subscriptionPlacement(subscription.id,serviceStartsOn);
      if(placement.placementState!=="PLACED"||placement.effectiveEnrollmentCount!==placement.weeklySessionCommitment){
        setCommandState({busy:null,notice:null,error:"Gắn đủ lớp cho gia hạn tại ngày bắt đầu trước khi hoàn tất."});
        return;
      }
    }catch(error){setCommandState({busy:null,notice:null,error:message(error)});return;}
    await runCommand("finish-renewal:"+subscription.id,async(idempotencyKey)=>{
      const live=await boApi.subscriptionById(subscription.id);
      if(live.lifecycle==="ACTIVE")return live;
      if(live.lifecycle!=="DRAFT"||!live.predecessorSubscriptionId)throw new Error("Renewal is not a pending Draft.");
      await boApi.activateSubscription(subscription.id,{serviceStartsOn,expectedVersion:live.version},idempotencyKey);
      const verified=await boApi.subscriptionById(subscription.id);
      if(verified.lifecycle!=="ACTIVE")throw new Error("Renewal activation is not confirmed by Core.");
      return verified;
    },"Core đã hoàn tất gia hạn.");
  }

  async function neutralize(subscription: BoLearnerLifecycle["subscriptions"][number]["subscription"]) {
    const releaseLocalDate = window.prompt("Ngày giải phóng Enrollment/capacity (YYYY-MM-DD)", today());
    if (!releaseLocalDate?.trim()) return;
    const reason = window.prompt("Lý do huỷ Subscription và giải phóng placement");
    if (!reason?.trim()) return;
    const body = { expectedVersion: subscription.version, releaseLocalDate: releaseLocalDate.trim(), reason: reason.trim() };
    await runCommand(`neutralize:${subscription.id}`, (idempotencyKey) => boApi.neutralizeSubscription(subscription.id, body, idempotencyKey), "Đã huỷ Subscription + giải phóng Enrollment/capacity; lịch sử Bill/Payment được giữ nguyên.");
  }

  async function endEnrollment(enrollment: BoLearnerLifecycle["subscriptions"][number]["enrollments"][number]) {
    const until = window.prompt("Ngày kết thúc exclusive (YYYY-MM-DD)", today());
    if (!until?.trim()) return;
    const reason = window.prompt("Lý do kết thúc Enrollment");
    if (!reason?.trim()) return;
    const body = { effectiveUntilExclusiveLocalDate: until.trim(), expectedVersion: enrollment.version, reason: reason.trim() };
    await runCommand(`end:${enrollment.id}`, (idempotencyKey) => boApi.endEnrollment(enrollment.id, body, idempotencyKey), "Đã kết thúc Enrollment.");
  }

  return <div data-bo-runtime-surface="subscriptions-core" data-bo-embedded={embedded || undefined} className={historyDetail||detailRoute ? styles.detailOnly : styles.page}>
    <header className={styles.readHeading}>
      <h1>Subscriptions</h1>
      <button type="button" className="primary-btn" disabled={Boolean(billingReplay.busy || billingReplay.pending || commandState.busy || pendingAttempt)} onClick={() => setCreateOpen(true)}>＋ Tạo mới</button>
    </header>
    {commandState.notice ? <div className={styles.notice}>{commandState.notice}</div> : null}
    {commandState.error ? <div className={styles.error}>{commandState.error}{pendingAttempt ? <><br /><small>Kết quả chưa xác định. Không đổi dữ liệu; chỉ retry exact command.</small><br /><button type="button" disabled={Boolean(commandState.busy)} onClick={() => void retryPending()}>Thử lại cùng yêu cầu</button></> : null}</div> : null}
    <SubscriptionHistoryGrid paths={catalog.state === "ready" ? catalog.data.paths : []} refreshVersion={historyRevision} onFullDetail={openHistoryDetail} />
    {catalog.state === "ready" && directory.state === "ready" ? <details ref={operationsRef} className={styles.operations}>
      <summary>Vận hành gói học hiện hữu · Billing / Placement / Recovery</summary>
    <section className={styles.workspace}>
      <aside className={styles.directory}>
        <div className={styles.search}><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm học viên…" /></div>
        <small>{filtered.length} Student · canonical directory</small>
        <div className={styles.studentList}>
          {filtered.map((student) => <button key={student.id} type="button" disabled={Boolean(commandState.busy || pendingAttempt || billingReplay.busy || billingReplay.pending)} className={selectedId === student.id ? styles.studentActive : styles.student} onClick={() => selectStudent(student.id)}>
            <span className={styles.avatar}>{initials(student.displayName)}</span>
            <span><strong>{student.displayName}</strong><small>{student.activeSubscriptions ? `${student.activeSubscriptions} active Subscription` : "Chưa active"}</small></span>
          </button>)}
          {!filtered.length ? <p className={styles.muted}>Không có Student phù hợp.</p> : null}
        </div>
      </aside>
      <section className={styles.detail}>
        {selectedId ? <CommercialWorkspace load={lifecycle} catalog={catalog.data}
          placementClass={placementClass} setPlacementClass={setPlacementClass} placementDate={placementDate} setPlacementDate={setPlacementDate}
          place={place} renew={renew} finishRenewal={finishRenewal} neutralize={neutralize} endEnrollment={endEnrollment} busy={commandState.busy}
          blocked={Boolean(commandState.busy || pendingAttempt || billingReplay.busy || billingReplay.pending)}
          billingReplay={billingReplay} setBillingReplay={setBillingReplay} onChanged={refreshSelected} /> : <State text="Chọn Student để bắt đầu." />}
      </section>
    </section>
    </details> : <p role="status" className={styles.readHint}>Dữ liệu danh sách Subscription vẫn hoạt động độc lập; workspace vận hành đang tải hoặc thiếu quyền truy cập.</p>}
    {createOpen ? <SubscriptionCreateDrawer
      initialStudentId={requestedStudentIdRef.current}
      paths={catalog.state === "ready" ? catalog.data.paths : []}
      classes={catalog.state === "ready" ? catalog.data.classes : []}
      replayState={billingReplay} setReplayState={setBillingReplay}
      onChanged={() => {setHistoryRevision(n => n+1);}}
      onClose={() => setCreateOpen(false)}
    /> : null}
    {detailRoute ? <div className={styles.readHint} role={detailRoute.state==="error"?"alert":"status"}>
      {detailRoute.state==="loading"?"Đang tải Subscription theo đường dẫn…":detailRoute.message}
      {detailRoute.state==="error"?<><button type="button" onClick={()=>window.dispatchEvent(new PopStateEvent("popstate"))}>Thử lại</button><button type="button" onClick={closeHistoryDetail}>Về danh sách</button></>:null}
    </div>:null}
    {historyDetail ? <BoFullDetail
      key={historyDetail.id}
      module={subscriptionModule}
      moduleKey="subscriptions"
      onEnrollmentChanged={() => setHistoryRevision(v => v + 1)}
      initialTab={historyTab}
      onTabChanged={(next)=>{if(next!=="Detail"&&next!=="Enrollment"&&next!=="Lịch Sử")return;
        const tab=next as SubscriptionDetailTab;
        const url=subscriptionDetailUrl(window.location.href,historyDetail.id,tab);
        window.history.pushState(null,"",url);setHistoryTab(tab);
      }}
      record={historyDetail}
      mobileMenu={null}
      onBack={closeHistoryDetail}
    /> : null}
  </div>;
}

function CommercialWorkspace(props: {
  load: Load<BoLearnerLifecycle> | null; catalog: Catalog;
  placementClass: Record<string, string>; setPlacementClass: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  placementDate: Record<string, string>; setPlacementDate: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  place: (subscriptionId: string) => Promise<void>; renew: (subscription: BoLearnerLifecycle["subscriptions"][number]["subscription"]) => Promise<void>;
  finishRenewal: (subscription: BoLearnerLifecycle["subscriptions"][number]["subscription"]) => Promise<void>;
  neutralize: (subscription: BoLearnerLifecycle["subscriptions"][number]["subscription"]) => Promise<void>;
  endEnrollment: (enrollment: BoLearnerLifecycle["subscriptions"][number]["enrollments"][number]) => Promise<void>; busy: string | null; blocked: boolean;
  billingReplay: BillingReplayState; setBillingReplay: React.Dispatch<React.SetStateAction<BillingReplayState>>;
  onChanged: () => Promise<void>;
}) {
  if (!props.load || props.load.state === "loading") return <State text="Đang tải commercial lifecycle…" />;
  if (props.load.state === "error") return <State text={props.load.message} error />;
  const data = props.load.data;
  const active = data.subscriptions.filter((entry) => entry.subscription.lifecycle === "ACTIVE");
  return <>
    <section className={styles.hero}>
      <div><span>Selected Student</span><h2>{data.student.displayName}</h2><p>{active.length} active Subscription · {active.reduce((sum, entry) => sum + entry.subscription.effectiveAvailableUnits, 0)} Service Units khả dụng</p></div>
      <a href={`/bo/learners?studentId=${encodeURIComponent(data.student.id)}`}>Mở Student 360</a>
    </section>

    <BillingWorkspace lifecycle={data} paths={props.catalog.paths} classes={props.catalog.classes} onChanged={props.onChanged}
      replayState={props.billingReplay} setReplayState={props.setBillingReplay} />

    <SpecialtyWorkspace lifecycle={data} paths={props.catalog.paths} blocked={props.blocked} onChanged={props.onChanged} />

    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span>Canonical lifecycle</span><h3>Subscriptions</h3></div><small>Không có client-side unit decrement</small></div>
      {data.subscriptions.length ? <div className={styles.cards}>{data.subscriptions.map((entry) => {
        const sub = entry.subscription;
        const eligibleClasses = props.catalog.classes.filter((item) => item.status === "ACTIVE" && item.pathProgramId === sub.pathProgramId);
        const current = sub.lifecycle === "ACTIVE" ? entry.enrollments.filter(isCurrentEnrollment) : [];
        return <article className={styles.subscription} key={sub.id}>
          <div className={styles.subHead}>
            <div><span>{sub.lifecycle}</span><strong>{sub.pathDisplayName}</strong><small>{sub.weeklyCommitment} buổi/tuần · v{sub.version}</small></div>
            <div className={styles.balance}><strong>{sub.effectiveAvailableUnits}</strong><span>units</span></div>
          </div>
          <div className={styles.facts}><span>Service starts <b>{sub.serviceStartsOn ?? "—"}</b></span><span>Contract starts <b>{sub.contractualStartsOn ?? "—"}</b></span><span>Contract ends <b>{sub.contractualEndsOn ?? "—"}</b></span><span>Ref <b>{sub.commercialReference ?? "—"}</b></span></div>
          <SubscriptionForecast entry={entry} />
          <div className={styles.enrollments}><strong>Enrollment hiện tại</strong>
            {current.length ? current.map((enrollment) => <div key={enrollment.id}><span>{enrollment.runningClassName}</span><small>{enrollment.effectiveFromLocalDate}</small><button type="button" disabled={props.blocked} onClick={() => void props.endEnrollment(enrollment)}>Kết thúc</button></div>) : <p>Chưa có placement hiệu lực.</p>}
          </div>
          {sub.lifecycle === "ACTIVE" ? <div className={styles.placement}>
            <select disabled={props.blocked} value={props.placementClass[sub.id] ?? ""} onChange={(event) => props.setPlacementClass((state) => ({ ...state, [sub.id]: event.target.value }))}>
              <option value="">Chọn Running Class cùng Path</option>{eligibleClasses.map((item) => <option key={item.id} value={item.id}>{item.name} · {scheduleLabel(item)}</option>)}
            </select>
            <input disabled={props.blocked} type="date" value={props.placementDate[sub.id] ?? today()} onChange={(event) => props.setPlacementDate((state) => ({ ...state, [sub.id]: event.target.value }))} />
            <button type="button" disabled={props.blocked} onClick={() => void props.place(sub.id)}>Xếp lớp</button>
          </div> : null}
          <div className={styles.actions}><button type="button" disabled={props.blocked} onClick={() => void props.renew(sub)}>Renew</button>
            {sub.lifecycle==="DRAFT" && sub.predecessorSubscriptionId ? <button type="button" disabled={props.blocked} onClick={()=>void props.finishRenewal(sub)}>Hoàn tất gia hạn</button> : null}
            {sub.lifecycle === "ACTIVE" ? <button className={styles.danger} type="button" disabled={props.blocked} onClick={() => void props.neutralize(sub)}>Huỷ & giải phóng placement</button> : null}
          </div>
        </article>;
      })}</div> : <p className={styles.empty}>Student chưa có Subscription. Tạo lifecycle đầu tiên ở form phía trên.</p>}
    </section>
  </>;
}

function SubscriptionForecast({ entry }: { entry: BoLearnerLifecycle["subscriptions"][number] }) {
  const sub = entry.subscription;
  const enrollmentSignature = entry.enrollments.map((item) => `${item.id}:${item.version}:${item.effectiveFromLocalDate}:${item.effectiveUntilExclusiveLocalDate ?? ""}`).join("|");
  const [load, setLoad] = useState<Load<BoSubscriptionProjectedCompletion> | null>(null);
  useEffect(() => {
    if (sub.lifecycle !== "ACTIVE") { setLoad(null); return; }
    let active = true;
    setLoad({ state: "loading" });
    void boApi.subscriptionProjectedCompletion(sub.id, new Date().toISOString())
      .then((data) => { if (active) setLoad({ state: "ready", data }); })
      .catch((error: unknown) => { if (active) setLoad({ state: "error", message: message(error) }); });
    return () => { active = false; };
  }, [sub.id, sub.lifecycle, sub.version, sub.effectiveAvailableUnits, enrollmentSignature]);
  const label = sub.lifecycle === "COMPLETED"
    ? sub.completedAt ?? "—"
    : load?.state === "ready"
      ? load.data.status === "PROJECTED" ? load.data.projectedCompletionLocalDate : load.data.status === "ACTUAL" ? load.data.completedAt : `Chưa dự báo · ${load.data.reason}`
      : load?.state === "error" ? "Không tải được forecast" : sub.lifecycle === "ACTIVE" ? "Đang tính…" : "—";
  return <div className={styles.facts}><span>Forecast ends <b>{label}</b></span><span>Nguồn <b>{sub.lifecycle === "ACTIVE" ? "Core cadence + calendar" : "Actual lifecycle"}</b></span></div>;
}

function isCurrentEnrollment(enrollment: BoLearnerLifecycle["subscriptions"][number]["enrollments"][number]) {
  const date = today();
  return enrollment.effectiveFromLocalDate <= date && (enrollment.effectiveUntilExclusiveLocalDate === null || enrollment.effectiveUntilExclusiveLocalDate > date);
}
function scheduleLabel(item: BoRunningClass) { const day = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"]; return `${day[item.recurrenceWeekdays[0] ?? 0] ?? ""} ${item.startLocalTime}`; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase(); }
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function message(error: unknown) { return error instanceof BoApiError ? `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}` : error instanceof Error ? error.message : "Operation failed."; }
function State({ text, error = false }: { text: string; error?: boolean }) { return <div className={`${styles.state} ${error ? styles.stateError : ""}`}><strong>{error ? "Không thể tải" : "PINO BO"}</strong><span>{text}</span></div>; }
