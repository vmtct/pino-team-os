"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BoDataGrid,
  BoDataGridCanonicalId,
  BoDataGridSidePeek,
  BoDataGridStatus,
  useBoDataGridUrlState,
  type BoDataGridColumn,
} from "@/app/bo/components/data-grid";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoTimekeepingPage, BoTimekeepingSession } from "@/lib/bo-model";
import { loadBoTimekeepingPageForState } from "@/lib/bo-timekeeping-page-controller";
import styles from "./timekeeping.module.css";
import { isoToLocalInput, localInputToIso } from "@/lib/bo-timekeeping-local-time";

type Mode = "today" | "history" | "attention";
type TimekeepingCenter = { id: string; displayName: string; timeZone: string };
type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; page: BoTimekeepingPage };
const PAGE_SIZES = [25, 50, 100] as const;

export function TimekeepingView() {
  const [centers, setCenters] = useState<TimekeepingCenter[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [refreshToken, setRefreshToken] = useState(0);
  const { state, setPage, setPageSize, setFilter } = useBoDataGridUrlState({ defaultPageSize: 25, allowedPageSizes: PAGE_SIZES });
  const setPageRef = useRef(setPage);
  setPageRef.current = setPage;

  const mode: Mode = state.filters.mode === "history" ? "history" : state.filters.mode === "attention" ? "attention" : "today";
  const centerId = state.filters.center ?? centers[0]?.id ?? "";
  const selectedCenter = centers.find((center) => center.id === centerId) ?? centers[0] ?? null;
  const today = selectedCenter ? localDate(selectedCenter.timeZone) : "";
  const startDate = state.filters.from ?? (mode === "attention" ? dateDaysBefore(today, 30) : today);
  const endDate = state.filters.to ?? today;
  const invalidRange = mode !== "today" && (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate);
  const status = state.filters.status === "OPEN" || state.filters.status === "CLOSED" ? state.filters.status : "";
  const staffId = state.filters.staff ?? "";
  const page = load.state === "ready" ? load.page : null;
  const timeZone = selectedCenter?.timeZone ?? "UTC";
  const selected = page?.data.find((session) => session.id === selectedId) ?? null;
  const staffOptions = useMemo(() => {
    const map = new Map((page?.data ?? []).map((session) => [session.staff.id, session.staff]));
    if (staffId && !map.has(staffId)) map.set(staffId, { id: staffId, displayLabel: short(staffId) });
    return [...map.values()].sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));
  }, [page, staffId]);
  const columns = useMemo<BoDataGridColumn<BoTimekeepingSession>[]>(() => [
    { key: "staff", header: "Staff", sticky: true, minWidth: 220, render: (row) => <span><strong>{row.staff.displayLabel}</strong><br /><BoDataGridCanonicalId value={row.id} label="Copy TimekeepingSession ID" /></span> },
    { key: "date", header: "Date", minWidth: 115, render: (row) => row.workDate },
    { key: "checkIn", header: "Check-in", minWidth: 160, render: (row) => datetime(row.effective.checkInAt, timeZone) },
    { key: "checkOut", header: "Check-out", minWidth: 160, render: (row) => row.effective.checkOutAt ? datetime(row.effective.checkOutAt, timeZone) : "—" },
    { key: "duration", header: "Duration", minWidth: 105, render: (row) => duration(row.effective.durationSeconds) },
    { key: "assignment", header: "Assignment", minWidth: 180, render: (row) => row.assignment?.shift?.displayLabel ?? (row.assignmentId ? short(row.assignmentId) : "Legacy") },
    { key: "canonical", header: "Core anomalies", minWidth: 175, render: (row) => <span title="Canonical Core anomaly flags">{row.anomalyFlags.join(", ") || "—"}</span> },
    { key: "review", header: "Review signals", minWidth: 175, render: (row) => <span title="UI-derived review signals, not canonical Core anomalies">{reviewSignals(row, today, timeZone).join(", ") || "—"}</span> },
    { key: "correction", header: "Provenance", minWidth: 135, render: (row) => row.latestCorrection ? <BoDataGridStatus value="CORRECTED" tone="info" /> : <span>Recorded</span> },
    { key: "status", header: "Status", minWidth: 110, render: (row) => <BoDataGridStatus value={row.status} tone={row.status === "OPEN" ? "warning" : "success"} /> },
  ], [timeZone, today]);

  useEffect(() => {
    let active = true;
    void boApi.timekeepingCenters().then((items) => {
      if (!active) return;
      setCenters(items.map((center) => ({ id: center.id, displayName: center.displayLabel, timeZone: center.timeZone })));
    }).catch((error) => active && setLoad({ state: "error", message: message(error) }));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!centerId || !selectedCenter || !today || invalidRange) return;
    let active = true;
    setLoad({ state: "loading" });
    const params = mode === "today" ? { centerId, workDate: today } : { centerId, startDate, endDate };
    void loadBoTimekeepingPageForState({
      page: state.page,
      pageSize: state.pageSize,
      query: {
        ...params,
        ...(mode === "attention" ? { status: "OPEN" as const } : status ? { status } : {}),
        ...(staffId ? { staffMemberId: staffId } : {}),
      },
      load: boApi.timekeeping,
    }).then((result) => {
      if (!active) return;
      if (result.kind === "reconcile-page") {
        setPageRef.current(result.page);
        return;
      }
      setLoad({ state: "ready", page: result.data });
      setSelectedId((current) => result.data.data.some((session) => session.id === current) ? current : "");
    }).catch((error) => {
      if (active) setLoad({ state: "error", message: message(error) });
    });
    return () => { active = false; };
  }, [centerId, endDate, mode, refreshToken, staffId, startDate, state.page, state.pageSize, status, selectedCenter, today, invalidRange]);

  function setMode(next: Mode) {
    setFilter("mode", next === "today" ? null : next);
  }

  return <main className={styles.page}>
    <header className={styles.heading}>
      <span>Back Office · Workforce</span>
      <h1>Timekeeping</h1>
      <p>Recorded attendance stays immutable. Authorized corrections are appended as provenance and shown separately.</p>
    </header>

    {page && mode === "today" ? <section className={styles.metrics}>
      <Metric label="Currently checked in" value={page.summary.openSessions} />
      <Metric label="Checked out today" value={page.summary.closedSessions} />
      <Metric label="No checkout yet" value={page.summary.openSessions} />
      <Metric label="Total sessions" value={page.summary.totalSessions} />
    </section> : null}

    {invalidRange ? <p role="alert">Invalid date range: From must be on or before To.</p> : null}
    {mode === "attention" ? <p role="note">Review OPEN sessions within the selected date range. Signals are derived in the UI; Core anomaly flags remain authoritative. Results are paginated, not an all-time count.</p> : null}
    <BoDataGrid
      rows={invalidRange ? [] : (page?.data ?? [])}
      columns={columns}
      rowKey={(row) => row.id}
      caption={mode === "today" ? "Today timekeeping sessions" : mode === "attention" ? "OPEN sessions for review" : "Timekeeping history"}
      state={invalidRange ? "ready" : load.state === "loading" ? "loading" : load.state === "error" ? "error" : "ready"}
      stateMessage={load.state === "error" ? load.message : undefined}
      filterChips={[
        ...(mode !== "today" ? [{ key: "mode", label: "View", value: mode === "history" ? "History" : "Needs Attention", onClear: () => setMode("today") }] : []),
        ...(status && mode !== "attention" ? [{ key: "status", label: "Status", value: status, onClear: () => setFilter("status", null) }] : []),
        ...(staffId ? [{ key: "staff", label: "Staff", value: staffOptions.find((staff) => staff.id === staffId)?.displayLabel ?? short(staffId), onClear: () => setFilter("staff", null) }] : []),
      ]}
      toolbarActions={<div className={styles.gridToolbarActions}>
        <div className={styles.tabs}>
          <button type="button" className={mode === "today" ? styles.activeTab : ""} onClick={() => setMode("today")}>Today</button>
          <button type="button" className={mode === "history" ? styles.activeTab : ""} onClick={() => setMode("history")}>History</button>
          <button type="button" className={mode === "attention" ? styles.activeTab : ""} onClick={() => setMode("attention")}>Needs Attention</button>
        </div>
        <label>Center<select aria-label="Filter Timekeeping by center" value={centerId} onChange={(event) => { setFilter("center", event.target.value || null); setFilter("staff", null); }}><option value="">Select center</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.displayName}</option>)}</select></label>
        {mode !== "today" ? <>
          <label>From<input aria-label="Timekeeping history from" type="date" value={startDate} onChange={(event) => setFilter("from", event.target.value || null)} /></label>
          <label>To<input aria-label="Timekeeping history to" type="date" value={endDate} onChange={(event) => setFilter("to", event.target.value || null)} /></label>
        </> : <span className={styles.today}>{today}</span>}
        {mode !== "attention" ? <label>Status<select aria-label="Filter Timekeeping by status" value={status} onChange={(event) => setFilter("status", event.target.value || null)}><option value="">All</option><option value="OPEN">OPEN</option><option value="CLOSED">CLOSED</option></select></label> : null}
        <label>Staff<select aria-label="Filter Timekeeping by staff" value={staffId} onChange={(event) => setFilter("staff", event.target.value || null)}><option value="">All</option>{staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.displayLabel}</option>)}</select></label>
      </div>}
      onRefresh={() => setRefreshToken((value) => value + 1)}
      resultLabel={`${page?.summary.totalSessions ?? 0} sessions · effective view`}
      pagination={page ? { page: state.page, pageSize: state.pageSize, total: page.summary.totalSessions, pageSizeOptions: PAGE_SIZES, onPageChange: setPage, onPageSizeChange: setPageSize } : undefined}
      selectedRowKey={selectedId || null}
      onRowOpen={(row) => setSelectedId(row.id)}
      emptyTitle={mode === "today" ? "No timekeeping sessions today" : mode === "attention" ? "No OPEN sessions in this date range" : "No matching timekeeping history"}
      emptyMessage="Adjust the bounded date, status or staff filters. Canonical attendance remains in Core."
    />

    {selected ? <BoDataGridSidePeek title={selected.staff.displayLabel} eyebrow={`TimekeepingSession · ${selected.workDate}`} onClose={() => setSelectedId("")}>
      <Detail row={selected} timeZone={timeZone} onSaved={async () => { const params = mode === "today" ? { centerId, workDate: today } : { centerId, startDate, endDate }; const result = await loadBoTimekeepingPageForState({ page: state.page, pageSize: state.pageSize, query: { ...params, ...(mode === "attention" ? { status: "OPEN" as const } : status ? { status } : {}), ...(staffId ? { staffMemberId: staffId } : {}) }, load: boApi.timekeeping }); if (result.kind === "reconcile-page") { setPage(result.page); return; } setLoad({ state: "ready", page: result.data }); setSelectedId((current) => result.data.data.some((session) => session.id === current) ? current : ""); }} />
    </BoDataGridSidePeek> : null}
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>;
}

