"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoCenter } from "@/lib/bo-model";
import type { BoDutyExceptionReview, BoDutyExceptionStatus } from "@/lib/bo-workforce-duty-exception";
import styles from "./duty-exceptions.module.css";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready" };
type Filter = "ALL" | BoDutyExceptionStatus;

export function DutyExceptionsView() {
  const [centers, setCenters] = useState<BoCenter[]>([]);
  const [centerId, setCenterId] = useState("");
  const [rows, setRows] = useState<BoDutyExceptionReview[]>([]);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<Filter>("REQUESTED");
  const [query, setQuery] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void boApi.centers().then((items) => {
      if (!active) return;
      setCenters(items);
      const first = items.find((item) => item.status === "active") ?? items[0];
      if (first) setCenterId(first.id);
      else setLoad({ state: "error", message: "Không có Center canonical để review Duty Exceptions." });
    }).catch((error: unknown) => { if (active) setLoad({ state: "error", message: message(error) }); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!centerId) return;
    void refresh(centerId);
    // One exact Center projection at a time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId]);

  async function refresh(nextCenter = centerId, preserveId = selectedId) {
    if (!nextCenter) return;
    setLoad({ state: "loading" });
    try {
      const next = await boApi.dutyExceptions(nextCenter);
      const ordered = [...next].sort((left, right) => {
        if (left.exception.status !== right.exception.status) return left.exception.status === "REQUESTED" ? -1 : 1;
        return right.exception.requestedAt.localeCompare(left.exception.requestedAt);
      });
      setRows(ordered);
      const preserved = preserveId && ordered.some((item) => item.exception.id === preserveId) ? preserveId : "";
      setSelectedId(preserved || ordered.find((item) => item.exception.status === "REQUESTED")?.exception.id || ordered[0]?.exception.id || "");
      setLoad({ state: "ready" });
    } catch (error) {
      setRows([]); setSelectedId(""); setLoad({ state: "error", message: message(error) });
    }
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi");
    return rows.filter((item) => (filter === "ALL" || item.exception.status === filter)
      && (!needle || `${item.staff.displayLabel} ${item.exception.reason} ${item.session.id}`.toLocaleLowerCase("vi").includes(needle)));
  }, [filter, query, rows]);
  const selected = rows.find((item) => item.exception.id === selectedId) ?? null;

  async function approve() {
    if (!selected || selected.exception.status !== "REQUESTED" || !password) return;
    setBusy(true); setNotice("");
    try {
      await boApi.approveDutyException(selected.exception.id, selected.center.id, selected.exception.version, password);
      await refresh(selected.center.id, selected.exception.id);
      setNotice("Exception đã được Core approve trên exact TimekeepingSession/unresolved set.");
    } catch (error) {
      if (error instanceof BoApiError && error.status === 409) await refresh(selected.center.id, selected.exception.id);
      setNotice(message(error));
    } finally {
      setPassword(""); setBusy(false);
    }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span>Back Office · Workforce</span><h1>Duty Exceptions</h1><p>Manager review cho checkout exception; source duties vẫn giữ nguyên authority.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={!centerId || load.state === "loading"}>Refresh</button>
    </header>

    <section className={styles.toolbar}>
      <label>Center<select value={centerId} onChange={(event) => { setCenterId(event.target.value); setSelectedId(""); setNotice(""); }}>
        {centers.filter((item) => item.status === "active").map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
      </select></label>
      <label>Status<select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
        <option value="REQUESTED">Requested</option><option value="APPROVED">Approved</option><option value="ALL">All</option>
      </select></label>
      <label className={styles.search}>Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Staff, reason, session…" /></label>
    </section>

    {notice ? <div className={styles.notice}>{notice}</div> : null}
    {load.state === "error" ? <div className={styles.error}>{load.message}</div> : null}
    {load.state === "loading" ? <div className={styles.loading}>Đang đọc canonical exception records từ Core…</div> : null}

    {load.state === "ready" ? <section className={styles.listPage}>
      <div className={styles.listHead}><span>Staff</span><span>Shift / Session</span><span>Reason</span><span>Requested</span><span>Status</span></div>
      {visible.length ? visible.map((item) => <button type="button" className={styles.row} key={item.exception.id} onClick={() => { setSelectedId(item.exception.id); setPassword(""); setNotice(""); }}>
        <span className={styles.staffCell}><strong>{item.staff.displayLabel}</strong><small>{item.center.displayName}</small></span>
        <span><strong>{item.shift?.displayLabel ?? "Open session"}</strong><small>{item.session.workDate} · {shortId(item.session.id)}</small></span>
        <span className={styles.reason}>{item.exception.reason}</span>
        <span>{dateTime(item.exception.requestedAt)}</span>
        <span><Status value={item.exception.status} /></span>
      </button>) : <div className={styles.empty}>Không có exception nào trong filter hiện tại.</div>}
    </section> : null}

    {selected ? <>
      <button type="button" aria-label="Close detail" className={styles.backdrop} onClick={() => setSelectedId("")} />
      <aside className={styles.peek}>
        <div className={styles.peekTop}><button type="button" onClick={() => setSelectedId("")}>✕</button><span>Duty Exception · {shortId(selected.exception.id)}</span></div>
        <div className={styles.detailHead}>
          <div><p>{selected.center.displayName}</p><h2>{selected.staff.displayLabel}</h2><small>{selected.session.workDate} · {selected.shift?.displayLabel ?? "Open TimekeepingSession"}</small></div>
          <Status value={selected.exception.status} />
        </div>
        <div className={styles.peekBody}>
          <section className={styles.detailSection}><h3>Request</h3><p className={styles.reasonFull}>{selected.exception.reason}</p><Meta label="Requested" value={dateTime(selected.exception.requestedAt)} /><Meta label="Session" value={selected.session.id} /><Meta label="Check-in" value={dateTime(selected.session.checkInAt)} /></section>
          <section className={styles.detailSection}><h3>Unresolved duties at request</h3><div className={styles.dutyList}>{selected.exception.obligationRefs.map((ref) => <DutyRef key={ref} value={ref} />)}</div><small>Exact set hash <code>{selected.exception.obligationSetHash.slice(0, 16)}…</code></small></section>
          <section className={styles.detailSection}>
            <h3>Manager decision</h3>
            {selected.exception.status === "REQUESTED" ? <>
              <p>Approve yêu cầu fresh current-password verification. Password chỉ đi qua request này tới Access Control.</p>
              <label className={styles.passwordField}>Current password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <button type="button" className={styles.approve} disabled={!password || busy} onClick={() => void approve()}>{busy ? "Đang verify & approve…" : "Approve exception"}</button>
              <small>Không có Reject persistence trong canonical contract hiện tại.</small>
            </> : <>
              <div className={styles.approvedBox}><strong>Approved</strong><span>{dateTime(selected.exception.approvedAt)}</span></div>
              <Meta label="Approved by" value={selected.exception.approvedByUserId ?? "—"} />
              <Meta label="Proof ref" value={selected.exception.approvalProofRef ?? "—"} />
              <p>Underlying Attendance/Diary duties không bị mark complete hoặc waived.</p>
            </>}
          </section>
        </div>
      </aside>
    </> : null}
  </main>;
}

function Status({ value }: { value: BoDutyExceptionStatus }) {
  return <span className={styles.status} data-status={value}>{value}</span>;
}
function Meta({ label, value }: { label: string; value: string }) {
  return <div className={styles.meta}><span>{label}</span><code>{value}</code></div>;
}
function DutyRef({ value }: { value: string }) {
  const [domain = "UNKNOWN", type = "UNKNOWN", sourceRef = value] = value.split("::");
  return <article className={styles.dutyRef}><span>{domain}</span><strong>{dutyLabel(type)}</strong><small>{sourceRef}</small></article>;
}
function dutyLabel(type: string) {
  if (type === "CLASSROOM_DIARY_COMPLETION") return "Classroom Diary";
  if (type === "LEARNING_SESSION_ATTENDANCE_SETTLEMENT") return "Attendance settlement";
  return type.replaceAll("_", " ").toLocaleLowerCase("vi");
}
function dateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}
function shortId(value: string) { return value.slice(0, 8); }
function message(error: unknown) {
  if (error instanceof BoApiError) {
    if (error.status === 401) return "Phiên BO đã hết hạn. Đăng nhập lại trước khi review.";
    if (error.status === 403) return "Manager hiện không có quyền review/approve Duty Exceptions ở Center này.";
    if (error.status === 409) return "Exception context đã thay đổi. Danh sách đã được refresh; review lại exact session/unresolved set.";
    return `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}`;
  }
  return error instanceof Error ? error.message : "Không thể hoàn tất Duty Exception operation.";
}
