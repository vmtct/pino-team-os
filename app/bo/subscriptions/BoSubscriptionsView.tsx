"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoLearnerDirectoryItem, BoLearnerLifecycle, BoPathProgram, BoRunningClass, BoSubscriptionDirectoryPage, BoSubscriptionProjectedCompletion } from "@/lib/bo-model";
import { LatestRequestFence, collectPagedDirectory } from "@/lib/bo-school-students-state";
import { BillingWorkspace } from "./BillingWorkspace";
import styles from "./bo-subscriptions.module.css";

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };
type Catalog = { paths: BoPathProgram[]; classes: BoRunningClass[] };
type CommandAttempt = { key: string; idempotencyKey: string; action: (idempotencyKey: string) => Promise<unknown>; success: string };

export function BoSubscriptionsView() {
  const [directory, setDirectory] = useState<Load<BoLearnerDirectoryItem[]>>({ state: "loading" });
  const [subscriptionGrid, setSubscriptionGrid] = useState<Load<BoSubscriptionDirectoryPage>>({ state: "loading" });
  const [gridQuery, setGridQuery] = useState("");
  const [gridLifecycle, setGridLifecycle] = useState("");
  const [gridPath, setGridPath] = useState("");
  const [appliedGridFilters, setAppliedGridFilters] = useState<{query:string;lifecycle:string;pathProgramId:string}>({query:"",lifecycle:"",pathProgramId:""});
  const [gridCursorHistory, setGridCursorHistory] = useState<Array<{createdAt:string;id:string}|null>>([null]);
  const [gridPageIndex, setGridPageIndex] = useState(0);
  const [catalog, setCatalog] = useState<Load<Catalog>>({ state: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState<Load<BoLearnerLifecycle> | null>(null);
  const [query, setQuery] = useState("");
  const [placementClass, setPlacementClass] = useState<Record<string, string>>({});
  const [placementDate, setPlacementDate] = useState<Record<string, string>>({});
  const [commandState, setCommandState] = useState<{ busy: string | null; notice: string | null; error: string | null }>({ busy: null, notice: null, error: null });
  const [pendingAttempt, setPendingAttempt] = useState<CommandAttempt | null>(null);
  const detailFence = useRef(new LatestRequestFence());
  const selectedRef = useRef<string | null>(null);

  async function loadSubscriptionGrid(filters = appliedGridFilters, cursor: {createdAt:string;id:string}|null = null) {
    setSubscriptionGrid({ state: "loading" });
    try {
      const data = await boApi.subscriptionDirectory({ ...filters, limit: 25, ...(cursor ? { beforeCreatedAt: cursor.createdAt, beforeSubscriptionId: cursor.id } : {}) });
      setSubscriptionGrid({ state: "ready", data });
    } catch (error) { setSubscriptionGrid({ state: "error", message: message(error) }); }
  }

  async function applyGridFilters(event: React.FormEvent) {
    event.preventDefault();
    const filters = { query: gridQuery.trim(), lifecycle: gridLifecycle, pathProgramId: gridPath };
    setAppliedGridFilters(filters); setGridCursorHistory([null]); setGridPageIndex(0);
    await loadSubscriptionGrid(filters, null);
  }

  async function nextGridPage() {
    if (subscriptionGrid.state !== "ready" || !subscriptionGrid.data.nextCursor) return;
    const cursor = subscriptionGrid.data.nextCursor;
    const history = [...gridCursorHistory.slice(0, gridPageIndex + 1), cursor];
    setGridCursorHistory(history); setGridPageIndex(history.length - 1);
    await loadSubscriptionGrid(appliedGridFilters, cursor);
  }

  async function previousGridPage() {
    if (gridPageIndex <= 0) return;
    const index = gridPageIndex - 1; setGridPageIndex(index);
    await loadSubscriptionGrid(appliedGridFilters, gridCursorHistory[index] ?? null);
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
    if (pendingAttempt) return;
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
  }

  useEffect(() => {
    let active = true;
    const requested = new URLSearchParams(window.location.search).get("studentId");
    void Promise.all([readDirectory(), boApi.scopeCatalog(), boApi.subscriptionDirectory({ limit: 25 })]).then(([rows, scope, subscriptionRows]) => {
      if (!active) return;
      setDirectory({ state: "ready", data: rows });
      setCatalog({ state: "ready", data: { paths: scope.paths, classes: scope.classes } });
      setSubscriptionGrid({ state: "ready", data: subscriptionRows });
      const next = requested && rows.some((row) => row.id === requested) ? requested : rows[0]?.id ?? null;
      selectedRef.current = next;
      setSelectedId(next);
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
      setGridCursorHistory([null]); setGridPageIndex(0);
      await loadSubscriptionGrid(appliedGridFilters, null);
      setPendingAttempt(null);
      setCommandState({ busy: null, notice: attempt.success, error: null });
    } catch (error) {
      const definitiveRejection = error instanceof BoApiError && error.structuredResponse && error.status >= 400 && error.status < 500;
      if (definitiveRejection) setPendingAttempt(null);
      setCommandState({ busy: null, notice: null, error: message(error) });
    }
  }

  async function runCommand(key: string, action: (idempotencyKey: string) => Promise<unknown>, success: string) {
    if (commandState.busy) return;
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

  async function activate(subscription: BoLearnerLifecycle["subscriptions"][number]["subscription"]) {
    await runCommand(`activate:${subscription.id}`, (idempotencyKey) => boApi.activateSubscription(subscription.id, {serviceStartsOn: subscription.serviceStartsOn ?? today(), expectedVersion: subscription.version}, idempotencyKey), "Đã kích hoạt sau khi Core xác nhận đủ placements.");
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
    const start = window.prompt("Ngày bắt đầu service (YYYY-MM-DD, để trống nếu Core tự resolve)", "") ?? "";
    const contractualEndsOn = window.prompt("Contractual end date (YYYY-MM-DD)", subscription.contractualEndsOn ?? "");
    if (!contractualEndsOn?.trim()) return;
    const ref = window.prompt("Commercial reference (tuỳ chọn)", subscription.commercialReference ?? "") ?? "";
    const body = { contractualEndsOn: contractualEndsOn.trim(), weeklyCommitment: subscription.weeklyCommitment, purchasedUnits: Number(unitsText), ...(start.trim() ? { serviceStartsOn: start.trim() } : {}), ...(ref.trim() ? { commercialReference: ref.trim() } : {}) };
    await runCommand(`renew:${subscription.id}`, (idempotencyKey) => boApi.renewSubscription(subscription.id, body, idempotencyKey), "Đã tạo renewal successor; predecessor không bị supersede sớm.");
  }

  async function cancel(subscription: BoLearnerLifecycle["subscriptions"][number]["subscription"]) {
    const reason = window.prompt("Lý do huỷ Subscription");
    if (!reason?.trim()) return;
    const until = window.prompt("Ngày huỷ hiệu lực (YYYY-MM-DD, exclusive)", today());
    if (!until?.trim()) return;
    const body = { expectedVersion: subscription.version, reason: reason.trim(), effectiveUntilExclusiveLocalDate: until.trim() };
    await runCommand(`cancel:${subscription.id}`, (idempotencyKey) => boApi.cancelSubscription(subscription.id, body, idempotencyKey), "Đã huỷ Subscription theo canonical lifecycle.");
  }

  async function endEnrollment(enrollment: BoLearnerLifecycle["subscriptions"][number]["enrollments"][number]) {
    const until = window.prompt("Ngày kết thúc exclusive (YYYY-MM-DD)", today());
    if (!until?.trim()) return;
    const reason = window.prompt("Lý do kết thúc Enrollment");
    if (!reason?.trim()) return;
    const body = { effectiveUntilExclusiveLocalDate: until.trim(), expectedVersion: enrollment.version, reason: reason.trim() };
    await runCommand(`end:${enrollment.id}`, (idempotencyKey) => boApi.endEnrollment(enrollment.id, body, idempotencyKey), "Đã kết thúc Enrollment.");
  }

  if (directory.state === "loading" || catalog.state === "loading") return <State text="Đang tải Subscription workspace…" />;
  if (directory.state === "error") return <State text={directory.message} error />;
  if (catalog.state === "error") return <State text={catalog.message} error />;

  return <main className={styles.page}>
    <header className={styles.heading}>
      <div><span>School · Commercial operations</span><h1>Subscriptions</h1><p>Owner surface cho vòng đời gói học: tạo + kích hoạt, xếp lớp, theo dõi Service Units, renewal và kết thúc.</p></div>
      <div className={styles.boundary}>Core-owned commercial truth</div>
    </header>
    {commandState.notice ? <div className={styles.notice}>{commandState.notice}</div> : null}
    {commandState.error ? <div className={styles.error}>{commandState.error}{pendingAttempt ? <><br /><small>Kết quả chưa xác định. Không đổi dữ liệu; chỉ retry exact command.</small><br /><button type="button" disabled={Boolean(commandState.busy)} onClick={() => void retryPending()}>Thử lại cùng yêu cầu</button></> : null}</div> : null}
    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span>Subscription history</span><h3>Quản lý Subscription</h3></div><small>{subscriptionGrid.state === "ready" ? `${subscriptionGrid.data.total} bản ghi khớp bộ lọc` : "Dữ liệu trực tiếp từ Core"}</small></div>
      <form className={styles.gridFilters} onSubmit={(event) => void applyGridFilters(event)}>
        <input aria-label="Tìm subscription" value={gridQuery} onChange={(event) => setGridQuery(event.target.value)} placeholder="Tìm mã, học viên, nhánh, commercial reference" />
        <select aria-label="Lọc lifecycle" value={gridLifecycle} onChange={(event) => setGridLifecycle(event.target.value)}>
          <option value="">Tất cả trạng thái</option><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="SUPERSEDED">Superseded</option><option value="CANCELLED">Cancelled</option>
        </select>
        <select aria-label="Lọc Path" value={gridPath} onChange={(event) => setGridPath(event.target.value)}>
          <option value="">Tất cả Path</option>{catalog.state === "ready" ? catalog.data.paths.map((path) => <option key={path.id} value={path.id}>{path.displayName}</option>) : null}
        </select>
        <button className={styles.primary} type="submit" disabled={subscriptionGrid.state === "loading"}>Lọc</button>
      </form>
      {subscriptionGrid.state === "loading" ? <p className={styles.muted}>Đang tải Subscription history…</p> : null}
      {subscriptionGrid.state === "error" ? <div className={styles.error}>{subscriptionGrid.message}<button type="button" onClick={() => void loadSubscriptionGrid()}>Thử lại</button></div> : null}
      {subscriptionGrid.state === "ready" ? <>
        <div className={styles.gridWrap}>
          <table className={styles.historyTable}>
            <thead><tr><th>Subscription</th><th>Học viên</th><th>Path / buổi</th><th>Hiệu lực hợp đồng</th><th>Giá cuối</th><th>Units còn lại</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>{subscriptionGrid.data.items.map((item) => <tr key={item.id}>
              <td><button type="button" className={styles.recordLink} onClick={() => selectStudent(item.studentProfileId)}>{item.id.slice(0, 8)}…</button><small>{item.commercialReference ?? "—"}</small></td>
              <td><button type="button" className={styles.recordLink} onClick={() => selectStudent(item.studentProfileId)}>{item.studentDisplayName}</button></td>
              <td>{item.pathDisplayName}<small>{item.weeklyCommitment} buổi/tuần · {item.termWeeks ?? "—"} tuần</small></td>
              <td>{item.serviceStartsOn ?? "—"}<small>→ {item.contractualEndsOn ?? "Không đặt"}</small></td>
              <td>{item.finalAmountMinor === null ? "—" : moneyMinor(item.finalAmountMinor)}<small>{item.itemDiscountMinor + item.billDiscountMinor ? `Giảm ${moneyMinor(item.itemDiscountMinor + item.billDiscountMinor)}` : "Không giảm"}</small></td>
              <td>{item.effectiveAvailableUnits}<small>tổng sổ: {item.historicalBalance}</small></td>
              <td><span className={styles.statusPill} data-status={item.lifecycle}>{item.lifecycle}</span></td>
              <td><button type="button" className={styles.rowAction} onClick={() => selectStudent(item.studentProfileId)}>Chi tiết</button></td>
            </tr>)}
            {!subscriptionGrid.data.items.length ? <tr><td colSpan={8}><p className={styles.empty}>Không có subscription phù hợp.</p></td></tr> : null}</tbody>
          </table>
        </div>
        <div className={styles.gridPager}><span>Trang {gridPageIndex + 1} · {subscriptionGrid.data.items.length} dòng trên trang</span><div><button type="button" disabled={gridPageIndex === 0} onClick={() => void previousGridPage()}>Trước</button><button type="button" disabled={!subscriptionGrid.data.nextCursor} onClick={() => void nextGridPage()}>Tiếp</button></div></div>
      </> : null}
    </section>
    <section className={styles.workspace}>
      <aside className={styles.directory}>
        <div className={styles.search}><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm học viên…" /></div>
        <small>{filtered.length} Student · canonical directory</small>
        <div className={styles.studentList}>
          {filtered.map((student) => <button key={student.id} type="button" disabled={Boolean(commandState.busy || pendingAttempt)} className={selectedId === student.id ? styles.studentActive : styles.student} onClick={() => selectStudent(student.id)}>
            <span className={styles.avatar}>{initials(student.displayName)}</span>
            <span><strong>{student.displayName}</strong><small>{student.activeSubscriptions ? `${student.activeSubscriptions} active Subscription` : "Chưa active"}</small></span>
          </button>)}
          {!filtered.length ? <p className={styles.muted}>Không có Student phù hợp.</p> : null}
        </div>
      </aside>
      <section className={styles.detail}>
        {selectedId ? <CommercialWorkspace load={lifecycle} catalog={catalog.data}
          placementClass={placementClass} setPlacementClass={setPlacementClass} placementDate={placementDate} setPlacementDate={setPlacementDate}
          place={place} activate={activate} renew={renew} cancel={cancel} endEnrollment={endEnrollment} busy={commandState.busy} blocked={Boolean(commandState.busy || pendingAttempt)}
          onChanged={refreshSelected} /> : <State text="Chọn Student để bắt đầu." />}
      </section>
    </section>
  </main>;
}

function CommercialWorkspace(props: {
  load: Load<BoLearnerLifecycle> | null; catalog: Catalog;
  placementClass: Record<string, string>; setPlacementClass: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  placementDate: Record<string, string>; setPlacementDate: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  place: (subscriptionId: string) => Promise<void>; activate: (subscription: BoLearnerLifecycle["subscriptions"][number]["subscription"]) => Promise<void>; renew: (subscription: BoLearnerLifecycle["subscriptions"][number]["subscription"]) => Promise<void>;
  cancel: (subscription: BoLearnerLifecycle["subscriptions"][number]["subscription"]) => Promise<void>;
  endEnrollment: (enrollment: BoLearnerLifecycle["subscriptions"][number]["enrollments"][number]) => Promise<void>; busy: string | null; blocked: boolean;
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

    <BillingWorkspace lifecycle={data} paths={props.catalog.paths} onChanged={props.onChanged} />

    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span>Canonical lifecycle</span><h3>Subscriptions</h3></div><small>Không có client-side unit decrement</small></div>
      {data.subscriptions.length ? <div className={styles.cards}>{data.subscriptions.map((entry) => {
        const sub = entry.subscription;
        const eligibleClasses = props.catalog.classes.filter((item) => item.status === "ACTIVE" && item.pathProgramId === sub.pathProgramId);
        const current = entry.enrollments.filter(isCurrentEnrollment);
        const placedAtStart = entry.enrollments.filter((enrollment) => enrollment.effectiveFromLocalDate <= (sub.serviceStartsOn ?? today()) && (enrollment.effectiveUntilExclusiveLocalDate === null || enrollment.effectiveUntilExclusiveLocalDate > (sub.serviceStartsOn ?? today()))).length;
        return <article className={styles.subscription} key={sub.id}>
          <div className={styles.subHead}>
            <div><span>{sub.lifecycle}</span><strong>{sub.pathDisplayName}</strong><small>{sub.weeklyCommitment} buổi/tuần · v{sub.version}</small></div>
            <div className={styles.balance}><strong>{sub.effectiveAvailableUnits}</strong><span>units</span></div>
          </div>
          <div className={styles.facts}><span>Bắt đầu <b>{sub.serviceStartsOn ?? "—"}</b></span><span>Contract ends <b>{sub.contractualEndsOn ?? "—"}</b></span><span>Ref <b>{sub.commercialReference ?? "—"}</b></span></div>
          <SubscriptionForecast entry={entry} />
          <div className={styles.enrollments}><strong>Enrollment hiện tại</strong>
            {current.length ? current.map((enrollment) => <div key={enrollment.id}><span>{enrollment.runningClassName}</span><small>{enrollment.effectiveFromLocalDate}</small><button type="button" disabled={props.blocked} onClick={() => void props.endEnrollment(enrollment)}>Kết thúc</button></div>) : <p>Chưa có placement hiệu lực.</p>}
          </div>
          {(sub.lifecycle === "DRAFT" || sub.lifecycle === "ACTIVE") ? <div className={styles.placement}>
            <select disabled={props.blocked} value={props.placementClass[sub.id] ?? ""} onChange={(event) => props.setPlacementClass((state) => ({ ...state, [sub.id]: event.target.value }))}>
              <option value="">Chọn Running Class cùng Path</option>{eligibleClasses.map((item) => <option key={item.id} value={item.id}>{item.name} · {scheduleLabel(item)}</option>)}
            </select>
            <input disabled={props.blocked} type="date" value={props.placementDate[sub.id] ?? sub.serviceStartsOn ?? today()} onChange={(event) => props.setPlacementDate((state) => ({ ...state, [sub.id]: event.target.value }))} />
            <button type="button" disabled={props.blocked} onClick={() => void props.place(sub.id)}>Xếp lớp</button>
          </div> : null}
          <div className={styles.actions}>{sub.lifecycle === "DRAFT" ? <button type="button" disabled={props.blocked || placedAtStart !== sub.weeklyCommitment} onClick={() => void props.activate(sub)}>Kích hoạt khi đủ {sub.weeklyCommitment} lớp</button> : null}<button type="button" disabled={props.blocked || sub.lifecycle !== "ACTIVE"} onClick={() => void props.renew(sub)}>Renew</button>
            {sub.lifecycle === "ACTIVE" ? <button className={styles.danger} type="button" disabled={props.blocked} onClick={() => void props.cancel(sub)}>Huỷ Subscription</button> : null}
          </div>
        </article>;
      })}</div> : <p className={styles.empty}>Student chưa có Subscription. Tạo DRAFT qua New sale phía trên, xếp lớp rồi kích hoạt.</p>}
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
function moneyMinor(value: number) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value); }
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function message(error: unknown) { return error instanceof BoApiError ? `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}` : error instanceof Error ? error.message : "Operation failed."; }
function State({ text, error = false }: { text: string; error?: boolean }) { return <div className={`${styles.state} ${error ? styles.stateError : ""}`}><strong>{error ? "Không thể tải" : "PINO BO"}</strong><span>{text}</span></div>; }