function Detail({ row, timeZone, onSaved }: { row: BoTimekeepingSession; timeZone: string; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [correctionType, setCorrectionType] = useState<"CHECK_IN_AT" | "CHECK_OUT_AT">("CHECK_IN_AT");
  const [correctedAt, setCorrectedAt] = useState(() => isoToLocalInput(row.effective.checkInAt, timeZone));
  const [reason, setReason] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolvedCheckOutAt, setResolvedCheckOutAt] = useState(() => isoToLocalInput(row.effective.checkOutAt ?? new Date().toISOString(), timeZone));
  const [resolveReason, setResolveReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const correctionAttempt = useRef<{ signature: string; key: string } | null>(null);
  const missedCheckoutAttempt = useRef<{ signature: string; key: string } | null>(null);

  useEffect(() => {
    setEditing(false);
    setCorrectionType("CHECK_IN_AT");
    setCorrectedAt(isoToLocalInput(row.effective.checkInAt, timeZone));
    setReason("");
    setResolving(false);
    setResolvedCheckOutAt(isoToLocalInput(row.effective.checkOutAt ?? new Date().toISOString(), timeZone));
    setResolveReason("");
    setNotice("");
    correctionAttempt.current = null;
    missedCheckoutAttempt.current = null;
  }, [row.id]);

  function changeType(next: "CHECK_IN_AT" | "CHECK_OUT_AT") {
    setCorrectionType(next);
    setCorrectedAt(isoToLocalInput(next === "CHECK_IN_AT" ? row.effective.checkInAt : (row.effective.checkOutAt ?? ""), timeZone));
  }

  async function resolveMissingCheckout() {
    if (!resolveReason.trim() || !resolvedCheckOutAt) return;
    const checkoutIso = localInputToIso(resolvedCheckOutAt, timeZone);
    if (!checkoutIso || new Date(checkoutIso).getTime() <= new Date(row.effective.checkInAt).getTime()) { setNotice("Checkout must be later than check-in and valid in the center timezone."); return; }
    const command = { checkOutAt: checkoutIso, reason: resolveReason.trim() };
    const signature = JSON.stringify({ sessionId: row.id, ...command });
    if (missedCheckoutAttempt.current?.signature !== signature) missedCheckoutAttempt.current = { signature, key: crypto.randomUUID() };
    const idempotencyKey = missedCheckoutAttempt.current.key;
    setBusy(true);
    setNotice("");
    try {
      await boApi.resolveMissedCheckout(row.id, command, idempotencyKey);
      await onSaved();
      missedCheckoutAttempt.current = null;
      setResolving(false);
      setNotice("Missing checkout resolved. Core was refetched before this status changed.");
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!reason.trim() || !correctedAt) return;
    const correctedIso = localInputToIso(correctedAt, timeZone);
    if (!correctedIso) { setNotice("Invalid or ambiguous local date/time for the center timezone."); return; }
    const other = correctionType === "CHECK_IN_AT" ? row.effective.checkOutAt : row.effective.checkInAt;
    if (other && (correctionType === "CHECK_IN_AT" ? Date.parse(correctedIso) >= Date.parse(other) : Date.parse(correctedIso) <= Date.parse(other))) { setNotice("Check-in must be earlier than check-out."); return; }
    const command = {
      correctionType,
      correctedAt: correctedIso,
      reason: reason.trim(),
      expectedLatestCorrectionId: row.latestCorrection?.id ?? null,
    };
    const signature = JSON.stringify({ sessionId: row.id, ...command });
    if (correctionAttempt.current?.signature !== signature) correctionAttempt.current = { signature, key: crypto.randomUUID() };
    const idempotencyKey = correctionAttempt.current.key;
    setBusy(true);
    setNotice("");
    try {
      await boApi.correctTimekeeping(row.id, command, idempotencyKey);
      await onSaved();
      correctionAttempt.current = null;
      setEditing(false);
      setNotice("Correction saved. Recorded history remains unchanged.");
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  return <div className={styles.peekDetail}>
    <div className={styles.detailHead}>
      <div><span>TimekeepingSession</span><h2>{row.staff.displayLabel}</h2><code>{row.id}</code></div>
      <span className={row.status === "OPEN" ? styles.openPill : styles.closedPill}>{row.status}</span>
    </div>

    <section>
      <h3>Recorded</h3>
      <Fact label="Center" value={row.centerId} />
      <Fact label="workDate" value={row.workDate} />
      <Fact label="Check-in" value={datetime(row.recorded.checkInAt, timeZone)} />
      <Fact label="Check-out" value={row.recorded.checkOutAt ? datetime(row.recorded.checkOutAt, timeZone) : "Not recorded"} />
      <Fact label="Duration" value={duration(row.recorded.durationSeconds)} />
    </section>

    {row.latestCorrection ? <section className={styles.correctedBlock}>
      <div className={styles.sectionTitle}><h3>Corrected</h3><span>Effective</span></div>
      <Fact label="Check-in" value={datetime(row.effective.checkInAt, timeZone)} />
      <Fact label="Check-out" value={row.effective.checkOutAt ? datetime(row.effective.checkOutAt, timeZone) : "Not recorded"} />
      <Fact label="Duration" value={duration(row.effective.durationSeconds)} />
      <div className={styles.correctionMeta}>
        <strong>{row.latestCorrection.correctionType}</strong>
        <span>{row.latestCorrection.reason}</span>
        <small>Corrected by {short(row.latestCorrection.createdByUserId)} · {datetime(row.latestCorrection.createdAt, timeZone)}</small>
      </div>
    </section> : null}

    <section>
      <h3>Assignment linkage</h3>
      <Fact label="assignmentId" value={row.assignmentId ?? "Historical legacy: none"} />
      {row.assignment ? <>
        <Fact label="Shift" value={row.assignment.shift ? `${row.assignment.shift.displayLabel} · ${row.assignment.shift.startLocalTime}–${row.assignment.shift.endLocalTime}` : row.assignment.shiftTemplateId} />
        <Fact label="Assignment status" value={row.assignment.status} />
        {row.assignment.replacesAssignmentId ? <Fact label="Replaces" value={row.assignment.replacesAssignmentId} /> : null}
        {row.assignment.cancelledAt ? <Fact label="Cancelled at" value={datetime(row.assignment.cancelledAt, timeZone)} /> : null}
      </> : null}
    </section>

    <section><h3>Core anomaly flags (canonical)</h3>{row.anomalyFlags.length ? row.anomalyFlags.map((flag) => <span key={flag} className={styles.anomaly}>{flag}</span>) : <p className={styles.muted}>No current canonical anomaly flags.</p>}</section>
    <section><h3>UI review signals (derived)</h3>{reviewSignals(row, localDate(timeZone), timeZone).length ? reviewSignals(row, localDate(timeZone), timeZone).map((signal) => <span key={signal} className={styles.anomaly}>{signal}</span>) : <p className={styles.muted}>No UI-derived review signals.</p>}</section>
    <section className={styles.timeline}><h3>Timeline</h3><div><i /><span>Recorded check-in · {datetime(row.recorded.checkInAt, timeZone)}</span></div>{row.recorded.checkOutAt ? <div><i /><span>Recorded check-out · {datetime(row.recorded.checkOutAt, timeZone)}</span></div> : <div><i /><span>Session remains OPEN</span></div>}{row.latestCorrection ? <div><i /><span>Correction appended · {datetime(row.latestCorrection.createdAt, timeZone)}</span></div> : null}</section>

    {row.status === "CLOSED" ? <section className={styles.correctionSection}>
      {!editing ? <button className={styles.correctButton} onClick={() => setEditing(true)}>Correct attendance</button> : <div className={styles.correctionForm}>
        <div className={styles.correctionHeading}><div><strong>Correct attendance</strong><span>Creates a new append-only correction. Recorded values above do not change.</span></div><button onClick={() => setEditing(false)}>Cancel</button></div>
        <label>Correction type<select value={correctionType} onChange={(event) => changeType(event.target.value as "CHECK_IN_AT" | "CHECK_OUT_AT")}><option value="CHECK_IN_AT">Check-in time</option><option value="CHECK_OUT_AT">Check-out time</option></select></label>
        <label>Ngày và giờ thực tế · {timeZone}<input type="datetime-local" value={correctedAt} onChange={(event) => setCorrectedAt(event.target.value)} /></label>
        <label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Why is this correction required?" /></label>
        <div className={styles.resultPreview}><span>Current effective</span><strong>{correctionType === "CHECK_IN_AT" ? datetime(row.effective.checkInAt, timeZone) : (row.effective.checkOutAt ? datetime(row.effective.checkOutAt, timeZone) : "—")}</strong></div>
        <button className={styles.saveCorrection} disabled={busy || !reason.trim() || !correctedAt} onClick={() => void save()}>{busy ? "Saving…" : "Save correction"}</button>
      </div>}
      {notice ? <p className={styles.correctionNotice}>{notice}</p> : null}
    </section> : <section className={styles.correctionSection}>
      {!resolving ? <button className={styles.correctButton} onClick={() => setResolving(true)}>Resolve missing checkout</button> : <div className={styles.correctionForm}>
        <div className={styles.correctionHeading}><div><strong>Resolve missing checkout</strong><span>Closes this exact OPEN session in Core. Enter the actual checkout time; PINO will not infer it.</span></div><button onClick={() => setResolving(false)}>Cancel</button></div>
        <div className={styles.resultPreview}><span>Recorded check-in</span><strong>{datetime(row.recorded.checkInAt, timeZone)}</strong></div>
        <label>Ngày và giờ ra thực tế · {timeZone}<input type="datetime-local" value={resolvedCheckOutAt} onChange={(event) => setResolvedCheckOutAt(event.target.value)} /></label>
        <label>Reason<textarea value={resolveReason} onChange={(event) => setResolveReason(event.target.value)} rows={3} placeholder="How was the actual checkout time confirmed?" /></label>
        <button className={styles.saveCorrection} disabled={busy || !resolveReason.trim() || !resolvedCheckOutAt} onClick={() => void resolveMissingCheckout()}>{busy ? "Resolving…" : "Resolve checkout"}</button>
      </div>}
      {notice ? <p className={styles.correctionNotice}>{notice}</p> : null}
    </section>}
  </div>;
}

function reviewSignals(row: BoTimekeepingSession, today: string, timeZone: string): string[] {
  const signals: string[] = [];
  if (row.status === "OPEN" && row.workDate < today) signals.push("Overdue OPEN");
  if (row.status === "CLOSED" && row.effective.durationSeconds === 0) signals.push("Zero duration");
  if (row.effective.durationSeconds !== null && row.effective.durationSeconds > 16 * 3600) signals.push("Long duration");
  if (row.effective.checkOutAt && isoToLocalInput(row.effective.checkInAt, timeZone).slice(0, 10) !== isoToLocalInput(row.effective.checkOutAt, timeZone).slice(0, 10)) signals.push("Overnight");
  return signals;
}
function Fact({ label, value }: { label: string; value: string }) { return <div className={styles.fact}><span>{label}</span><strong>{value}</strong></div>; }
function State({ text, error = false }: { text: string; error?: boolean }) { return <div className={`${styles.state} ${error ? styles.error : ""}`}>{text}</div>; }
function localDate(timeZone: string) { return isoToLocalInput(new Date().toISOString(), timeZone).slice(0, 10); }
function dateDaysBefore(value: string, days: number) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value; const date = new Date(value + "T12:00:00Z"); date.setUTCDate(date.getUTCDate() - days); return date.toISOString().slice(0, 10); }
function clock(value: string, timeZone: string) { return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(value)); }
function datetime(value: string, timeZone: string) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value)); }
function duration(value: number | null) { if (value === null) return "—"; const hours = Math.floor(value / 3600), minutes = Math.floor((value % 3600) / 60); return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`; }
function short(value: string) { return value.slice(0, 8); }
function message(error: unknown) { if (error instanceof BoApiError) return `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}`; return error instanceof Error ? error.message : "Không tải được timekeeping."; }
