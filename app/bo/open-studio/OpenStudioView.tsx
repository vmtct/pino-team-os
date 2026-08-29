"use client";

import { useEffect, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoCenter, BoLearnerDirectoryItem, BoLearnerLifecycle, BoOpenStudioOperations, BoOpenStudioPass, BoSession, BoSyllabus } from "@/lib/bo-model";
import styles from "../bo.module.css";

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };
type Experience = "KHAM_PHA" | "CAO_CAP" | "CHUYEN_DE";

export function OpenStudioView() {
  const [operations, setOperations] = useState<Load<BoOpenStudioOperations>>({ state: "loading" });
  const [sessions, setSessions] = useState<BoSession[]>([]);
  const [syllabi, setSyllabi] = useState<BoSyllabus[]>([]);
  const [centers, setCenters] = useState<BoCenter[]>([]);
  const [learners, setLearners] = useState<BoLearnerDirectoryItem[]>([]);
  const [centerId, setCenterId] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh(nextCenter = centerId) {
    setOperations({ state: "loading" });
    try { setOperations({ state: "ready", data: await boApi.openStudioOperations(nextCenter || undefined) }); }
    catch (error) { setOperations({ state: "error", message: message(error) }); }
  }
  useEffect(() => {
    let active = true;
    void Promise.all([boApi.centers(), boApi.sessions(), boApi.syllabi(), boApi.learners("")]).then(([nextCenters, nextSessions, nextSyllabi, nextLearners]) => {
      if (!active) return;
      setCenters(nextCenters); setSessions(nextSessions); setSyllabi(nextSyllabi); setLearners(nextLearners);
      const firstCenter = nextCenters.find((item) => item.status === "active")?.id ?? nextCenters[0]?.id ?? "";
      setCenterId(firstCenter);
      void refresh(firstCenter);
    }).catch((error: unknown) => { if (active) setOperations({ state: "error", message: message(error) }); });
    return () => { active = false; };
    // bootstrap once; later changes are explicit operator actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = operations.state === "ready" ? operations.data : null;
  const visibleSessions = sessions.filter((item) => item.status === "SCHEDULED");

  return <main className={styles.page}>
    <header className={styles.heading}>
      <span>Back Office · Open Studio</span>
      <h1>Open Studio Operations</h1>
      <p>Listing, Pass và admission dùng authority canonical từ pino-core. Outcome được settle ở TOS.</p>
    </header>
    <label className={styles.field}>Center<select value={centerId} onChange={(event) => { setCenterId(event.target.value); void refresh(event.target.value); }}><option value="">Tất cả Center</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.displayName}</option>)}</select></label>
    {notice ? <div className={styles.successCard}><span>Command completed</span><strong>{notice}</strong></div> : null}
    {operations.state === "loading" ? <State text="Đang tải Open Studio control plane…" /> : null}
    {operations.state === "error" ? <State text={operations.message} error /> : null}
    {data ? <>
      <ListingComposer sessions={visibleSessions} syllabi={syllabi} onChanged={async (text) => { setNotice(text); await refresh(); }} />
      <ListingBoard data={data} onChanged={async (text) => { setNotice(text); await refresh(); }} />
      <PassAdmissionDesk learners={learners} listings={data.listings.filter((item) => item.status === "PUBLISHED")} centers={centers} onChanged={async (text) => { setNotice(text); await refresh(); }} />
      <ClaimBoard data={data} />
    </> : null}
  </main>;
}
function ListingComposer({ sessions, syllabi, onChanged }: { sessions: BoSession[]; syllabi: BoSyllabus[]; onChanged: (text: string) => Promise<void> }) {
  const [sessionId, setSessionId] = useState("");
  const [syllabusId, setSyllabusId] = useState("");
  const [experienceType, setExperienceType] = useState<Experience>("KHAM_PHA");
  const [busy, setBusy] = useState(false);
  const session = sessions.find((item) => item.id === sessionId) ?? null;
  const eligibleSyllabi = syllabi.filter((item) => item.publicationStatus === "PUBLISHED" && (!session?.pathProgramId || item.pathProgramId === session.pathProgramId));

  async function create() {
    if (!sessionId || !syllabusId) return;
    setBusy(true);
    try { await boApi.createOpenStudioListing({ sessionId, syllabusId, experienceType }); await onChanged("Open Studio Listing draft đã được tạo."); setSessionId(""); setSyllabusId(""); }
    catch (error) { alert(message(error)); } finally { setBusy(false); }
  }
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><div><h2>Tạo Listing</h2><p>Chỉ Session + Syllabus canonical cùng Path mới publish được.</p></div><span className={styles.writePill}>Write</span></div>
    <div className={styles.osComposer}>
      <label className={styles.field}>Session<select value={sessionId} onChange={(event) => { setSessionId(event.target.value); setSyllabusId(""); }}><option value="">Chọn Session…</option>{sessions.map((item) => <option key={item.id} value={item.id}>{item.localDate ?? "—"} · {time(item.startsAt)} · {item.pathProgramId ?? "Path"}</option>)}</select></label>
      <label className={styles.field}>Syllabus<select value={syllabusId} onChange={(event) => setSyllabusId(event.target.value)}><option value="">Chọn Syllabus…</option>{eligibleSyllabi.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label className={styles.field}>Experience<select value={experienceType} onChange={(event) => setExperienceType(event.target.value as Experience)}><option value="KHAM_PHA">Khám phá</option><option value="CAO_CAP">Cao cấp</option><option value="CHUYEN_DE">Chuyên đề</option></select></label>
      <button className={styles.primaryButton} disabled={!sessionId || !syllabusId || busy} onClick={() => void create()}>{busy ? "Đang tạo…" : "Tạo Listing"}</button>
    </div>
  </section>;
}
function ListingBoard({ data, onChanged }: { data: BoOpenStudioOperations; onChanged: (text: string) => Promise<void> }) {
  const [busy, setBusy] = useState("");
  async function command(listing: BoOpenStudioOperations["listings"][number], action: "publish" | "close" | "cancel") {
    let reason = "";
    if (action !== "publish") { reason = prompt(action === "close" ? "Lý do đóng Listing" : "Lý do huỷ Listing") ?? ""; if (!reason) return; }
    if (action === "cancel" && !confirm("Huỷ Listing và reconcile reservation đang giữ?")) return;
    setBusy(`${action}:${listing.id}`);
    try {
      if (action === "publish") await boApi.publishOpenStudioListing(listing.id, listing.version);
      else if (action === "close") await boApi.closeOpenStudioListing(listing.id, listing.version, reason);
      else await boApi.cancelOpenStudioListing(listing.id, listing.version, reason);
      await onChanged(`Listing ${action} đã hoàn tất.`);
    } catch (error) { alert(message(error)); } finally { setBusy(""); }
  }
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><div><h2>Listings</h2><p>Lifecycle và reservation count từ Core.</p></div><span className={styles.readOnly}>{data.listings.length} listing</span></div>
    <div className={styles.osGrid}>{data.listings.map((listing) => <article className={styles.osCard} key={listing.id}>
      <div className={styles.osCardHead}><div><strong>{listing.syllabusTitle}</strong><span>{listing.localDate} · {clockLocal(listing.scheduledStartsLocal)}–{clockLocal(listing.scheduledEndsLocal)} · {listing.pathDisplayName}</span></div><span className={styles.statusPill}>{listing.status}</span></div>
      <div className={styles.osMeta}><span>{experienceLabel(listing.experienceType)}</span><span>{listing.claimCount} claim</span><span>v{listing.version}</span></div>
      <div className={styles.subscriptionActions}>
        {listing.status === "DRAFT" ? <button className={styles.primaryButton} disabled={!!busy} onClick={() => void command(listing, "publish")}>{busy === `publish:${listing.id}` ? "…" : "Publish"}</button> : null}
        {listing.status === "PUBLISHED" ? <><button className={styles.secondaryButton} disabled={!!busy} onClick={() => void command(listing, "close")}>Close</button><button className={styles.secondaryButton} disabled={!!busy} onClick={() => void command(listing, "cancel")}>Cancel</button></> : null}
      </div>
    </article>)}</div>
  </section>;
}
function PassAdmissionDesk({ learners, listings, centers, onChanged }: { learners: BoLearnerDirectoryItem[]; listings: BoOpenStudioOperations["listings"]; centers: BoCenter[]; onChanged: (text: string) => Promise<void> }) {
  const [studentId, setStudentId] = useState("");
  const [lifecycle, setLifecycle] = useState<BoLearnerLifecycle | null>(null);
  const [pathId, setPathId] = useState("");
  const [centerId, setCenterId] = useState(centers[0]?.id ?? "");
  const [passes, setPasses] = useState<BoOpenStudioPass[]>([]);
  const [listingId, setListingId] = useState("");
  const [passId, setPassId] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => { if (!centerId && centers[0]) setCenterId(centers[0].id); }, [centerId, centers]);
  async function chooseLearner(id: string) {
    setStudentId(id); setLifecycle(null); setPasses([]); setPassId(""); setPathId("");
    if (!id) return;
    try { const value = await boApi.learnerLifecycle(id); setLifecycle(value); setPathId(value.student.activePaths[0]?.id ?? ""); if (value.houseMembership) setPasses(await boApi.openStudioPasses(value.houseMembership.id, new Date().toISOString())); }
    catch (error) { alert(message(error)); }
  }
  async function reloadPasses() { if (lifecycle?.houseMembership) setPasses(await boApi.openStudioPasses(lifecycle.houseMembership.id, new Date().toISOString())); }
  async function assignAuthority() {
    if (!lifecycle?.houseMembership || !pathId || !centerId) return;
    setBusy("authority");
    try { await boApi.assignOpenStudioPathCenter({ houseMembershipId: lifecycle.houseMembership.id, pathProgramId: pathId, centerId, effectiveFrom: new Date().toISOString() }); await onChanged("Open Studio Path Center authority đã được gán."); }
    catch (error) { alert(message(error)); } finally { setBusy(""); }
  }
  async function issuePass() {
    if (!lifecycle?.houseMembership || !pathId) return;
    setBusy("issue");
    try { await boApi.issueOpenStudioMonthlyPass({ houseMembershipId: lifecycle.houseMembership.id, pathProgramId: pathId, effectiveAt: new Date().toISOString() }); await reloadPasses(); await onChanged("Monthly Path Pass đã resolve/issue theo policy."); }
    catch (error) { alert(message(error)); } finally { setBusy(""); }
  }
  async function admit() {
    if (!passId || !listingId || !studentId) return;
    setBusy("admit");
    const effectiveAt = new Date().toISOString();
    try {
      const eligibility = await boApi.openStudioEligibility(passId, { listingId, participantMode: "OWNER", studentProfileId: studentId, effectiveAt });
      if (!eligibility.eligible) { alert(`Không eligible: ${eligibility.reasons.join(", ")}`); return; }
      await boApi.admitOpenStudioOwner({ passId, listingId, studentProfileId: studentId, effectiveAt });
      await reloadPasses(); await onChanged("OWNER admission đã reserve canonical Claim + Booking.");
    } catch (error) { alert(message(error)); } finally { setBusy(""); }
  }

  const pathListings = listings.filter((item) => !pathId || item.pathProgramId === pathId);
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><div><h2>Pass & OWNER admission</h2><p>BO chuẩn bị commercial authority; TOS settle outcome.</p></div><span className={styles.writePill}>Write</span></div>
    <div className={styles.osAdmissionGrid}>
      <label className={styles.field}>Learner<select value={studentId} onChange={(event) => void chooseLearner(event.target.value)}><option value="">Chọn learner…</option>{learners.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
      <label className={styles.field}>Path<select value={pathId} onChange={(event) => setPathId(event.target.value)} disabled={!lifecycle}><option value="">Chọn Path…</option>{lifecycle?.student.activePaths.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
      <label className={styles.field}>Issuance Center<select value={centerId} onChange={(event) => setCenterId(event.target.value)}><option value="">Chọn Center…</option>{centers.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
    </div>
    {!lifecycle ? <p className={styles.muted}>Chọn learner để resolve House Membership và active Paths.</p> : !lifecycle.houseMembership ? <p className={styles.muted}>Learner này chưa có House Membership nên không thể issue Member Pass.</p> : <>
      <div className={styles.subscriptionActions}>
        <button className={styles.secondaryButton} disabled={!pathId || !centerId || !!busy} onClick={() => void assignAuthority()}>{busy === "authority" ? "Đang gán…" : "Assign Path Center"}</button>
        <button className={styles.primaryButton} disabled={!pathId || !!busy} onClick={() => void issuePass()}>{busy === "issue" ? "Đang issue…" : "Resolve / Issue Monthly Pass"}</button>
      </div>
      <div className={styles.osAdmissionGrid}>
        <label className={styles.field}>Pass<select value={passId} onChange={(event) => setPassId(event.target.value)}><option value="">Chọn Pass…</option>{passes.filter((item) => item.pass.pathProgramId === pathId).map((item) => <option key={item.pass.id} value={item.pass.id}>{item.pass.issuancePeriodKey} · {item.effectiveNow ? "effective" : "not effective"} · {item.pass.id.slice(0, 8)}</option>)}</select></label>
        <label className={styles.field}>Published Listing<select value={listingId} onChange={(event) => setListingId(event.target.value)}><option value="">Chọn Listing…</option>{pathListings.map((item) => <option key={item.id} value={item.id}>{item.localDate} · {clockLocal(item.scheduledStartsLocal)} · {item.syllabusTitle}</option>)}</select></label>
        <button className={styles.primaryButton} disabled={!passId || !listingId || !!busy} onClick={() => void admit()}>{busy === "admit" ? "Đang xử lý…" : "Check eligibility + OWNER"}</button>
      </div>
    </>}
  </section>;
}
function ClaimBoard({ data }: { data: BoOpenStudioOperations }) {
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><div><h2>Claims & outcomes</h2><p>Reservation/settlement truth. Outcome mutation nằm ở TOS Open Studio Desk.</p></div><span className={styles.readOnly}>{data.claims.length} claim</span></div>
    <div className={styles.osGrid}>{data.claims.map((claim) => <article className={styles.osCard} key={claim.id}>
      <div className={styles.osCardHead}><div><strong>{claim.studentDisplayName ?? claim.participantMode}</strong><span>{claim.localDate} · {clockLocal(claim.scheduledStartsLocal)} · {experienceLabel(claim.experienceType)}</span></div><span className={styles.statusPill}>{claim.status}</span></div>
      <div className={styles.osMeta}><span>{claim.passClass}</span><span>{claim.reservationStatus ?? "—"}</span><span>{claim.settlementState}</span></div>
      <small>{claim.participantOutcome ?? "Chưa có outcome"} · Claim {claim.id.slice(0, 8)}</small>
    </article>)}</div>
  </section>;
}

function State({ text, error = false }: { text: string; error?: boolean }) { return <div className={`${styles.state} ${error ? styles.errorState : ""}`}><strong>{error ? "Không thể tải" : "PINO BO"}</strong><span>{text}</span></div>; }
function time(value: string) { return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }
function clockLocal(value: string) { return value.match(/T(\d{2}:\d{2})/)?.[1] ?? value; }
function experienceLabel(value: string) { return value === "KHAM_PHA" ? "Khám phá" : value === "CAO_CAP" ? "Cao cấp" : value === "CHUYEN_DE" ? "Chuyên đề" : value; }
function message(error: unknown) { return error instanceof BoApiError ? `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}` : error instanceof Error ? error.message : "Command failed."; }
