"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import { calendarPreviewFingerprint, calendarPreviewMatches } from "@/lib/bo-calendar-closure-preview";
import type {
  BoCalendarExclusion, BoCalendarExclusionImpact, BoCalendarExclusionReason,
  BoCenter, BoPathProgram, BoRunningClass,
} from "@/lib/bo-model";
import styles from "../bo.module.css";

type ScopeType = "HOUSE" | "PATH" | "RUNNING_CLASS";
const reasons: Array<{ value: BoCalendarExclusionReason; label: string }> = [
  { value: "PUBLIC_HOLIDAY", label: "Public holiday" },
  { value: "HOUSE_CLOSURE", label: "Center closure" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "STAFF_EVENT", label: "Staff event" },
  { value: "ACADEMIC_BREAK", label: "Academic break" },
  { value: "OTHER", label: "Other" },
];

function nextDate(value: string) {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
function inclusiveEnd(value: string) {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
function errorMessage(error: unknown) {
  if (error instanceof BoApiError) return `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}`;
  return error instanceof Error ? error.message : "Unknown error";
}

export function BoCalendarClosuresView() {
  const [centers, setCenters] = useState<BoCenter[]>([]);
  const [paths, setPaths] = useState<BoPathProgram[]>([]);
  const [classes, setClasses] = useState<BoRunningClass[]>([]);
  const [centerId, setCenterId] = useState("");
  const [scopeType, setScopeType] = useState<ScopeType>("HOUSE");
  const [scopeId, setScopeId] = useState("");
  const [reason, setReason] = useState<BoCalendarExclusionReason>("PUBLIC_HOLIDAY");
  const [detail, setDetail] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [items, setItems] = useState<BoCalendarExclusion[]>([]);
  const [impact, setImpact] = useState<BoCalendarExclusionImpact | null>(null);
  const [previewedCommandFingerprint, setPreviewedCommandFingerprint] = useState<string | null>(null);
  const [publishKey, setPublishKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void boApi.calendarScope()
      .then((scope) => {
        setCenters(scope.centers); setClasses(scope.classes); setPaths(scope.paths);
        setCenterId((value) => value || scope.centers[0]?.id || "");
      })
      .catch((value) => setError(errorMessage(value)));
  }, []);
  const refresh = useCallback(async () => {
    if (!centerId) return;
    setItems(await boApi.calendarExclusions(centerId));
  }, [centerId]);
  useEffect(() => { void refresh().catch((value) => setError(errorMessage(value))); }, [refresh]);
  useEffect(() => { setScopeId(""); setImpact(null); setPreviewedCommandFingerprint(null); setPublishKey(null); }, [scopeType, centerId]);

  const command = useMemo(() => {
    if (!centerId || !start || !end || end < start) return null;
    const body: {
      centerId: string; scopeType: ScopeType; pathProgramId?: string; runningClassId?: string;
      startsOnLocalDate: string; endsBeforeLocalDate: string; effectiveAt: string;
    } = { centerId, scopeType, startsOnLocalDate: start, endsBeforeLocalDate: nextDate(end), effectiveAt: new Date().toISOString() };
    if (scopeType === "PATH") { if (!scopeId) return null; body.pathProgramId = scopeId; }
    if (scopeType === "RUNNING_CLASS") { if (!scopeId) return null; body.runningClassId = scopeId; }
    return body;
  }, [centerId, scopeType, scopeId, start, end]);
  const commandFingerprint = useMemo(() => command ? calendarPreviewFingerprint(command) : null, [command]);
  const currentCommandFingerprint = useRef<string | null>(commandFingerprint);
  currentCommandFingerprint.current = commandFingerprint;

  async function preview() {
    if (!command || !commandFingerprint) return;
    const requestedFingerprint = commandFingerprint;
    setBusy(true); setError(null); setNotice(null); setImpact(null); setPreviewedCommandFingerprint(null); setPublishKey(null);
    try {
      const nextImpact = await boApi.previewCalendarExclusion(command);
      if (!calendarPreviewMatches(requestedFingerprint, currentCommandFingerprint.current)) return;
      setImpact(nextImpact); setPreviewedCommandFingerprint(requestedFingerprint); setPublishKey(crypto.randomUUID());
    }
    catch (value) { if (calendarPreviewMatches(requestedFingerprint, currentCommandFingerprint.current)) setError(errorMessage(value)); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (!command || !impact || !commandFingerprint || previewedCommandFingerprint !== commandFingerprint) return;
    setBusy(true); setError(null);
    try {
      const key = publishKey ?? crypto.randomUUID();
      if (!publishKey) setPublishKey(key);
      const result = await boApi.createCalendarExclusion({ ...command, reason, reasonDetail: detail.trim() || null }, key);
      setNotice(`Closure published · ${result.impact.sessionsToCancel} future Session(s) cancelled.`);
      setImpact(null); setPreviewedCommandFingerprint(null); setPublishKey(null); await refresh();
    } catch (value) { setError(errorMessage(value)); }
    finally { setBusy(false); }
  }
  async function archive(item: BoCalendarExclusion) {
    const archiveReason = window.prompt("Archive reason", "Calendar corrected");
    if (!archiveReason) return;
    setBusy(true); setError(null);
    try {
      await boApi.archiveCalendarExclusion(item.id, item.version, archiveReason);
      setNotice("Closure archived. Historical cancelled Sessions remain cancelled.");
      await refresh();
    } catch (value) { setError(errorMessage(value)); }
    finally { setBusy(false); }
  }

  const centerClasses = classes.filter((item) => !item.centerId || item.centerId === centerId);
  const protectedTruth = (impact?.sessionsWithParticipation ?? 0) + (impact?.consumedOpenStudioSessions ?? 0);
  const missingReasonDetail = reason === "OTHER" && !detail.trim();
  return <main className={styles.page}>
    <header className={styles.heading}>
      <span>Schedule</span><h1>Holidays & center closures</h1>
      <p>Publish governed calendar exclusions. Future materialized Sessions reconcile atomically; historical participation is never rewritten.</p>
    </header>
    {error ? <section className={`${styles.state} ${styles.errorState}`}><strong>Calendar command failed</strong><span>{error}</span></section> : null}
    {notice ? <section className={styles.successCard}><span>Calendar updated</span><strong>{notice}</strong></section> : null}
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div><h2>Publish closure</h2><p>Preview operational impact before mutation.</p></div>
        <span className={styles.writePill}>Manager write</span>
      </div>
      <div className={styles.formGrid}>
        <label className={styles.field}>Center<select value={centerId} disabled={busy} onChange={(e) => setCenterId(e.target.value)}>{centers.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}</select></label>
        <label className={styles.field}>Scope<select value={scopeType} disabled={busy} onChange={(e) => setScopeType(e.target.value as ScopeType)}><option value="HOUSE">Entire center</option><option value="PATH">Path</option><option value="RUNNING_CLASS">Running class</option></select></label>
        {scopeType === "PATH" ? <label className={styles.field}>Path<select value={scopeId} disabled={busy} onChange={(e) => { setScopeId(e.target.value); setImpact(null); setPreviewedCommandFingerprint(null); setPublishKey(null); }}><option value="">Choose path</option>{paths.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select></label> : null}
        {scopeType === "RUNNING_CLASS" ? <label className={styles.field}>Running class<select value={scopeId} disabled={busy} onChange={(e) => { setScopeId(e.target.value); setImpact(null); setPreviewedCommandFingerprint(null); setPublishKey(null); }}><option value="">Choose class</option>{centerClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label> : null}
        <label className={styles.field}>Reason<select value={reason} disabled={busy} onChange={(e) => { setReason(e.target.value as BoCalendarExclusionReason); setPublishKey(null); }}>{reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className={styles.field}>Start date<input type="date" value={start} disabled={busy} onChange={(e) => { setStart(e.target.value); setImpact(null); setPreviewedCommandFingerprint(null); setPublishKey(null); }} /></label>
        <label className={styles.field}>End date<input type="date" min={start} value={end} disabled={busy} onChange={(e) => { setEnd(e.target.value); setImpact(null); setPreviewedCommandFingerprint(null); setPublishKey(null); }} /></label>
        <label className={styles.field}>Note{reason === "OTHER" ? " (required)" : ""}<input value={detail} disabled={busy} onChange={(e) => { setDetail(e.target.value); setPublishKey(null); }} placeholder="Optional operational note" /></label>
      </div>
      <div className={styles.commandBar}>
        <div><strong>Impact preview is mandatory</strong><span>Publication fails closed if an affected future Session already has participation or consumed Open Studio truth.</span></div>
        <button className={styles.secondaryButton} disabled={!command || busy} onClick={() => void preview()}>Preview impact</button>
      </div>
      {impact ? <div className={styles.metrics}>
        <div className={styles.metric}><span>Classes</span><strong>{impact.affectedRunningClasses}</strong></div>
        <div className={styles.metric}><span>Scheduled Sessions</span><strong>{impact.futureScheduledSessions}</strong></div>
        <div className={styles.metric}><span>Will cancel</span><strong>{impact.sessionsToCancel}</strong></div>
        <div className={styles.metric}><span>Protected truth</span><strong>{protectedTruth}</strong></div>
      </div> : null}
      {impact ? <div className={styles.commandBar}>
        <div><strong>{protectedTruth ? "Cannot publish yet" : "Ready to publish"}</strong>
          <span>{protectedTruth ? `${protectedTruth} Session(s) require explicit reconciliation.` : `${impact.registrationsToCancel} registration(s), ${impact.bookingsToCancel} booking(s), ${impact.openStudioClaimsToRelease} Open Studio reservation(s) will reconcile.`}</span>
        </div>
        <button className={styles.primaryButton} disabled={busy || protectedTruth > 0 || missingReasonDetail || !commandFingerprint || previewedCommandFingerprint !== commandFingerprint} onClick={() => void publish()}>Publish closure</button>
      </div> : null}
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Calendar exclusions</h2><p>Archive never silently resurrects Sessions already cancelled by a closure.</p></div><button className={styles.secondaryButton} disabled={busy || !centerId} onClick={() => void refresh()}>Refresh</button></div>
      {!items.length ? <div className={styles.empty}>No closures for this Center.</div> : <div className={styles.tableWrap}><table>
        <thead><tr><th>Dates</th><th>Scope</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id}>
          <td>{item.startsOnLocalDate} → {inclusiveEnd(item.endsBeforeLocalDate)}</td>
          <td>{item.scope.type}</td>
          <td>{item.reason}<small>{item.reasonDetail ?? ""}</small></td>
          <td><span className={styles.statusPill}>{item.status}</span></td>
          <td>{item.status === "ACTIVE" ? <button className={styles.secondaryButton} disabled={busy} onClick={() => void archive(item)}>Archive</button> : "—"}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </main>;
}
