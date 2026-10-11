"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BoDataGrid, BoDataGridCanonicalId, BoDataGridSidePeek, BoDataGridStatus, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import { useBoDataGridUrlState } from "@/app/bo/components/data-grid/useBoDataGridUrlState";
import { boApi, BoApiError } from "@/lib/bo-api";
import { boDataGridRange } from "@/lib/bo-data-grid-state";
import type { BoCenter } from "@/lib/bo-model";
import type { BoDutyExceptionReview, BoDutyExceptionStatus } from "@/lib/bo-workforce-duty-exception";
import styles from "./duty-exceptions.module.css";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready" };
type Filter = "ALL" | BoDutyExceptionStatus;
const GRID_OPTIONS = { defaultPageSize: 25, allowedPageSizes: [10, 25, 50, 100] as const };

export function DutyExceptionsView() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const grid = useBoDataGridUrlState(GRID_OPTIONS);
  const selectedId = searchParams.get("dutyException");
  const [centers, setCenters] = useState<BoCenter[]>([]);
  const [rows, setRows] = useState<BoDutyExceptionReview[]>([]);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const activeCenters = useMemo(() => centers.filter((item) => item.status === "active"), [centers]);
  const centerId = grid.state.filters.center ?? activeCenters[0]?.id ?? "";
  const filter = normalizeStatus(grid.state.filters.status);

  function selectException(nextId: string | null, history: "push" | "replace" = "replace") {
    const params = new URLSearchParams(searchParams.toString());
    if (nextId) params.set("dutyException", nextId); else params.delete("dutyException");
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    if (history === "push") router.push(href, { scroll: false }); else router.replace(href, { scroll: false });
    setPassword(""); setNotice("");
  }

  useEffect(() => {
    let active = true;
    void boApi.centers().then((items) => {
      if (!active) return;
      setCenters(items);
      const activeItems = items.filter((item) => item.status === "active");
      if (!activeItems.length) setLoad({ state: "error", message: "Không có Center canonical để review Duty Exceptions." });
      const requested = grid.state.filters.center;
      if (requested && !activeItems.some((item) => item.id === requested)) grid.setFilter("center", null);
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
      if (preserveId && !ordered.some((item) => item.exception.id === preserveId)) selectException(null);
      setLoad({ state: "ready" });
    } catch (error) {
      setRows([]); selectException(null); setLoad({ state: "error", message: message(error) });
    }
  }

  const visible = useMemo(() => {
    const needle = grid.state.search.trim().toLocaleLowerCase("vi");
    return rows.filter((item) => (filter === "ALL" || item.exception.status === filter)
      && (!needle || `${item.staff.displayLabel} ${item.staff.id} ${item.center.displayName} ${item.exception.reason} ${item.session.id} ${item.exception.id}`.toLocaleLowerCase("vi").includes(needle)));
  }, [filter, grid.state.search, rows]);
  const sorted = useMemo(() => {
    const key = grid.state.sortKey ?? "requested";
    const direction = grid.state.sortDirection === "desc" ? -1 : 1;
    return [...visible].sort((left, right) => direction * compareRows(left, right, key));
  }, [grid.state.sortDirection, grid.state.sortKey, visible]);
  const range = boDataGridRange(grid.state.page, grid.state.pageSize, sorted.length);
  const pageRows = sorted.slice((range.page - 1) * grid.state.pageSize, range.page * grid.state.pageSize);
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

  const columns = useMemo<BoDataGridColumn<BoDutyExceptionReview>[]>(() => [
    { key: "staff", header: "Staff", sortable: true, sticky: true, minWidth: 220, render: (item) => <div><strong>{item.staff.displayLabel}</strong><BoDataGridCanonicalId value={item.staff.id} label={`Copy ${item.staff.displayLabel} staff ID`} /></div> },
    { key: "session", header: "Shift / Session", sortable: true, minWidth: 220, render: (item) => <div><strong>{item.shift?.displayLabel ?? "Open session"}</strong><div>{item.session.workDate}</div><BoDataGridCanonicalId value={item.session.id} label="Copy TimekeepingSession ID" /></div> },
    { key: "reason", header: "Reason", sortable: true, minWidth: 300, render: (item) => item.exception.reason },
    { key: "requested", header: "Requested", sortable: true, minWidth: 170, render: (item) => dateTime(item.exception.requestedAt) },
    { key: "status", header: "Status", sortable: true, minWidth: 130, render: (item) => <BoDataGridStatus value={item.exception.status} tone={item.exception.status === "APPROVED" ? "success" : "warning"} /> },
  ], []);

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span>Back Office · Workforce</span><h1>Duty Exceptions</h1><p>Manager review cho checkout exception; source duties vẫn giữ nguyên authority.</p></div>
    </header>
    {notice ? <div className={styles.notice}>{notice}</div> : null}

    <BoDataGrid
      rows={pageRows}
      columns={columns}
      rowKey={(item) => item.exception.id}
      caption="Duty exception requests"
      state={load.state === "loading" ? "loading" : load.state === "error" ? "error" : "ready"}
      stateMessage={load.state === "error" ? load.message : undefined}
      search={grid.state.search}
      onSearchChange={grid.setSearch}
      searchPlaceholder="Staff, reason, session, request ID…"
      sortKey={grid.state.sortKey ?? "requested"}
      sortDirection={grid.state.sortDirection}
      onSortChange={grid.setSort}
      onRefresh={() => void refresh().catch((error) => setLoad({ state: "error", message: message(error) }))}
      resultLabel={`${sorted.length} / ${rows.length} exceptions`}
      selectedRowKey={selectedId}
      onRowOpen={busy ? undefined : (item) => selectException(item.exception.id, "push")}
      filterChips={[
        ...(grid.state.filters.center ? [{ key: "center", label: "Center", value: activeCenters.find((item) => item.id === centerId)?.displayName ?? centerId, onClear: () => grid.setFilter("center", null) }] : []),
        ...(filter !== "ALL" ? [{ key: "status", label: "Status", value: filter, onClear: () => grid.setFilter("status", null) }] : []),
      ]}
      toolbarActions={<div className={styles.toolbar}>
        <label>Center<select aria-label="Filter Duty Exceptions by center" value={centerId} disabled={busy || !activeCenters.length} onChange={(event) => grid.setFilter("center", event.target.value || null)}>{activeCenters.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
        <label>Status<select aria-label="Filter Duty Exceptions by status" value={filter} disabled={busy} onChange={(event) => grid.setFilter("status", event.target.value === "ALL" ? null : event.target.value)}><option value="REQUESTED">Requested</option><option value="APPROVED">Approved</option><option value="ALL">All</option></select></label>
      </div>}
      emptyTitle="Không có Duty Exception phù hợp"
      emptyMessage="Thử đổi Center, Status hoặc search. Canonical exception state vẫn ở Core."
      pagination={{ page: range.page, pageSize: grid.state.pageSize, total: sorted.length, pageSizeOptions: GRID_OPTIONS.allowedPageSizes, onPageChange: grid.setPage, onPageSizeChange: grid.setPageSize }}
    />

    {selectedId ? <BoDataGridSidePeek title={selected?.staff.displayLabel ?? "Duty Exception"} eyebrow="Workforce · Duty Exception" onClose={() => { if (!busy) selectException(null); }}>
      {!selected ? <div className={styles.loading}>Đang đọc canonical exception detail…</div> : <div>
        <div className={styles.detailHead}>
          <div><p>{selected.center.displayName}</p><h2>{selected.staff.displayLabel}</h2><small>{selected.session.workDate} · {selected.shift?.displayLabel ?? "Open TimekeepingSession"}</small></div>
          <BoDataGridStatus value={selected.exception.status} tone={selected.exception.status === "APPROVED" ? "success" : "warning"} />
        </div>
        <div className={styles.peekBody}>
          <section className={styles.detailSection}><h3>Request</h3><p className={styles.reasonFull}>{selected.exception.reason}</p><Meta label="Requested" value={dateTime(selected.exception.requestedAt)} /><Meta label="Exception" value={selected.exception.id} /><Meta label="Session" value={selected.session.id} /><Meta label="Check-in" value={dateTime(selected.session.checkInAt)} /></section>
          <section className={styles.detailSection}><h3>Unresolved duties at request</h3><div className={styles.dutyList}>{selected.exception.obligationRefs.map((ref) => <DutyRef key={ref} value={ref} />)}</div><small>Exact set hash <code>{selected.exception.obligationSetHash.slice(0, 16)}…</code></small></section>
          <section className={styles.detailSection}><h3>Manager decision</h3>{selected.exception.status === "REQUESTED" ? <><p>Approve yêu cầu fresh current-password verification. Password chỉ đi qua request này tới Access Control.</p><label className={styles.passwordField}>Current password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button type="button" className={styles.approve} disabled={!password || busy} onClick={() => void approve()}>{busy ? "Đang verify & approve…" : "Approve exception"}</button><small>Không có Reject persistence trong canonical contract hiện tại.</small></> : <><div className={styles.approvedBox}><strong>Approved</strong><span>{dateTime(selected.exception.approvedAt)}</span></div><Meta label="Approved by" value={selected.exception.approvedByUserId ?? "—"} /><Meta label="Proof ref" value={selected.exception.approvalProofRef ?? "—"} /><p>Underlying Attendance/Diary duties không bị mark complete hoặc waived.</p></>}</section>
        </div>
      </div>}
    </BoDataGridSidePeek> : null}
  </main>;
}

function compareRows(left: BoDutyExceptionReview, right: BoDutyExceptionReview, key: string) {
  if (key === "staff") return left.staff.displayLabel.localeCompare(right.staff.displayLabel) || left.exception.id.localeCompare(right.exception.id);
  if (key === "session") return left.session.workDate.localeCompare(right.session.workDate) || left.session.id.localeCompare(right.session.id);
  if (key === "reason") return left.exception.reason.localeCompare(right.exception.reason) || left.exception.id.localeCompare(right.exception.id);
  if (key === "status") return left.exception.status.localeCompare(right.exception.status) || left.exception.requestedAt.localeCompare(right.exception.requestedAt);
  return left.exception.requestedAt.localeCompare(right.exception.requestedAt) || left.exception.id.localeCompare(right.exception.id);
}
function normalizeStatus(value: string | undefined): Filter { return value === "APPROVED" || value === "ALL" ? value : "REQUESTED"; }
function Meta({ label, value }: { label: string; value: string }) { return <div className={styles.meta}><span>{label}</span><code>{value}</code></div>; }
function DutyRef({ value }: { value: string }) { const [domain = "UNKNOWN", type = "UNKNOWN", sourceRef = value] = value.split("::"); return <article className={styles.dutyRef}><span>{domain}</span><strong>{dutyLabel(type)}</strong><small>{sourceRef}</small></article>; }
function dutyLabel(type: string) { if (type === "CLASSROOM_DIARY_COMPLETION") return "Classroom Diary"; if (type === "LEARNING_SESSION_ATTENDANCE_SETTLEMENT") return "Attendance settlement"; return type.replaceAll("_", " ").toLocaleLowerCase("vi"); }
function dateTime(value: string | null) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(date); }
function message(error: unknown) { if (error instanceof BoApiError) { if (error.status === 401) return "Phiên BO đã hết hạn. Đăng nhập lại trước khi review."; if (error.status === 403) return "Manager hiện không có quyền review/approve Duty Exceptions ở Center này."; if (error.status === 409) return "Exception context đã thay đổi. Danh sách đã được refresh; review lại exact session/unresolved set."; return `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}`; } return error instanceof Error ? error.message : "Không thể hoàn tất Duty Exception operation."; }
