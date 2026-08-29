"use client";

import { useEffect, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoLearnerDirectoryItem, BoLearnerLifecycle, BoPathProgram, BoRunningClass } from "@/lib/bo-model";
import styles from "../bo.module.css";

type Catalog = { paths: BoPathProgram[]; classes: BoRunningClass[] };
type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };

export function BoLearnersView() {
  const [query, setQuery] = useState("");
  const [directory, setDirectory] = useState<Load<BoLearnerDirectoryItem[]>>({ state: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Load<BoLearnerLifecycle> | null>(null);
  const [catalog, setCatalog] = useState<Catalog>({ paths: [], classes: [] });
  const [notice, setNotice] = useState("");

  async function loadDirectory(search = query) {
    setDirectory({ state: "loading" });
    try {
      const rows = await boApi.learners(search);
      setDirectory({ state: "ready", data: rows });
      if (!selectedId && rows[0]) setSelectedId(rows[0].id);
    } catch (error) { setDirectory({ state: "error", message: message(error) }); }
  }
  async function loadDetail(id: string) {
    setDetail({ state: "loading" });
    try { setDetail({ state: "ready", data: await boApi.learnerLifecycle(id) }); }
    catch (error) { setDetail({ state: "error", message: message(error) }); }
  }
  useEffect(() => {
    let active = true;
    void boApi.learners("").then((rows) => {
      if (!active) return;
      setDirectory({ state: "ready", data: rows });
      if (rows[0]) setSelectedId((current) => current ?? rows[0]!.id);
    }).catch((error: unknown) => { if (active) setDirectory({ state: "error", message: message(error) }); });
    void boApi.scopeCatalog().then((value) => { if (active) setCatalog({ paths: value.paths, classes: value.classes }); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); }, [selectedId]);

  async function refresh() {
    if (selectedId) await loadDetail(selectedId);
    await loadDirectory(query);
  }

  if (directory.state === "loading" && !selectedId) return <State text="Đang tải learner directory…" />;
  if (directory.state === "error") return <State text={directory.message} error />;
  const rows = directory.state === "ready" ? directory.data : [];

  return <main className={styles.page}>
    <header className={styles.heading}>
      <span>Back Office · Learner Lifecycle</span>
      <h1>Learners</h1>
      <p>Canonical Student → Guardian → Membership → Subscription → Enrollment. Mọi mutation chạy qua pino-core.</p>
    </header>
    {notice ? <div className={styles.successCard}><span>Command completed</span><strong>{notice}</strong></div> : null}
    <section className={styles.learnerWorkspace}>
      <aside className={styles.learnerDirectory}>
        <form className={styles.learnerSearch} onSubmit={(event) => { event.preventDefault(); void loadDirectory(query); }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên learner…" />
          <button className={styles.secondaryButton}>Tìm</button>
        </form>
        <small>{rows.length} learner</small>
        {rows.map((learner) => <button key={learner.id} className={`${styles.learnerCard} ${selectedId === learner.id ? styles.learnerCardActive : ""}`} onClick={() => { setNotice(""); setSelectedId(learner.id); }}>
          <strong>{learner.displayName}</strong>
          <span>{learner.birthYear ?? "—"} · {learner.houseMember ? "House Member" : "Pre-member"}</span>
          <small>{learner.activePaths.map((path) => path.displayName).join(" · ") || "Chưa có active Path"}</small>
        </button>)}
      </aside>
      <section className={styles.learnerDetail}>{selectedId ? <LearnerDetail load={detail} catalog={catalog} onChanged={async (text) => { setNotice(text); await refresh(); }} /> : <State text="Chọn một learner để mở lifecycle." />}</section>
    </section>
  </main>;
}
function LearnerDetail({ load, catalog, onChanged }: { load: Load<BoLearnerLifecycle> | null; catalog: Catalog; onChanged: (text: string) => Promise<void> }) {
  const [busy, setBusy] = useState("");
  const [pathId, setPathId] = useState("");
  const [startsOn, setStartsOn] = useState(today());
  const [weekly, setWeekly] = useState(2);
  const [units, setUnits] = useState(24);
  if (!load || load.state === "loading") return <State text="Đang tải lifecycle…" />;
  if (load.state === "error") return <State text={load.message} error />;
  const data = load.data;

  async function createSubscription() {
    if (!pathId) return;
    setBusy("create-subscription");
    try { await boApi.createSubscription({ studentProfileId: data.student.id, pathProgramId: pathId, serviceStartsOn: startsOn, weeklyCommitment: weekly, purchasedUnits: units }); await onChanged("Subscription đã được tạo và activate."); }
    catch (error) { alert(message(error)); } finally { setBusy(""); }
  }

  return <div className={styles.learnerDetailStack}>
    <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>{data.student.displayName}</h2><p>{data.student.status} · birth {data.student.birthYear ?? "—"} · {data.houseMembership ? `House Member từ ${shortDate(data.houseMembership.joinedAt)}` : "Chưa là House Member"}</p></div><span className={styles.statusPill}>{data.student.activeSubscriptions} active</span></div>
      <div className={styles.learnerFacts}><Fact label="Student ID" value={data.student.id} /><Fact label="Birth precision" value={data.student.birthPrecision} /><Fact label="Guardians" value={String(data.guardians.length)} /><Fact label="Subscriptions" value={String(data.subscriptions.length)} /></div>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Guardian / Parent access</h2><p>Parent PIN reset dùng canonical Parent credential service.</p></div><span className={styles.writePill}>Write</span></div>
      {data.guardians.length ? data.guardians.map((guardian) => <Guardian key={guardian.relationshipId} guardian={guardian} busy={busy} setBusy={setBusy} onChanged={onChanged} />) : <p className={styles.muted}>Chưa có Guardian relationship.</p>}
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Subscriptions</h2><p>Commercial lifecycle + Service Unit balance + recurring Enrollment.</p></div><span className={styles.writePill}>Write</span></div>
      <div className={styles.subscriptionCreate}>
        <label className={styles.field}>Path<select value={pathId} onChange={(event) => setPathId(event.target.value)}><option value="">Chọn Path…</option>{catalog.paths.filter((path) => path.status === "ACTIVE").map((path) => <option key={path.id} value={path.id}>{path.displayName}</option>)}</select></label>
        <label className={styles.field}>Bắt đầu<input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label>
        <label className={styles.field}>Buổi / tuần<input type="number" min={1} max={7} value={weekly} onChange={(event) => setWeekly(Number(event.target.value))} /></label>
        <label className={styles.field}>Service Units<input type="number" min={1} value={units} onChange={(event) => setUnits(Number(event.target.value))} /></label>
        <button className={styles.primaryButton} disabled={!pathId || busy === "create-subscription"} onClick={() => void createSubscription()}>{busy === "create-subscription" ? "Đang tạo…" : "Tạo Subscription"}</button>
      </div>
      <div className={styles.subscriptionList}>{data.subscriptions.length ? data.subscriptions.map((entry) => <SubscriptionCard key={entry.subscription.id} entry={entry} classes={catalog.classes} busy={busy} setBusy={setBusy} onChanged={onChanged} />) : <p className={styles.muted}>Chưa có Subscription.</p>}</div>
    </section>
  </div>;
}

function Guardian({ guardian, busy, setBusy, onChanged }: { guardian: BoLearnerLifecycle["guardians"][number]; busy: string; setBusy: (value: string) => void; onChanged: (text: string) => Promise<void> }) {
  async function resetPin() {
    if (!confirm(`Reset Parent PIN cho ${guardian.parent.displayName ?? guardian.parent.id}?`)) return;
    setBusy(`parent-${guardian.parent.id}`);
    try { const result = await boApi.resetParentPin(guardian.parent.id); await onChanged(`Temporary Parent PIN: ${result.temporaryPin} · hết hạn ${new Date(result.expiresAt).toLocaleString("vi-VN")}`); }
    catch (error) { alert(message(error)); } finally { setBusy(""); }
  }
  return <article className={styles.guardianRow}><div><strong>{guardian.parent.displayName ?? "Parent"}</strong><span>{guardian.relationshipType} · {guardian.parent.status}</span><small>{guardian.parent.contacts.map((contact) => `${contact.type}: ${contact.value}`).join(" · ") || "Không có active contact"}</small></div><button className={styles.secondaryButton} disabled={busy === `parent-${guardian.parent.id}`} onClick={() => void resetPin()}>{busy === `parent-${guardian.parent.id}` ? "Đang reset…" : "Reset Parent PIN"}</button></article>;
}
function SubscriptionCard({ entry, classes, busy, setBusy, onChanged }: { entry: BoLearnerLifecycle["subscriptions"][number]; classes: BoRunningClass[]; busy: string; setBusy: (value: string) => void; onChanged: (text: string) => Promise<void> }) {
  const subscription = entry.subscription;
  const [runningClassId, setRunningClassId] = useState("");
  const [placementDate, setPlacementDate] = useState(today());
  const eligibleClasses = classes.filter((item) => item.pathProgramId === subscription.pathProgramId && item.status === "ACTIVE");

  async function renew() {
    const unitsText = prompt("Service Units cho renewal", String(Math.max(subscription.weeklyCommitment * 12, 1)));
    if (!unitsText) return;
    const starts = prompt("Ngày bắt đầu YYYY-MM-DD (để trống nếu activate sau)", "") ?? "";
    setBusy(`renew-${subscription.id}`);
    try { await boApi.renewSubscription(subscription.id, { ...(starts ? { serviceStartsOn: starts } : {}), weeklyCommitment: subscription.weeklyCommitment, purchasedUnits: Number(unitsText) }); await onChanged("Renewal draft đã được tạo."); }
    catch (error) { alert(message(error)); } finally { setBusy(""); }
  }
  async function cancel() {
    const reason = prompt("Lý do cancel Subscription"); if (!reason) return;
    if (!confirm("Cancel Subscription này?")) return;
    setBusy(`cancel-${subscription.id}`);
    try { await boApi.cancelSubscription(subscription.id, { expectedVersion: subscription.version, reason }); await onChanged("Subscription đã cancel."); }
    catch (error) { alert(message(error)); } finally { setBusy(""); }
  }
  async function place() {
    if (!runningClassId) return;
    setBusy(`place-${subscription.id}`);
    try { await boApi.placeEnrollment({ subscriptionId: subscription.id, runningClassId, effectiveFromLocalDate: placementDate, commandEffectiveLocalDate: today(), policyEffectiveAt: new Date().toISOString() }); await onChanged("Enrollment đã được place vào Running Class."); }
    catch (error) { alert(message(error)); } finally { setBusy(""); }
  }
  async function endEnrollment(enrollmentId: string, version: number) {
    const endDate = prompt("Ngày kết thúc exclusive YYYY-MM-DD", today()); if (!endDate) return;
    const reason = prompt("Lý do kết thúc Enrollment"); if (!reason) return;
    setBusy(`end-${enrollmentId}`);
    try { await boApi.endEnrollment(enrollmentId, { effectiveUntilExclusiveLocalDate: endDate, expectedVersion: version, reason }); await onChanged("Enrollment đã kết thúc."); }
    catch (error) { alert(message(error)); } finally { setBusy(""); }
  }

  return <article className={styles.subscriptionCard}>
    <div className={styles.subscriptionHead}>
      <div><strong>{subscription.pathDisplayName}</strong><span>{subscription.lifecycle} · {subscription.weeklyCommitment} buổi/tuần</span></div>
      <div className={styles.unitBalance}><strong>{subscription.effectiveAvailableUnits}</strong><span>units còn hiệu lực</span></div>
    </div>
    <small>{subscription.serviceStartsOn ?? "Chưa activate"} · v{subscription.version} · ledger {subscription.historicalBalance}</small>
    <div className={styles.subscriptionActions}>
      {subscription.lifecycle === "ACTIVE" ? <><button className={styles.secondaryButton} disabled={busy === `renew-${subscription.id}`} onClick={() => void renew()}>Renew</button><button className={styles.secondaryButton} disabled={busy === `cancel-${subscription.id}`} onClick={() => void cancel()}>Cancel</button></> : null}
    </div>
    {subscription.lifecycle === "ACTIVE" ? <div className={styles.placementComposer}>
      <label className={styles.field}>Running Class<select value={runningClassId} onChange={(event) => setRunningClassId(event.target.value)}><option value="">Chọn lớp…</option>{eligibleClasses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.startLocalTime}</option>)}</select></label>
      <label className={styles.field}>Effective from<input type="date" value={placementDate} onChange={(event) => setPlacementDate(event.target.value)} /></label>
      <button className={styles.secondaryButton} disabled={!runningClassId || busy === `place-${subscription.id}`} onClick={() => void place()}>Place Enrollment</button>
    </div> : null}
    <div className={styles.enrollmentList}>{entry.enrollments.map((enrollment) => <div className={styles.enrollmentRow} key={enrollment.id}><div><strong>{enrollment.runningClassName}</strong><span>{enrollment.effectiveFromLocalDate} → {enrollment.effectiveUntilExclusiveLocalDate ?? "ongoing"}</span><small>{enrollment.plannedEntryLocalTime ? `${enrollment.plannedEntryLocalTime} · ${enrollment.plannedDurationMinutes}m` : "Theo class schedule"}</small></div>{!enrollment.effectiveUntilExclusiveLocalDate ? <button className={styles.secondaryButton} disabled={busy === `end-${enrollment.id}`} onClick={() => void endEnrollment(enrollment.id, enrollment.version)}>End</button> : null}</div>)}</div>
  </article>;
}
function Fact({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function State({ text, error = false }: { text: string; error?: boolean }) { return <div className={`${styles.state} ${error ? styles.errorState : ""}`}><strong>{error ? "Không thể tải" : "PINO BO"}</strong><span>{text}</span></div>; }
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function shortDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium" }).format(new Date(value)); }
function message(error: unknown) { return error instanceof BoApiError ? `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}` : error instanceof Error ? error.message : "Command failed."; }
