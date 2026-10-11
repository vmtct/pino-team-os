"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BoDataGrid, BoDataGridCanonicalId, BoDataGridSidePeek, BoDataGridStatus, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import { useBoDataGridUrlState } from "@/app/bo/components/data-grid/useBoDataGridUrlState";
import { boApi, BoApiError } from "@/lib/bo-api";
import { boDataGridRange } from "@/lib/bo-data-grid-state";
import type { BoCenter, BoUnscheduledCheckInRequest } from "@/lib/bo-model";
import styles from "../bo.module.css";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; rows: BoUnscheduledCheckInRequest[] };
type DetailLoad = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; row: BoUnscheduledCheckInRequest };
type FilterStatus = "ALL" | BoUnscheduledCheckInRequest["status"];

const GRID_OPTIONS = { defaultPageSize: 25, allowedPageSizes: [10, 25, 50, 100] as const };
const STATUS_FILTERS: Array<{ value: FilterStatus; label: string }> = [
  { value: "ALL", label: "Tất cả" },
  { value: "REQUESTED", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "DECLINED", label: "Đã từ chối" },
  { value: "CANCELLED", label: "Đã hủy" },
];

export function CheckInExceptionsView() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const grid = useBoDataGridUrlState(GRID_OPTIONS);
  const selectedId = searchParams.get("checkInException");
  const [centers, setCenters] = useState<BoCenter[]>([]);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [detail, setDetail] = useState<DetailLoad | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const mutationAttempt=useRef<{signature:string;key:string}|null>(null);
  const detailToken = useRef(0);

  const centerId = grid.state.filters.center ?? centers[0]?.id ?? "";
  const status = normalizeStatusFilter(grid.state.filters.status);

  function selectRequest(nextId: string | null, history: "push" | "replace" = "replace") {
    detailToken.current += 1;
    const params = new URLSearchParams(searchParams.toString());
    if (nextId) params.set("checkInException", nextId);
    else params.delete("checkInException");
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    if (history === "push") router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
    if (!nextId) setDetail(null);
    setNotice("");
  }

  useEffect(() => {
    let active = true;
    void boApi.workforceCheckInExceptionCenters().then((data) => {
      if (!active) return;
      setCenters(data);
      if (!data.length) setLoad({ state: "ready", rows: [] });
      const requested = grid.state.filters.center;
      if (requested && !data.some((center) => center.id === requested)) grid.setFilter("center", null);
    }).catch((error) => {
      if (active) setLoad({ state: "error", message: msg(error) });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!centerId) return;
    let active = true;
    setLoad({ state: "loading" });
    setNotice("");
    void boApi.workforceCheckInExceptions(centerId, status === "ALL" ? undefined : status).then((rows) => {
      if (active) setLoad({ state: "ready", rows });
    }).catch((error) => {
      if (active) setLoad({ state: "error", message: msg(error) });
    });
    return () => { active = false; };
  }, [centerId, status]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const token = ++detailToken.current;
    setDetail({ state: "loading" });
    void boApi.workforceCheckInException(selectedId).then((row) => {
      if (token === detailToken.current) setDetail({ state: "ready", row });
    }).catch((error) => {
      if (token === detailToken.current) setDetail({ state: "error", message: msg(error) });
    });
  }, [selectedId]);

  async function refresh() {
    if (!centerId) return [] as BoUnscheduledCheckInRequest[];
    setLoad({ state: "loading" });
    const rows = await boApi.workforceCheckInExceptions(centerId, status === "ALL" ? undefined : status);
    setLoad({ state: "ready", rows });
    return rows;
  }

  function mutationKey(signature:string){if(!mutationAttempt.current||mutationAttempt.current.signature!==signature)mutationAttempt.current={signature,key:crypto.randomUUID()};return mutationAttempt.current.key}

  async function reconcileDetail(requestId:string,terminal:"APPROVED"|"DECLINED",successMessage:string,error:unknown){await refresh();try{const canonical=await boApi.workforceCheckInException(requestId);setDetail({state:"ready",row:canonical});if(canonical.status===terminal){mutationAttempt.current=null;setNotice(successMessage);return}setNotice(msg(error))}catch(readError){setNotice(msg(readError))}}

  const canonicalDetail = detail?.state === "ready" ? detail.row : null;

  async function approve(){if(!canonicalDetail||canonicalDetail.status!=="REQUESTED")return;const requestId=canonicalDetail.id,version=canonicalDetail.version,signature=`approve:${requestId}:${version}`;setBusy(true);setNotice("");try{await boApi.approveWorkforceCheckInException(requestId,version,mutationKey(signature));await reconcileDetail(requestId,"APPROVED","Đã duyệt. Core đã tạo assignment canonical cho nhân sự này.",new Error("Không thể xác nhận trạng thái duyệt."))}catch(error){await reconcileDetail(requestId,"APPROVED","Đã duyệt. Core đã tạo assignment canonical cho nhân sự này.",error)}finally{setBusy(false)}}
  async function decline(){if(!canonicalDetail||canonicalDetail.status!=="REQUESTED")return;const prompted=prompt("Lý do từ chối (có thể để trống)");if(prompted===null)return;const reason=prompted.trim()||null,requestId=canonicalDetail.id,version=canonicalDetail.version,signature=`decline:${requestId}:${version}:${reason??""}`;setBusy(true);setNotice("");try{await boApi.declineWorkforceCheckInException(requestId,version,reason,mutationKey(signature));await reconcileDetail(requestId,"DECLINED","Yêu cầu đã được từ chối; không có assignment nào được tạo.",new Error("Không thể xác nhận trạng thái từ chối."))}catch(error){await reconcileDetail(requestId,"DECLINED","Yêu cầu đã được từ chối; không có assignment nào được tạo.",error)}finally{setBusy(false)}}

  const rows = useMemo(() => load.state === "ready" ? load.rows : [], [load]);
  const filtered = useMemo(() => {
    const term = grid.state.search.trim().toLocaleLowerCase("vi");
    if (!term) return rows;
    return rows.filter((row) => `${row.staffDisplayLabel} ${row.staffMemberId} ${row.centerDisplayName} ${row.workDate} ${row.reason} ${row.id} ${row.status}`.toLocaleLowerCase("vi").includes(term));
  }, [grid.state.search, rows]);
  const sorted = useMemo(() => {
    const key = grid.state.sortKey ?? "requested";
    const direction = grid.state.sortDirection === "desc" ? -1 : 1;
    return [...filtered].sort((left, right) => direction * compareRows(left, right, key));
  }, [filtered, grid.state.sortDirection, grid.state.sortKey]);
  const range = boDataGridRange(grid.state.page, grid.state.pageSize, sorted.length);
  const visibleRows = sorted.slice((range.page - 1) * grid.state.pageSize, range.page * grid.state.pageSize);
  const columns = useMemo<BoDataGridColumn<BoUnscheduledCheckInRequest>[]>(() => [
    { key: "staff", header: "Staff", sortable: true, sticky: true, minWidth: 220, render: (row) => <div><strong>{row.staffDisplayLabel}</strong><BoDataGridCanonicalId value={row.staffMemberId} label={`Copy ${row.staffDisplayLabel} staff ID`} /></div> },
    { key: "workDate", header: "Center / date", sortable: true, minWidth: 190, render: (row) => <div><strong>{row.centerDisplayName}</strong><div>{formatDate(row.workDate)}</div></div> },
    { key: "reason", header: "Reason", sortable: true, minWidth: 300, render: (row) => row.reason },
    { key: "requested", header: "Requested", sortable: true, minWidth: 175, render: (row) => formatTime(row.requestedAt) },
    { key: "status", header: "Status", sortable: true, minWidth: 135, render: (row) => <BoDataGridStatus value={statusLabel(row.status)} tone={statusTone(row.status)} /> },
  ], []);

  return <main className={`${styles.page} ${styles.exceptionPage}`}>
    <header className={styles.heading}><span>Workforce · WFM-EXC</span><h1>Check-in Exceptions</h1><p>Review yêu cầu check-in ngoài lịch. Duyệt tạo một ca làm canonical; Timekeeping vẫn dùng flow check-in bình thường.</p></header>
    {notice ? <div className={styles.successCard}><strong>{notice}</strong></div> : null}
    <BoDataGrid
      rows={visibleRows}
      columns={columns}
      rowKey={(row) => row.id}
      caption="Check-in exception requests"
      state={load.state === "loading" ? "loading" : load.state === "error" ? "error" : "ready"}
      stateMessage={load.state === "error" ? load.message : undefined}
      search={grid.state.search}
      onSearchChange={grid.setSearch}
      searchPlaceholder="Tìm staff, reason, request ID…"
      sortKey={grid.state.sortKey ?? "requested"}
      sortDirection={grid.state.sortDirection}
      onSortChange={grid.setSort}
      filterChips={[
        ...(grid.state.filters.center ? [{ key: "center", label: "Center", value: centers.find((center) => center.id === centerId)?.displayName ?? centerId, onClear: () => grid.setFilter("center", null) }] : []),
        ...(status !== "ALL" ? [{ key: "status", label: "Status", value: statusLabel(status), onClear: () => grid.setFilter("status", null) }] : []),
      ]}
      resultLabel={`${sorted.length} / ${rows.length} requests`}
      onRefresh={() => void refresh().catch((error) => setLoad({ state: "error", message: msg(error) }))}
      selectedRowKey={selectedId}
      onRowOpen={busy ? undefined : (row) => selectRequest(row.id, "push")}
      emptyTitle="Không có check-in exception phù hợp"
      emptyMessage="Thử đổi Center, Status hoặc search. Core vẫn giữ canonical request/approval state."
      pagination={{ page: range.page, pageSize: grid.state.pageSize, total: sorted.length, pageSizeOptions: GRID_OPTIONS.allowedPageSizes, onPageChange: grid.setPage, onPageSizeChange: grid.setPageSize }}
      toolbarActions={<div className={styles.exceptionFilters}>
        <label className={styles.field}>Center<select aria-label="Filter check-in exceptions by center" value={centerId} disabled={busy || centers.length === 0} onChange={(event) => grid.setFilter("center", event.target.value || null)}>{centers.map((center) => <option key={center.id} value={center.id}>{center.displayName}</option>)}</select></label>
        <label className={styles.field}>Status<select aria-label="Filter check-in exceptions by status" value={status} disabled={busy} onChange={(event) => grid.setFilter("status", event.target.value === "ALL" ? null : event.target.value)}>{STATUS_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </div>}
    />

    {selectedId ? <BoDataGridSidePeek title={canonicalDetail?.staffDisplayLabel ?? "Check-in exception"} eyebrow="Workforce · Check-in exception" onClose={() => { if (!busy) selectRequest(null); }}>
      {detail?.state === "loading" ? <div className={styles.state}>Đang tải request canonical…</div> : null}
      {detail?.state === "error" ? <div className={`${styles.state} ${styles.errorState}`}>{detail.message}</div> : null}
      {canonicalDetail ? <div className={styles.exceptionSide}>
        <div><BoDataGridStatus value={statusLabel(canonicalDetail.status)} tone={statusTone(canonicalDetail.status)} /><h2>{canonicalDetail.staffDisplayLabel}</h2><p>{canonicalDetail.centerDisplayName} · {formatDate(canonicalDetail.workDate)}</p></div>
        <dl className={styles.exceptionFacts}>
          <div><dt>Lý do</dt><dd>{canonicalDetail.reason}</dd></div>
          <div><dt>Requested</dt><dd>{formatTime(canonicalDetail.requestedAt)}</dd></div>
          <div><dt>Version</dt><dd>{canonicalDetail.version}</dd></div>
          <div><dt>Request ID</dt><dd><BoDataGridCanonicalId value={canonicalDetail.id} label="Copy request ID" /></dd></div>
          <div><dt>Assignment</dt><dd>{canonicalDetail.generatedAssignmentId ? <BoDataGridCanonicalId value={canonicalDetail.generatedAssignmentId} label="Copy generated assignment ID" /> : "Chưa tạo"}</dd></div>
          {canonicalDetail.declineReason ? <div><dt>Lý do từ chối</dt><dd>{canonicalDetail.declineReason}</dd></div> : null}
        </dl>
        <div className={styles.exceptionNotice}>Approval tạo một StaffShiftAssignment canonical có provenance từ request này. Không có Manager override trực tiếp lên Timekeeping.</div>
        <div className={styles.exceptionActions}><button className={styles.primaryButton} disabled={busy || canonicalDetail.status !== "REQUESTED"} onClick={() => void approve()}>Approve & tạo assignment</button><button className={styles.secondaryButton} disabled={busy || canonicalDetail.status !== "REQUESTED"} onClick={() => void decline()}>Decline</button></div>
      </div> : null}
    </BoDataGridSidePeek> : null}
  </main>;
}

