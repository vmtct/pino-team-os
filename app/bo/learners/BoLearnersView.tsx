"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoLearnerDirectoryItem, BoLearnerLifecycle, BoPathProgram, BoRunningClass } from "@/lib/bo-model";
import { LatestRequestFence, RetryKeyStore, clearReplayContext, collectPagedDirectory, initialEnrollmentId, initialSubscriptionId, replayContext, type BoStudentActionIntent } from "@/lib/bo-school-students-state";
import styles from "./bo-learners.module.css";

type Catalog = { paths: BoPathProgram[]; classes: BoRunningClass[] };
type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };
type Filter = "active" | "inactive" | "all";
type Action = BoStudentActionIntent | null;

type ActionSheetProps = {
  action: Exclude<Action, null>;
  lifecycle: BoLearnerLifecycle;
  catalog: Catalog;
  onClose: () => void;
  onChanged: (text: string) => Promise<void>;
  retryKeys: RetryKeyStore;
};

export function BoLearnersView() {
  const [directory, setDirectory] = useState<Load<BoLearnerDirectoryItem[]>>({ state: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Load<BoLearnerLifecycle> | null>(null);
  const [catalog, setCatalog] = useState<Catalog>({ paths: [], classes: [] });
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<Action>(null);
  const [notice, setNotice] = useState("");
  const detailRequestFence = useRef(new LatestRequestFence());
  const selectedIdRef = useRef<string | null>(null);
  const retryKeysRef = useRef<RetryKeyStore | null>(null);
  if (!retryKeysRef.current) retryKeysRef.current = new RetryKeyStore(typeof window === "undefined" ? undefined : window.sessionStorage);
  const retryKeys = retryKeysRef.current;

  async function readDirectory() {
    return collectPagedDirectory((offset, limit) => boApi.learners("", limit, offset));
  }

  function selectStudent(id: string | null) {
    selectedIdRef.current = id;
    detailRequestFence.current.invalidate();
    setSelectedId(id);
    setAction(null);
  }

  async function loadDirectory() {
    try {
      const rows = await readDirectory();
      setDirectory({ state: "ready", data: rows });
      const current = selectedIdRef.current;
      if (!current || !rows.some((item) => item.id === current)) {
        selectStudent(rows.find((item) => item.activeSubscriptions > 0)?.id ?? rows[0]?.id ?? null);
      }
    } catch (error) {
      setDirectory({ state: "error", message: message(error) });
    }
  }

  async function loadDetail(id: string) {
    const ticket = detailRequestFence.current.begin(id);
    setDetail({ state: "loading" });
    try {
      const data = await boApi.learnerLifecycle(id);
      if (detailRequestFence.current.isCurrent(ticket, selectedIdRef.current)) setDetail({ state: "ready", data });
    } catch (error) {
      if (detailRequestFence.current.isCurrent(ticket, selectedIdRef.current)) setDetail({ state: "error", message: message(error) });
    }
  }

  useEffect(() => {
    let active = true;
    void collectPagedDirectory((offset, limit) => boApi.learners("", limit, offset)).then((rows) => {
      if (!active) return;
      setDirectory({ state: "ready", data: rows });
      const next = rows.find((item) => item.activeSubscriptions > 0)?.id ?? rows[0]?.id ?? null;
      selectedIdRef.current = next;
      setSelectedId(next);
    }).catch((error: unknown) => { if (active) setDirectory({ state: "error", message: message(error) }); });
    void boApi.scopeCatalog().then((value) => { if (active) setCatalog({ paths: value.paths, classes: value.classes }); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); }, [selectedId]);

  const rows = useMemo(() => directory.state === "ready" ? directory.data : [], [directory]);
  const activeRows = useMemo(() => rows.filter((student) => student.activeSubscriptions > 0), [rows]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("vi");
    return rows.filter((student) => {
      if (filter === "active" && student.activeSubscriptions === 0) return false;
      if (filter === "inactive" && student.activeSubscriptions > 0) return false;
      if (!term) return true;
      return `${student.displayName} ${student.activePaths.map((path) => path.displayName).join(" ")}`.toLocaleLowerCase("vi").includes(term);
    });
  }, [filter, query, rows]);

  function switchFilter(next: Filter) {
    setFilter(next);
    const first = rows.find((student) => next === "all" || (next === "active" ? student.activeSubscriptions > 0 : student.activeSubscriptions === 0));
    if (first) selectStudent(first.id);
  }

  async function refresh(text?: string) {
    if (text) setNotice(text);
    const current = selectedIdRef.current;
    await loadDirectory();
    if (current && selectedIdRef.current === current) await loadDetail(current);
  }

  if (directory.state === "loading" && !selectedId) return <State text="Đang tải danh sách học viên…" />;
  if (directory.state === "error") return <State text={directory.message} error />;

  return <main className={styles.page}>
    <header className={styles.heading}>
      <div>
        <span>School · Student management</span>
        <h1>Học viên</h1>
        <p>Manager nhìn ngay ai đang học, học chương trình nào, còn bao nhiêu buổi và đang ở lớp nào.</p>
      </div>
      <button className={styles.primaryButton} type="button" disabled={detail?.state !== "ready"} onClick={() => setAction({ kind: "add" })}>+ Chương trình</button>
    </header>

    <section className={styles.metrics}>
      <Metric label="Tổng hồ sơ" value={rows.length} note="canonical Student" />
      <Metric label="Đang học" value={activeRows.length} note="có active Path" />
      <Metric label="House Member" value={rows.filter((item) => item.houseMember).length} note="membership hiện có" />
      <Metric label="Chưa active" value={rows.filter((item) => item.activeSubscriptions === 0).length} note="chưa có active Path" />
    </section>

    {notice ? <div className={styles.notice}>{notice}</div> : null}
    <section className={styles.workspace}>
      <aside className={styles.directory}>
        <div className={styles.searchWrap}><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm học viên, chương trình…" /></div>
        <div className={styles.tabs}>
          <FilterButton active={filter === "active"} onClick={() => switchFilter("active")}>Đang học <b>{activeRows.length}</b></FilterButton>
          <FilterButton active={filter === "inactive"} onClick={() => switchFilter("inactive")}>Chưa active <b>{rows.length - activeRows.length}</b></FilterButton>
          <FilterButton active={filter === "all"} onClick={() => switchFilter("all")}>Tất cả <b>{rows.length}</b></FilterButton>
        </div>
        <div className={styles.directoryMeta}><span>{filtered.length} học viên</span><small>Live canonical read</small></div>
        <div className={styles.studentList}>
          {filtered.map((student) => <StudentButton key={student.id} student={student} active={selectedId === student.id} onClick={() => { selectStudent(student.id); setNotice(""); }} />)}
          {!filtered.length ? <div className={styles.emptyInline}>Không có học viên phù hợp.</div> : null}
        </div>
      </aside>

      <section className={styles.detail}>
        {selectedId ? <LearnerDetail load={detail} catalog={catalog} retryKeys={retryKeys} onAction={setAction} onChanged={refresh} /> : <State text="Chọn học viên để mở hồ sơ." />}
      </section>
    </section>

    {action && detail?.state === "ready" ? <ActionSheet action={action} lifecycle={detail.data} catalog={catalog} retryKeys={retryKeys} onClose={() => setAction(null)} onChanged={async (text) => { setAction(null); await refresh(text); }} /> : null}
  </main>;
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return <article className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={active ? styles.tabActive : ""} onClick={onClick}>{children}</button>;
}

function StudentButton({ student, active, onClick }: { student: BoLearnerDirectoryItem; active: boolean; onClick: () => void }) {
  const learning = student.activeSubscriptions > 0;
  return <button type="button" className={`${styles.studentCard} ${active ? styles.studentCardActive : ""}`} onClick={onClick}>
    <span className={styles.avatarSmall}>{initials(student.displayName)}</span>
    <span className={styles.studentCardBody}>
      <span className={styles.studentNameRow}><strong>{student.displayName}</strong></span>
      <small>{ageLabel(student.birthYear)}</small>
      <span className={styles.studentMeta}>{learning ? student.activePaths.map((path) => path.displayName).join(" · ") : "Chưa có active Path"}</span>
    </span>
    <span className={styles.unitBadge}>{learning ? <><b>{student.activeSubscriptions}</b><small>path</small></> : <small>—</small>}</span>
  </button>;
}

function LearnerDetail({ load, catalog, retryKeys, onAction, onChanged }: {
  load: Load<BoLearnerLifecycle> | null;
  catalog: Catalog;
  retryKeys: RetryKeyStore;
  onAction: (action: Action) => void;
  onChanged: (text?: string) => Promise<void>;
}) {
  if (!load || load.state === "loading") return <State text="Đang tải lifecycle…" />;
  if (load.state === "error") return <State text={load.message} error />;
  const data = load.data;
  const active = data.subscriptions.filter((entry) => entry.subscription.lifecycle === "ACTIVE");
  const units = active.reduce((sum, entry) => sum + entry.subscription.effectiveAvailableUnits, 0);
  return <>
    <StudentHero lifecycle={data} activeCount={active.length} onAction={onAction} />
    <AttentionCard lifecycle={data} />
    <LearningSection lifecycle={data} catalog={catalog} onAction={onAction} />
    <section className={styles.lowerGrid}>
      <GuardianPanel lifecycle={data} retryKeys={retryKeys} onChanged={onChanged} />
      <MembershipPanel lifecycle={data} units={units} />
    </section>
    <SystemDetails lifecycle={data} />
  </>;
}

function StudentHero({ lifecycle, activeCount, onAction }: { lifecycle: BoLearnerLifecycle; activeCount: number; onAction: (action: Action) => void }) {
  const student = lifecycle.student;
  const hasEnrollment = lifecycle.subscriptions.some((entry) => entry.subscription.lifecycle === "ACTIVE" && entry.enrollments.some(isCurrentEnrollment));
  return <section className={styles.heroCard}>
    <div className={styles.heroIdentity}>
      <span className={styles.avatarLarge}>{initials(student.displayName)}</span>
      <div><span className={styles.eyebrow}>Student profile</span><h2>{student.displayName}</h2><p>{ageLabel(student.birthYear)}</p></div>
    </div>
    <div className={styles.heroActions}>
      <button type="button" className={styles.secondaryButton} disabled={!hasEnrollment} onClick={() => onAction({ kind: "transfer" })}>Chuyển lớp</button>
      <button type="button" className={styles.secondaryButton} disabled={!activeCount} onClick={() => onAction({ kind: "renew" })}>Gia hạn</button>
      <button type="button" className={styles.primaryButton} onClick={() => onAction({ kind: "add" })}>+ Chương trình</button>
    </div>
    <div className={styles.heroStatus}>
      <span className={activeCount ? styles.statusActive : styles.statusMuted}>{activeCount ? "Đang học" : "Chưa active"}</span>
      {lifecycle.houseMembership ? <span>House Member</span> : null}
      {activeCount > 1 ? <span>{activeCount} chương trình</span> : null}
    </div>
  </section>;
}

function AttentionCard({ lifecycle }: { lifecycle: BoLearnerLifecycle }) {
  const active = lifecycle.subscriptions.filter((entry) => entry.subscription.lifecycle === "ACTIVE");
  const alerts: string[] = [];
  if (!active.length) alerts.push("Chưa có chương trình đang học — cần tạo Subscription trước khi xếp lớp.");
  const low = active.filter((entry) => entry.subscription.effectiveAvailableUnits <= 4);
  if (low.length) alerts.push(`${low.map((entry) => entry.subscription.pathDisplayName).join(", ")} còn ≤ 4 buổi — nên xử lý renewal sớm.`);
  const unplaced = active.filter((entry) => !entry.enrollments.some(isCurrentEnrollment));
  if (unplaced.length) alerts.push(`${unplaced.map((entry) => entry.subscription.pathDisplayName).join(", ")} chưa có lớp đang hiệu lực.`);
  if (!lifecycle.guardians.length) alerts.push("Chưa có Guardian active trên hồ sơ.");
  if (!alerts.length) return <section className={styles.goodCard}><span>✓</span><div><strong>Hồ sơ đang ổn</strong><p>Không có exception vận hành rõ ràng trong lifecycle hiện tại.</p></div></section>;
  return <section className={styles.attentionCard}><span>!</span><div><strong>Cần chú ý</strong>{alerts.map((alert) => <p key={alert}>{alert}</p>)}</div></section>;
}

function LearningSection({ lifecycle, catalog, onAction }: { lifecycle: BoLearnerLifecycle; catalog: Catalog; onAction: (action: Action) => void }) {
  const active = lifecycle.subscriptions.filter((entry) => entry.subscription.lifecycle === "ACTIVE");
  return <section className={styles.sectionCard}>
    <div className={styles.sectionHeading}>
      <div><span className={styles.eyebrow}>Current learning</span><h3>Chương trình đang học</h3></div>
      <button type="button" className={styles.linkButton} onClick={() => onAction({ kind: "add" })}>+ Thêm chương trình</button>
    </div>
    {active.length ? <div className={styles.learningGrid}>{active.map((entry) => <LearningCard key={entry.subscription.id} entry={entry} catalog={catalog} onAction={onAction} />)}</div> : <div className={styles.emptyState}>
      <strong>Chưa có Subscription active</strong><span>Tạo chương trình học trước, sau đó place học viên vào lớp.</span><button type="button" className={styles.primaryButton} onClick={() => onAction({ kind: "add" })}>Tạo Subscription</button>
    </div>}
  </section>;
}

function LearningCard({ entry, catalog, onAction }: { entry: BoLearnerLifecycle["subscriptions"][number]; catalog: Catalog; onAction: (action: Action) => void }) {
  const subscription = entry.subscription;
  const current = entry.enrollments.filter(isCurrentEnrollment);
  const low = subscription.effectiveAvailableUnits <= Math.max(4, subscription.weeklyCommitment * 2);
  return <article className={`${styles.learningCard} ${low ? styles.learningCardLow : ""}`}>
    <div className={styles.learningCardHead}>
      <div><span>ACTIVE SUBSCRIPTION</span><strong>{subscription.pathDisplayName}</strong><small>{subscription.weeklyCommitment} buổi / tuần</small></div>
      <div className={`${styles.balance} ${low ? styles.balanceLow : ""}`}><strong>{subscription.effectiveAvailableUnits}</strong><span>buổi còn lại</span><small>~ {weeksLeft(subscription.effectiveAvailableUnits, subscription.weeklyCommitment)}</small></div>
    </div>
    <div className={styles.learningFacts}>
      <div><span>Bắt đầu</span><strong>{subscription.serviceStartsOn ?? "—"}</strong></div>
      <div><span>Commercial ref</span><strong>{subscription.commercialReference ?? "—"}</strong></div>
    </div>
    <div className={styles.classList}>
      <span className={styles.eyebrow}>Lớp hiện tại</span>
      {current.length ? current.map((enrollment) => {
        const runningClass = catalog.classes.find((item) => item.id === enrollment.runningClassId);
        return <div key={enrollment.id}><strong>{enrollment.runningClassName}</strong><span>{runningClass ? scheduleLabel(runningClass) : "Theo class schedule"}</span></div>;
      }) : <p>Chưa có class placement hiệu lực.</p>}
    </div>
    <div className={styles.cardActions}>
      <button type="button" onClick={() => onAction(current.length
          ? { kind: "transfer", enrollmentId: current[0]!.id }
          : { kind: "place", subscriptionId: subscription.id })}>{current.length ? "Chuyển lớp" : "Xếp lớp"}</button>
      <button type="button" onClick={() => onAction({ kind: "renew", subscriptionId: subscription.id })}>Gia hạn</button>
    </div>
  </article>;
}

function GuardianPanel({ lifecycle, retryKeys, onChanged }: { lifecycle: BoLearnerLifecycle; retryKeys: RetryKeyStore; onChanged: (text?: string) => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function resetPin(parentId: string, name: string) {
    if (!confirm(`Reset Parent PIN cho ${name}?`)) return;
    setBusy(parentId);
    try {
      const retryTarget = `parent-pin:${parentId}`;
      const key = retryKeys.getOrCreate(retryTarget, () => crypto.randomUUID());
      const result = await boApi.resetParentPin(parentId, key);
      retryKeys.clear(retryTarget);
      await onChanged(`Parent PIN tạm thời: ${result.temporaryPin} · hết hạn ${new Date(result.expiresAt).toLocaleString("vi-VN")}`);
    } catch (error) { alert(message(error)); }
    finally { setBusy(null); }
  }
  return <section className={styles.sectionCard}>
    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Family</span><h3>Guardian</h3></div></div>
    {lifecycle.guardians.length ? <div className={styles.guardianList}>{lifecycle.guardians.map((guardian) => {
      const name = guardian.parent.displayName ?? "Guardian";
      return <article key={guardian.relationshipId}>
        <span className={styles.avatarSmall}>{initials(name)}</span>
        <div><strong>{name}</strong><span>{guardian.relationshipType} · {guardian.parent.status}</span></div>
        <button type="button" className={styles.linkButton} disabled={busy === guardian.parent.id} onClick={() => void resetPin(guardian.parent.id, name)}>{busy === guardian.parent.id ? "Đang reset…" : "Reset PIN"}</button>
      </article>;
    })}</div> : <div className={styles.emptyInline}>Chưa có Guardian active.</div>}
  </section>;
}

function MembershipPanel({ lifecycle, units }: { lifecycle: BoLearnerLifecycle; units: number }) {
  const member = Boolean(lifecycle.houseMembership);
  const active = lifecycle.subscriptions.filter((entry) => entry.subscription.lifecycle === "ACTIVE").length;
  return <section className={styles.sectionCard}>
    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>House</span><h3>Membership</h3></div></div>
    <div className={styles.membershipState}>
      <span className={member ? styles.memberMark : styles.memberMarkMuted}>{member ? "P" : "—"}</span>
      <div><strong>{member ? "House Member" : "Chưa là House Member"}</strong><span>{member ? `Canonical membership · từ ${shortDate(lifecycle.houseMembership!.joinedAt)}` : "Membership được tạo theo canonical promotion flow"}</span></div>
    </div>
    <div className={styles.miniFacts}><div><span>Active paths</span><strong>{active}</strong></div><div><span>Units hiện có</span><strong>{units}</strong></div></div>
  </section>;
}

function SystemDetails({ lifecycle }: { lifecycle: BoLearnerLifecycle }) {
  return <details className={styles.systemDetails}>
    <summary>System details</summary>
    <div><span>Student ID</span><code>{lifecycle.student.id}</code></div>
    <div><span>Status</span><code>{lifecycle.student.status}</code></div>
    <div><span>Birth precision</span><code>{lifecycle.student.birthPrecision}</code></div>
    <div><span>Source</span><code>canonical private BO lifecycle projection</code></div>
  </details>;
}

function ActionSheet({ action, lifecycle, catalog, retryKeys, onClose, onChanged }: ActionSheetProps) {
  const active = lifecycle.subscriptions.filter((entry) => entry.subscription.lifecycle === "ACTIVE");
  const enrollments = active.flatMap((entry) => entry.enrollments.filter(isCurrentEnrollment).map((enrollment) => ({ enrollment, subscription: entry.subscription })));
  const [subscriptionId, setSubscriptionId] = useState(() =>
    initialSubscriptionId(action, active.map((entry) => entry.subscription.id)));
  const [sourceEnrollmentId, setSourceEnrollmentId] = useState(() =>
    initialEnrollmentId(action, enrollments.map((item) => item.enrollment.id)));
  const [pathId, setPathId] = useState(catalog.paths.find((path) => path.status === "ACTIVE")?.id ?? "");
  const [runningClassId, setRunningClassId] = useState("");
  const [date, setDate] = useState(today());
  const [weekly, setWeekly] = useState(2);
  const [units, setUnits] = useState(24);
  const [reason, setReason] = useState("");
  const [entryTime, setEntryTime] = useState("");
  const [duration, setDuration] = useState(90);
  const [busy, setBusy] = useState(false);
  const kind = action.kind;
  const selectedSubscription = active.find((entry) => entry.subscription.id === subscriptionId)?.subscription;
  const source = enrollments.find((item) => item.enrollment.id === sourceEnrollmentId);
  const commandPathId = kind === "add" ? pathId : kind === "transfer" ? source?.subscription.pathProgramId ?? "" : selectedSubscription?.pathProgramId ?? "";
  const eligibleClasses = catalog.classes.filter((item) => item.status === "ACTIVE" && item.pathProgramId === commandPathId && (kind !== "transfer" || item.id !== source?.enrollment.runningClassId));
  const destination = eligibleClasses.find((item) => item.id === runningClassId);
  async function submit() {
    setBusy(true);
    try {
      if (kind === "add") {
        const body = { studentProfileId: lifecycle.student.id, pathProgramId: pathId, serviceStartsOn: date, weeklyCommitment: weekly, purchasedUnits: units };
        const target = JSON.stringify({ kind, body });
        const replay = replayContext(retryKeys, target, () => crypto.randomUUID(), today, () => new Date().toISOString());
        await boApi.createSubscription(body, replay.idempotencyKey);
        clearReplayContext(retryKeys, target);
        await onChanged("Subscription đã được tạo và activate.");
      } else if (kind === "renew" && selectedSubscription) {
        const body = { serviceStartsOn: date, weeklyCommitment: selectedSubscription.weeklyCommitment, purchasedUnits: units };
        const target = JSON.stringify({ kind, subscriptionId: selectedSubscription.id, body });
        const replay = replayContext(retryKeys, target, () => crypto.randomUUID(), today, () => new Date().toISOString());
        await boApi.renewSubscription(selectedSubscription.id, body, replay.idempotencyKey);
        clearReplayContext(retryKeys, target);
        await onChanged("Renewal đã được tạo theo commercial lineage.");
      } else if (kind === "place" && selectedSubscription && destination) {
        const intent = { subscriptionId: selectedSubscription.id, runningClassId: destination.id, effectiveFromLocalDate: date, ...placementFields(destination, entryTime, duration) };
        const target = JSON.stringify({ kind, intent });
        const replay = replayContext(retryKeys, target, () => crypto.randomUUID(), today, () => new Date().toISOString());
        await boApi.placeEnrollment({ ...intent, commandEffectiveLocalDate: replay.commandEffectiveLocalDate, policyEffectiveAt: replay.policyEffectiveAt }, replay.idempotencyKey);
        clearReplayContext(retryKeys, target);
        await onChanged("Enrollment đã được place vào lớp.");
      } else if (kind === "transfer" && source && destination) {
        const intent = { destinationRunningClassId: destination.id, transferLocalDate: date, ...placementFields(destination, entryTime, duration), reason };
        const target = JSON.stringify({ kind, enrollmentId: source.enrollment.id, intent });
        const replay = replayContext(retryKeys, target, () => crypto.randomUUID(), today, () => new Date().toISOString());
        await boApi.transferEnrollment(source.enrollment.id, { ...intent, commandEffectiveLocalDate: replay.commandEffectiveLocalDate, policyEffectiveAt: replay.policyEffectiveAt }, replay.idempotencyKey);
        clearReplayContext(retryKeys, target);
        await onChanged("Enrollment đã được chuyển lớp atomically.");
      }
    } catch (error) { alert(message(error)); }
    finally { setBusy(false); }
  }

  const copy = kind === "add" ? ["Thêm chương trình", "Tạo Subscription mới cho Student hiện tại."]
    : kind === "renew" ? ["Gia hạn Subscription", "Tạo renewal giữ nguyên commercial lineage."]
      : kind === "place" ? ["Xếp lớp", "Place Subscription vào Running Class phù hợp."]
        : ["Chuyển lớp", "Atomic schedule transfer giữ canonical Enrollment history."];

  const invalidFlexible = destination?.deliveryTopology === "FLEXIBLE_STUDIO" && (!entryTime || duration < 1);
  const disabled = busy || (kind === "add" && !pathId) || (kind === "renew" && !selectedSubscription)
    || (kind === "place" && (!selectedSubscription || !destination || invalidFlexible))
    || (kind === "transfer" && (!source || !destination || !reason.trim() || invalidFlexible));

  return <div className={styles.sheetScrim} onMouseDown={onClose}>
    <section className={styles.sheet} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span className={styles.eyebrow}>Manager command · Canonical</span><h3>{copy[0]}</h3><p>{lifecycle.student.displayName} · {copy[1]}</p></div><button type="button" onClick={onClose}>×</button></header>
      <div className={styles.sheetFields}>
        {kind === "add" ? <label>Path<select value={pathId} onChange={(event) => setPathId(event.target.value)}>{catalog.paths.filter((path) => path.status === "ACTIVE").map((path) => <option key={path.id} value={path.id}>{path.displayName}</option>)}</select></label> : null}
        {kind === "renew" || kind === "place" ? <label>Subscription<select value={subscriptionId} onChange={(event) => { setSubscriptionId(event.target.value); setRunningClassId(""); }}>{active.map((entry) => <option key={entry.subscription.id} value={entry.subscription.id}>{entry.subscription.pathDisplayName} · {entry.subscription.effectiveAvailableUnits} buổi</option>)}</select></label> : null}
        {kind === "transfer" ? <label>Enrollment hiện tại<select value={sourceEnrollmentId} onChange={(event) => { setSourceEnrollmentId(event.target.value); setRunningClassId(""); }}>{enrollments.map((item) => <option key={item.enrollment.id} value={item.enrollment.id}>{item.subscription.pathDisplayName} · {item.enrollment.runningClassName}</option>)}</select></label> : null}
        {kind === "add" ? <label>Cam kết / tuần<input type="number" min={1} max={7} value={weekly} onChange={(event) => setWeekly(Number(event.target.value))} /></label> : null}
        {kind === "add" || kind === "renew" ? <label>Service Units<input type="number" min={1} value={units} onChange={(event) => setUnits(Number(event.target.value))} /></label> : null}
        {kind === "place" || kind === "transfer" ? <label>Lớp mới<select value={runningClassId} onChange={(event) => setRunningClassId(event.target.value)}><option value="">Chọn lớp…</option>{eligibleClasses.map((item) => <option key={item.id} value={item.id}>{item.name} · {scheduleLabel(item)}</option>)}</select></label> : null}
        <label>{kind === "transfer" ? "Hiệu lực từ" : "Ngày bắt đầu"}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        {(kind === "place" || kind === "transfer") && destination?.deliveryTopology === "FLEXIBLE_STUDIO" ? <>
          <label>Giờ vào<input type="time" value={entryTime} onChange={(event) => setEntryTime(event.target.value)} /></label>
          <label>Thời lượng<input type="number" min={1} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
        </> : null}
        {kind === "transfer" ? <label>Lý do<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="VD: đổi lịch học" /></label> : null}
      </div>
      <div className={styles.sheetNote}><strong>Canonical command</strong><span>Command này gọi owner facade và ghi canonical Core khi xác nhận. Permission/validation vẫn do owner kiểm soát.</span></div>
      <footer><button type="button" className={styles.secondaryButton} onClick={onClose}>Huỷ</button><button type="button" disabled={disabled} className={styles.primaryButton} onClick={() => void submit()}>{busy ? "Đang xử lý…" : "Xác nhận"}</button></footer>
    </section>
  </div>;
}

function placementFields(runningClass: BoRunningClass, entryTime: string, duration: number) {
  return runningClass.deliveryTopology === "FLEXIBLE_STUDIO" ? { plannedEntryLocalTime: entryTime, plannedDurationMinutes: duration } : {};
}

function isCurrentEnrollment(enrollment: BoLearnerLifecycle["subscriptions"][number]["enrollments"][number]) {
  const now = today();
  return enrollment.effectiveFromLocalDate <= now && (enrollment.effectiveUntilExclusiveLocalDate === null || enrollment.effectiveUntilExclusiveLocalDate > now);
}
function scheduleLabel(item: BoRunningClass) {
  const day = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
  return `${day[item.recurrenceWeekdays[0] ?? 0] ?? ""} · ${item.startLocalTime}`;
}
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase(); }
function ageLabel(year: number | null) { return year ? `${year} · ~${Math.max(0, new Date().getFullYear() - year)} tuổi` : "Chưa có năm sinh"; }
function weeksLeft(units: number, weekly: number) { if (!weekly) return "—"; const weeks = units / weekly; return weeks < 1 ? "< 1 tuần" : `${weeks.toFixed(weeks < 3 ? 1 : 0)} tuần`; }
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function shortDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium" }).format(new Date(value)); }
function State({ text, error = false }: { text: string; error?: boolean }) { return <div className={`${styles.emptyState} ${error ? styles.errorState : ""}`}><strong>{error ? "Không thể tải" : "PINO BO"}</strong><span>{text}</span></div>; }
function message(error: unknown) { return error instanceof BoApiError ? `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}` : error instanceof Error ? error.message : "Command failed."; }
