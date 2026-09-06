"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoCenter, BoTimekeepingPage, BoTimekeepingSession } from "@/lib/bo-model";
import styles from "./timekeeping.module.css";

type Mode = "today" | "history";
type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; page: BoTimekeepingPage };

export function TimekeepingView() {
  const [centers, setCenters] = useState<BoCenter[]>([]);
  const [centerId, setCenterId] = useState("");
  const [mode, setMode] = useState<Mode>("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"" | "OPEN" | "CLOSED">("");
  const [staffId, setStaffId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [load, setLoad] = useState<Load>({ state: "loading" });

  const selectedCenter = centers.find((center) => center.id === centerId) ?? null;
  const today = selectedCenter ? localDate(selectedCenter.timeZone) : "";
  const page = load.state === "ready" ? load.page : null;
  const staffOptions = useMemo(
    () => Array.from(new Map((page?.data ?? []).map((session) => [session.staff.id, session.staff])).values()).sort((a, b) => a.displayLabel.localeCompare(b.displayLabel)),
    [page],
  );
  const selected = page?.data.find((session) => session.id === selectedId) ?? null;
  const timeZone = selectedCenter?.timeZone ?? "UTC";

  useEffect(() => {
    let active = true;
    void boApi.scopeCatalog().then((scope) => {
      if (!active) return;
      const next = scope.centers.filter((center) => center.status === "active");
      setCenters(next);
      const first = next[0];
      if (first) {
        setCenterId(first.id);
        const date = localDate(first.timeZone);
        setStartDate(date);
        setEndDate(date);
      }
    }).catch((error) => active && setLoad({ state: "error", message: message(error) }));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!centerId || !selectedCenter) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, mode, startDate, endDate, status, staffId, selectedCenter?.timeZone]);

  async function refresh(cursor?: string, silent = false) {
    if (!silent) setLoad({ state: "loading" });
    try {
      const params = mode === "today" ? { centerId, workDate: today } : { centerId, startDate, endDate };
      const result = await boApi.timekeeping({
        ...params,
        ...(status ? { status } : {}),
        ...(staffId ? { staffMemberId: staffId } : {}),
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      setLoad({ state: "ready", page: result });
      setSelectedId((current) => result.data.some((session) => session.id === current) ? current : (result.data[0]?.id ?? ""));
    } catch (error) {
      setLoad({ state: "error", message: message(error) });
    }
  }

  return <main className={styles.page}>
    <header className={styles.heading}>
      <span>Back Office · Workforce</span>
      <h1>Timekeeping</h1>
      <p>Recorded attendance stays immutable. Authorized corrections are appended as provenance and shown separately.</p>
    </header>

    <section className={styles.toolbar}>
      <div className={styles.tabs}>
        <button className={mode === "today" ? styles.activeTab : ""} onClick={() => setMode("today")}>Today</button>
        <button className={mode === "history" ? styles.activeTab : ""} onClick={() => setMode("history")}>History</button>
      </div>
      <label>Center<select value={centerId} onChange={(event) => { setCenterId(event.target.value); setStaffId(""); }}>{centers.map((center) => <option key={center.id} value={center.id}>{center.displayName}</option>)}</select></label>
      {mode === "history" ? <>
        <label>From<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label>To<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      </> : <div className={styles.today}>{today}</div>}
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="">All</option><option>OPEN</option><option>CLOSED</option></select></label>
      <label>Staff<select value={staffId} onChange={(event) => setStaffId(event.target.value)}><option value="">All</option>{staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.displayLabel}</option>)}</select></label>
    </section>

    {page && mode === "today" ? <section className={styles.metrics}>
      <Metric label="Currently checked in" value={page.summary.openSessions} />
      <Metric label="Checked out today" value={page.summary.closedSessions} />
      <Metric label="No checkout yet" value={page.summary.openSessions} />
      <Metric label="Total sessions" value={page.summary.totalSessions} />
    </section> : null}

    {load.state === "loading" ? <State text="Đang tải TimekeepingSession từ Core…" /> : null}
    {load.state === "error" ? <State text={load.message} error /> : null}
    {page ? <div className={styles.workspace}>
      <section className={styles.listPanel}>
        <div className={styles.listHead}><div><strong>{mode === "today" ? "Today" : "History"}</strong><span>{page.summary.totalSessions} sessions</span></div><span>Effective view</span></div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Staff</th><th>Date</th><th>Check-in</th><th>Check-out</th><th>Duration</th><th>Assignment</th><th>Status</th></tr></thead>
            <tbody>{page.data.map((row) => <tr key={row.id} className={selectedId === row.id ? styles.selectedRow : ""} onClick={() => setSelectedId(row.id)}>
              <td><strong>{row.staff.displayLabel}</strong><small>{row.latestCorrection ? "Corrected" : short(row.staff.id)}</small></td>
              <td>{row.workDate}</td>
              <td>{clock(row.effective.checkInAt, timeZone)}</td>
              <td>{row.effective.checkOutAt ? clock(row.effective.checkOutAt, timeZone) : "—"}</td>
              <td>{duration(row.effective.durationSeconds)}</td>
              <td>{row.assignment?.shift?.displayLabel ?? (row.assignmentId ? short(row.assignmentId) : "Legacy")}</td>
              <td><span className={row.status === "OPEN" ? styles.openPill : styles.closedPill}>{row.status}</span></td>
            </tr>)}</tbody>
          </table>
        </div>
        {page.nextCursor ? <button className={styles.more} onClick={() => void refresh(page.nextCursor!)}>Load next page</button> : null}
      </section>
      <aside className={styles.detail}>{selected ? <Detail row={selected} timeZone={timeZone} onSaved={() => refresh(undefined, true)} /> : <div className={styles.empty}>Chọn một TimekeepingSession để xem chi tiết.</div>}</aside>
    </div> : null}
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>;
}

function Detail({ row, timeZone, onSaved }: { row: BoTimekeepingSession; timeZone: string; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [correctionType, setCorrectionType] = useState<"CHECK_IN_AT" | "CHECK_OUT_AT">("CHECK_IN_AT");
  const [correctedAt, setCorrectedAt] = useState(row.effective.checkInAt);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setEditing(false);
    setCorrectionType("CHECK_IN_AT");
    setCorrectedAt(row.effective.checkInAt);
    setReason("");
    setNotice("");
  }, [row.id]);

  function changeType(next: "CHECK_IN_AT" | "CHECK_OUT_AT") {
    setCorrectionType(next);
    setCorrectedAt(next === "CHECK_IN_AT" ? row.effective.checkInAt : (row.effective.checkOutAt ?? ""));
  }

  async function save() {
    if (!reason.trim() || !correctedAt) return;
    setBusy(true);
    setNotice("");
    try {
      await boApi.correctTimekeeping(row.id, {
        correctionType,
        correctedAt,
        reason: reason.trim(),
        expectedLatestCorrectionId: row.latestCorrection?.id ?? null,
      }, crypto.randomUUID());
      await onSaved();
      setEditing(false);
      setNotice("Correction saved. Recorded history remains unchanged.");
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  return <>
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

    <section><h3>Provenance / anomalies</h3>{row.anomalyFlags.length ? row.anomalyFlags.map((flag) => <span key={flag} className={styles.anomaly}>{flag}</span>) : <p className={styles.muted}>No current canonical anomaly flags.</p>}</section>
    <section className={styles.timeline}><h3>Timeline</h3><div><i /><span>Recorded check-in · {datetime(row.recorded.checkInAt, timeZone)}</span></div>{row.recorded.checkOutAt ? <div><i /><span>Recorded check-out · {datetime(row.recorded.checkOutAt, timeZone)}</span></div> : <div><i /><span>Session remains OPEN</span></div>}{row.latestCorrection ? <div><i /><span>Correction appended · {datetime(row.latestCorrection.createdAt, timeZone)}</span></div> : null}</section>

    {row.status === "CLOSED" ? <section className={styles.correctionSection}>
      {!editing ? <button className={styles.correctButton} onClick={() => setEditing(true)}>Correct attendance</button> : <div className={styles.correctionForm}>
        <div className={styles.correctionHeading}><div><strong>Correct attendance</strong><span>Creates a new append-only correction. Recorded values above do not change.</span></div><button onClick={() => setEditing(false)}>Cancel</button></div>
        <label>Correction type<select value={correctionType} onChange={(event) => changeType(event.target.value as "CHECK_IN_AT" | "CHECK_OUT_AT")}><option value="CHECK_IN_AT">Check-in time</option><option value="CHECK_OUT_AT">Check-out time</option></select></label>
        <label>Corrected timestamp (UTC ISO)<input value={correctedAt} onChange={(event) => setCorrectedAt(event.target.value)} placeholder="2026-09-06T01:15:00.000Z" /></label>
        <label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Why is this correction required?" /></label>
        <div className={styles.resultPreview}><span>Current effective</span><strong>{correctionType === "CHECK_IN_AT" ? datetime(row.effective.checkInAt, timeZone) : (row.effective.checkOutAt ? datetime(row.effective.checkOutAt, timeZone) : "—")}</strong></div>
        <button className={styles.saveCorrection} disabled={busy || !reason.trim() || !correctedAt} onClick={() => void save()}>{busy ? "Saving…" : "Save correction"}</button>
      </div>}
      {notice ? <p className={styles.correctionNotice}>{notice}</p> : null}
    </section> : <p className={styles.readOnlyNote}>OPEN session correction is not available here. Missing checkout is owned by the bounded F4 flow.</p>}
  </>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div className={styles.fact}><span>{label}</span><strong>{value}</strong></div>; }
function State({ text, error = false }: { text: string; error?: boolean }) { return <div className={`${styles.state} ${error ? styles.error : ""}`}>{text}</div>; }
function localDate(timeZone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date()); }
function clock(value: string, timeZone: string) { return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(value)); }
function datetime(value: string, timeZone: string) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value)); }
function duration(value: number | null) { if (value === null) return "—"; const hours = Math.floor(value / 3600), minutes = Math.floor((value % 3600) / 60); return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`; }
function short(value: string) { return value.slice(0, 8); }
function message(error: unknown) { if (error instanceof BoApiError) return `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}`; return error instanceof Error ? error.message : "Không tải được timekeeping."; }
