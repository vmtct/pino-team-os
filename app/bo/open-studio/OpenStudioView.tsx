"use client";

import { useEffect, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoCenter, BoLearnerDirectoryItem, BoLearnerLifecycle, BoOpenStudioListingCatalog, BoOpenStudioOperations, BoOpenStudioPass } from "@/lib/bo-model";
import { OpenStudioPolicyControl } from "./OpenStudioPolicyControl";
import styles from "../bo.module.css";

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };
type Experience = "KHAM_PHA" | "CAO_CAP" | "CHUYEN_DE";

export function OpenStudioView() {
  const [operations, setOperations] = useState<Load<BoOpenStudioOperations>>({ state: "loading" });
  const [catalog, setCatalog] = useState<Load<BoOpenStudioListingCatalog>>({ state: "loading" });
  const [centers, setCenters] = useState<BoCenter[]>([]);
  const [learners, setLearners] = useState<BoLearnerDirectoryItem[]>([]);
  const [learnerError, setLearnerError] = useState("");
  const [centerError, setCenterError] = useState("");
  const [centerId, setCenterId] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh(nextCenter = centerId) {
    setOperations({ state: "loading" });
    try { setOperations({ state: "ready", data: await boApi.openStudioOperations(nextCenter || undefined) }); }
    catch (error) { setOperations({ state: "error", message: message(error) }); }
  }
  async function refreshCatalog(nextCenter = centerId) {
    setCatalog({ state: "loading" });
    try { setCatalog({ state: "ready", data: await boApi.openStudioListingCatalog(nextCenter || undefined) }); }
    catch (error) { setCatalog({ state: "error", message: message(error) }); }
  }
  async function refreshLearners() {
    setLearnerError("");
    try { setLearners(await boApi.openStudioLearners("")); }
    catch (error) { setLearnerError(message(error)); }
  }
  useEffect(() => {
    let active = true;
    void refresh("");
    void refreshCatalog("");
    void refreshLearners();
    void boApi.centers().then((nextCenters) => {
      if (!active) return;
      setCenters(nextCenters);
      const firstCenter = nextCenters.find((item) => item.status === "active")?.id ?? nextCenters[0]?.id ?? "";
      setCenterId(firstCenter);
      if (firstCenter) { void refresh(firstCenter); void refreshCatalog(firstCenter); }
    }).catch((error: unknown) => { if (active) setCenterError(message(error)); });
    return () => { active = false; };
    // bootstrap once; later changes are explicit operator actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = operations.state === "ready" ? operations.data : null;
  const visibleSessions = catalog.state === "ready" ? catalog.data.sessions.filter((item) => item.status === "SCHEDULED") : [];
  const visibleSyllabi = catalog.state === "ready" ? catalog.data.syllabi : [];

  return <main className={styles.page}>
    <header className={styles.heading}>
      <span>Back Office · Open Studio</span>
      <h1>Open Studio Operations</h1>
      <p>Listing, Pass và admission dùng authority canonical từ pino-core. Outcome được settle ở TOS.</p>
    </header>
    <label className={styles.field}>Center<select value={centerId} onChange={(event) => { setCenterId(event.target.value); void refresh(event.target.value); void refreshCatalog(event.target.value); }}><option value="">Tất cả Center</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.displayName}</option>)}</select></label>
    {centerError ? <State text={`Center directory unavailable: ${centerError}`} error /> : null}
    {notice ? <div className={styles.successCard}><span>Command completed</span><strong>{notice}</strong></div> : null}
    {operations.state === "loading" ? <State text="Đang tải Open Studio control plane…" /> : null}
    {operations.state === "error" ? <State text={operations.message} error /> : null}
    {data ? <>
      <OpenStudioPolicyControl centerId={centerId} />
      {catalog.state === "loading" ? <State text="Loading Open Studio Listing catalog..." /> : null}
      {catalog.state === "error" ? <State text={`Listing config unavailable: ${catalog.message}`} error /> : null}
      {catalog.state === "ready" ? <ListingComposer sessions={visibleSessions} syllabi={visibleSyllabi} onChanged={async (text) => { setNotice(text); await refresh(); await refreshCatalog(); }} /> : null}
      <ListingBoard data={data} onChanged={async (text) => { setNotice(text); await refresh(); }} />
      {learnerError ? <State text={`Admission learner directory unavailable: ${learnerError}`} error /> : null}
      {!learnerError ? <PassAdmissionDesk learners={learners} listings={data.listings.filter((item) => item.status === "PUBLISHED")} centers={centers} onChanged={async (text) => { setNotice(text); await refresh(); }} /> : null}
      <ClaimBoard data={data} />
    </> : null}
  </main>;
}
function ListingComposer({ sessions, syllabi, onChanged }: { sessions: BoOpenStudioListingCatalog["sessions"]; syllabi: BoOpenStudioListingCatalog["syllabi"]; onChanged: (text: string) => Promise<void> }) {
  const [sessionId, setSessionId] = useState("");
  const [syllabusId, setSyllabusId] = useState("");
  const [experienceType, setExperienceType] = useState<Experience>("KHAM_PHA");
  const [bookingOpensAt, setBookingOpensAt] = useState("");
  const [bookingClosesAt, setBookingClosesAt] = useState("");
  const [busy, setBusy] = useState(false);
  const session = sessions.find((item) => item.id === sessionId) ?? null;
  const eligibleSyllabi = syllabi.filter((item) => item.publicationStatus === "PUBLISHED" && (!session?.pathProgramId || item.pathProgramId === session.pathProgramId));

  async function create() {
    if (!sessionId || !syllabusId) return;
    const opens = bookingOpensAt ? new Date(bookingOpensAt).toISOString() : undefined;
    const closes = bookingClosesAt ? new Date(bookingClosesAt).toISOString() : undefined;
    if (opens && closes && Date.parse(opens) >= Date.parse(closes)) { alert("Booking opens phải trước booking closes."); return; }
    setBusy(true);
    try {
      await boApi.createOpenStudioListing({ sessionId, syllabusId, experienceType, ...(opens ? { bookingOpensAt: opens } : {}), ...(closes ? { bookingClosesAt: closes } : {}) });
      await onChanged("Open Studio Listing draft đã được tạo với booking window canonical.");
      setSessionId(""); setSyllabusId(""); setBookingOpensAt(""); setBookingClosesAt("");
    } catch (error) { alert(message(error)); } finally { setBusy(false); }
  }
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><div><h2>Tạo Listing</h2><p>Chỉ Session + Syllabus canonical cùng Path mới publish được.</p></div><span className={styles.writePill}>Write</span></div>
    <div className={styles.osComposer}>
      <label className={styles.field}>Session<select value={sessionId} onChange={(event) => { setSessionId(event.target.value); setSyllabusId(""); }}><option value="">Chọn Session…</option>{sessions.map((item) => <option key={item.id} value={item.id}>{item.localDate ?? "—"} · {time(item.scheduledStartsAt)} · {item.pathProgramId ?? "Path"}</option>)}</select></label>
      <label className={styles.field}>Syllabus<select value={syllabusId} onChange={(event) => setSyllabusId(event.target.value)}><option value="">Chọn Syllabus…</option>{eligibleSyllabi.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label className={styles.field}>Experience<select value={experienceType} onChange={(event) => setExperienceType(event.target.value as Experience)}><option value="KHAM_PHA">Khám phá</option><option value="CAO_CAP">Cao cấp</option><option value="CHUYEN_DE">Chuyên đề</option></select></label>
      <button className={styles.primaryButton} disabled={!sessionId || !syllabusId || busy} onClick={() => void create()}>{busy ? "Đang tạo…" : "Tạo Listing"}</button>
    </div>
    <div className={styles.osBookingGrid}>
      <label className={styles.field}>Booking opens (optional)<input type="datetime-local" value={bookingOpensAt} onChange={(event) => setBookingOpensAt(event.target.value)} /></label>
      <label className={styles.field}>Booking closes (optional)<input type="datetime-local" value={bookingClosesAt} onChange={(event) => setBookingClosesAt(event.target.value)} /></label>
      <p className={styles.muted}>Để trống = Core dùng lifecycle mặc định của Listing. Nếu nhập cả hai, opens phải trước closes.</p>
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
      <div className={styles.osMeta}><span>{experienceLabel(listing.experienceType)}</span><span>{listing.claimCount} claim</span><span>v{listing.version}</span><span>Open {listing.bookingOpensAt ? shortDate(listing.bookingOpensAt) : "default"}</span><span>Close {listing.bookingClosesAt ? shortDate(listing.bookingClosesAt) : "default"}</span></div>
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
    setStudentId(id); setLifecycle(null); setPasses([]); setPassId(""); setPathId(""); setListingId("");
    if (!id) return;
    try {
      const value = await boApi.openStudioLearnerLifecycle(id);
      setLifecycle(value); setPathId(value.student.activePaths[0]?.id ?? "");
      if (value.houseMembership) setPasses(await boApi.openStudioPasses(value.houseMembership.id, new Date().toISOString()));
    } catch (error) { alert(message(error)); }
  }
  async function reloadPasses() {
    if (lifecycle?.houseMembership) setPasses(await boApi.openStudioPasses(lifecycle.houseMembership.id, new Date().toISOString()));
  }
  async function assignPathAuthority() {
    if (!lifecycle?.houseMembership || !pathId || !centerId) return;
    setBusy("path-authority");
    try {
      await boApi.assignOpenStudioPathCenter({ houseMembershipId: lifecycle.houseMembership.id, pathProgramId: pathId, centerId, effectiveFrom: new Date().toISOString() });
      await onChanged("Path Center authority đã được gán cho Monthly Path Pass.");
    } catch (error) { alert(message(error)); } finally { setBusy(""); }
  }
  async function assignHouseholdAuthority(reassign: boolean) {
    if (!lifecycle?.houseMembership || !centerId) return;
    let assignmentReason = "";
    if (reassign) {
      assignmentReason = prompt("Lý do chuyển Household Center")?.trim() ?? "";
      if (!assignmentReason) return;
    }
    setBusy(reassign ? "household-reassign" : "household-assign");
    try {
      const body = { houseMembershipId: lifecycle.houseMembership.id, centerId, effectiveFrom: new Date().toISOString() };
      if (reassign) await boApi.reassignOpenStudioMemberCenter({ ...body, assignmentReason });
      else await boApi.assignOpenStudioMemberCenter(body);
      await onChanged(reassign ? "Household Center authority đã được chuyển." : "Household Center authority đã được gán.");
    } catch (error) { alert(message(error)); } finally { setBusy(""); }
  }
  async function issueMonthlyPass() {
    if (!lifecycle?.houseMembership || !pathId) return;
    setBusy("issue-monthly");
    try {
      await boApi.issueOpenStudioMonthlyPass({ houseMembershipId: lifecycle.houseMembership.id, pathProgramId: pathId, effectiveAt: new Date().toISOString() });
      await reloadPasses(); await onChanged("Monthly Path Pass đã resolve/issue theo policy.");
    } catch (error) { alert(message(error)); } finally { setBusy(""); }
  }
  async function issueBringAFriendPass() {
    if (!lifecycle?.houseMembership) return;
    setBusy("issue-friend");
    try {
      await boApi.issueOpenStudioBringAFriendPass({ houseMembershipId: lifecycle.houseMembership.id, effectiveAt: new Date().toISOString() });
      await reloadPasses(); await onChanged("Bring-a-Friend Pass đã resolve/issue theo household policy.");
    } catch (error) { alert(message(error)); } finally { setBusy(""); }
  }
  async function revokePass(item: BoOpenStudioPass) {
    if (item.pass.revokedAt) return;
    const reason = prompt("Lý do revoke Pass")?.trim() ?? "";
    if (!reason) return;
    if (!confirm(`Revoke ${passClassLabel(item.pass.passClass)} · ${item.pass.issuancePeriodKey}?`)) return;
    setBusy(`revoke:${item.pass.id}`);
    try {
      await boApi.revokeOpenStudioPass(item.pass.id, { revokedAt: new Date().toISOString(), reason });
      await reloadPasses(); await onChanged(`${passClassLabel(item.pass.passClass)} đã được revoke.`);
      if (passId === item.pass.id) setPassId("");
    } catch (error) { alert(message(error)); } finally { setBusy(""); }
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
  const ownerPasses = passes.filter((item) => item.pass.passClass === "MONTHLY_PATH" && item.pass.pathProgramId === pathId && item.effectiveNow && !item.pass.revokedAt);
  const pathName = lifecycle?.student.activePaths.find((item) => item.id === pathId)?.displayName ?? "Path";
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><div><h2>Pass Control Desk</h2><p>Center authority, Pass issuance/revoke và OWNER admission đều dùng Core authority.</p></div><span className={styles.writePill}>Write</span></div>
    <div className={styles.osAdmissionGrid}>
      <label className={styles.field}>Learner<select value={studentId} onChange={(event) => void chooseLearner(event.target.value)}><option value="">Chọn learner…</option>{learners.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
      <label className={styles.field}>Path<select value={pathId} onChange={(event) => { setPathId(event.target.value); setPassId(""); setListingId(""); }} disabled={!lifecycle}><option value="">Chọn Path…</option>{lifecycle?.student.activePaths.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
      <label className={styles.field}>Authority Center<select value={centerId} onChange={(event) => setCenterId(event.target.value)}><option value="">Chọn Center…</option>{centers.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
    </div>
    {!lifecycle ? <p className={styles.muted}>Chọn learner để resolve House Membership, active Paths và Pass inventory.</p> : !lifecycle.houseMembership ? <p className={styles.muted}>Learner này chưa có House Membership nên không thể issue Member Pass.</p> : <>
      <div className={styles.osControlColumns}>
        <div className={styles.osControlBlock}><strong>Path authority</strong><span>Monthly Path Pass dùng Center authority theo từng Path.</span><button className={styles.secondaryButton} disabled={!pathId || !centerId || !!busy} onClick={() => void assignPathAuthority()}>{busy === "path-authority" ? "Đang gán…" : `Assign ${pathName} Center`}</button></div>
        <div className={styles.osControlBlock}><strong>Household authority</strong><span>Bring-a-Friend dùng Household Center, không phụ thuộc Path.</span><div className={styles.subscriptionActions}><button className={styles.secondaryButton} disabled={!centerId || !!busy} onClick={() => void assignHouseholdAuthority(false)}>{busy === "household-assign" ? "Đang gán…" : "Assign Center"}</button><button className={styles.secondaryButton} disabled={!centerId || !!busy} onClick={() => void assignHouseholdAuthority(true)}>{busy === "household-reassign" ? "Đang chuyển…" : "Move Center"}</button></div></div>
      </div>
      <div className={styles.osPassActions}>
        <button className={styles.primaryButton} disabled={!pathId || !!busy} onClick={() => void issueMonthlyPass()}>{busy === "issue-monthly" ? "Đang issue…" : "Resolve / Issue Monthly Path"}</button>
        <button className={styles.primaryButton} disabled={!!busy} onClick={() => void issueBringAFriendPass()}>{busy === "issue-friend" ? "Đang issue…" : "Resolve / Issue Bring-a-Friend"}</button>
      </div>
      <div className={styles.panelHeading}><div><h3>Pass inventory</h3><p>Effective state được đọc lại từ Core sau mỗi command.</p></div><span className={styles.readOnly}>{passes.length} pass</span></div>
      <div className={styles.osPassGrid}>{passes.map((item) => {
        const state = passState(item);
        const scopedPath = item.pass.pathProgramId ? lifecycle.student.activePaths.find((path) => path.id === item.pass.pathProgramId)?.displayName ?? "Path scoped" : "Household scoped";
        return <article className={styles.osPassCard} key={item.pass.id}>
          <div className={styles.osCardHead}><div><strong>{passClassLabel(item.pass.passClass)}</strong><span>{scopedPath} · {item.pass.issuancePeriodKey}</span></div><span className={`${styles.statusPill} ${state === "REVOKED" ? styles.osDangerPill : ""}`}>{state}</span></div>
          <div className={styles.osMeta}><span>{validityLabel(item.pass.validFrom, item.pass.validUntilExclusive)}</span><span>{item.pass.issuanceCenterId ? `Center ${item.pass.issuanceCenterId.slice(0, 8)}` : "Household"}</span></div>
          {!item.pass.revokedAt ? <button className={styles.dangerButton} disabled={!!busy} onClick={() => void revokePass(item)}>{busy === `revoke:${item.pass.id}` ? "Đang revoke…" : "Revoke Pass"}</button> : null}
        </article>;
      })}</div>
      <div className={styles.panelHeading}><div><h3>OWNER admission</h3><p>Chỉ Monthly Path Pass đang effective mới được đưa vào OWNER flow.</p></div><span className={styles.readOnly}>Canonical</span></div>
      <div className={styles.osAdmissionGrid}>
        <label className={styles.field}>Effective Monthly Pass<select value={passId} onChange={(event) => setPassId(event.target.value)}><option value="">Chọn Pass…</option>{ownerPasses.map((item) => <option key={item.pass.id} value={item.pass.id}>{item.pass.issuancePeriodKey} · {item.pass.id.slice(0, 8)}</option>)}</select></label>
        <label className={styles.field}>Published Listing<select value={listingId} onChange={(event) => setListingId(event.target.value)}><option value="">Chọn Listing…</option>{pathListings.map((item) => <option key={item.id} value={item.id}>{item.localDate} · {clockLocal(item.scheduledStartsLocal)} · {item.syllabusTitle}</option>)}</select></label>
        <button className={styles.primaryButton} disabled={!passId || !listingId || !!busy} onClick={() => void admit()}>{busy === "admit" ? "Đang xử lý…" : "Check eligibility + OWNER"}</button>
      </div>
      <p className={styles.muted}>Bring-a-Friend được quản lý ở Pass inventory nhưng chưa được đưa vào participant admission UI khi Core chưa expose bounded Guest/Sibling flow cho BO.</p>
    </>}
  </section>;
}

function passClassLabel(value: BoOpenStudioPass["pass"]["passClass"]) { return value === "MONTHLY_PATH" ? "Monthly Path" : "Bring-a-Friend"; }
function passState(item: BoOpenStudioPass) {
  if (item.pass.revokedAt) return "REVOKED";
  const now = Date.now(), starts = Date.parse(item.pass.validFrom), ends = item.pass.validUntilExclusive ? Date.parse(item.pass.validUntilExclusive) : null;
  if (Number.isFinite(starts) && now < starts) return "FUTURE";
  if (ends !== null && Number.isFinite(ends) && now >= ends) return "EXPIRED";
  return item.effectiveNow ? "EFFECTIVE" : "INACTIVE";
}
function validityLabel(from: string, until: string | null) { return `${shortDate(from)} → ${until ? shortDate(until) : "∞"}`; }
function shortDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }

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