function compareRows(left: BoUnscheduledCheckInRequest, right: BoUnscheduledCheckInRequest, key: string) {
  if (key === "staff") return left.staffDisplayLabel.localeCompare(right.staffDisplayLabel) || left.id.localeCompare(right.id);
  if (key === "workDate") return left.workDate.localeCompare(right.workDate) || left.centerDisplayName.localeCompare(right.centerDisplayName) || left.id.localeCompare(right.id);
  if (key === "reason") return left.reason.localeCompare(right.reason) || left.requestedAt.localeCompare(right.requestedAt);
  if (key === "status") return left.status.localeCompare(right.status) || left.requestedAt.localeCompare(right.requestedAt);
  return left.requestedAt.localeCompare(right.requestedAt) || left.id.localeCompare(right.id);
}
function normalizeStatusFilter(value: string | undefined): FilterStatus { return value && STATUS_FILTERS.some((item) => item.value === value) ? value as FilterStatus : "ALL"; }
function statusLabel(status: BoUnscheduledCheckInRequest["status"]) { return ({ REQUESTED: "Chờ duyệt", APPROVED: "Đã duyệt", DECLINED: "Đã từ chối", CANCELLED: "Đã hủy" } as const)[status]; }
function statusTone(status: BoUnscheduledCheckInRequest["status"]): "success" | "warning" | "danger" | "neutral" { return status === "APPROVED" ? "success" : status === "REQUESTED" ? "warning" : status === "DECLINED" ? "danger" : "neutral"; }
function formatTime(value: string) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }
function formatDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(`${value}T00:00:00+07:00`)); }
function msg(error:unknown){return error instanceof BoApiError?error.message:error instanceof Error?error.message:"Không thể tải dữ liệu từ Core."}
