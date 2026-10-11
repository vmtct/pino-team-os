"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoDataGrid, BoDataGridBadge, BoDataGridCanonicalId, BoDataGridSidePeek, BoDataGridStatus, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import { useBoDataGridUrlState } from "@/app/bo/components/data-grid/useBoDataGridUrlState";
import { boApi } from "@/lib/bo-api";
import { loadBoTrainingAssignmentPageForState } from "@/lib/bo-training-assignment-page-controller";
import type { TrainingAssignmentBrowseItem, TrainingAssignmentBrowsePage, TrainingAssignmentBrowseSort } from "@/lib/training-model";
import styles from "../bo.module.css";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const SORT_KEYS: readonly TrainingAssignmentBrowseSort[] = ["staff", "training", "status", "assignedAt", "updatedAt"];
const EMPTY_PAGE: TrainingAssignmentBrowsePage = { items: [], page: { limit: 25, offset: 0, total: 0, page: 1, pageCount: 0, hasPrevious: false, hasNext: false } };

export function TrainingAssignmentsView() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const grid = useBoDataGridUrlState({ defaultPageSize: 25, allowedPageSizes: PAGE_SIZES });
  const selectedId = searchParams.get("trainingAssignment") ?? "";
  const [result, setResult] = useState<TrainingAssignmentBrowsePage>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const setPageRef = useRef(grid.setPage);
  setPageRef.current = grid.setPage;

  const status = ["ASSIGNED", "IN_PROGRESS", "COMPLETION_PENDING", "COMPLETED"].includes(grid.state.filters.status ?? "") ? grid.state.filters.status! : "";
  const sort = SORT_KEYS.includes(grid.state.sortKey as TrainingAssignmentBrowseSort) ? grid.state.sortKey as TrainingAssignmentBrowseSort : "updatedAt";
  const direction = grid.state.sortKey ? grid.state.sortDirection : "desc";
  const refresh = useCallback(() => setRefreshToken((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadBoTrainingAssignmentPageForState({ page: grid.state.page, pageSize: grid.state.pageSize, search: grid.state.search, status, sort, direction }, boApi.trainingAssignmentsPage)
      .then((next) => {
        if (!active) return;
        if (next.kind === "reconcile-page") { setPageRef.current(next.page); return; }
        setResult(next.data); setError("");
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không thể tải Training assignments."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [direction, grid.state.page, grid.state.pageSize, grid.state.search, refreshToken, sort, status]);

  const selected = result.items.find((item) => item.assignment.id === selectedId) ?? null;
  const columns = useMemo<BoDataGridColumn<TrainingAssignmentBrowseItem>[]>(() => [
    { key: "staff", header: "Staff", sortable: true, sticky: true, minWidth: 220, render: (item) => <div><strong>{item.staffDisplayLabel}</strong><BoDataGridCanonicalId value={item.assignment.staffMemberId} label="Copy Staff ID" /></div> },
    { key: "training", header: "Training / version", sortable: true, minWidth: 240, render: (item) => <div><strong>{item.version.title}</strong><small>{item.moduleKey} · v{item.version.versionNumber}</small></div> },
    { key: "status", header: "Assignment", sortable: true, minWidth: 165, render: (item) => <BoDataGridStatus value={item.assignment.status} tone={assignmentTone(item.assignment.status)} /> },
    { key: "assessment", header: "Assessment", minWidth: 155, render: (item) => item.latestAssessment ? <BoDataGridStatus value={`${item.latestAssessment.passed ? "Passed" : "Not passed"} · ${item.latestAssessment.score}`} tone={item.latestAssessment.passed ? "success" : "warning"} /> : <span>Not attempted</span> },
    { key: "signoff", header: "Sign-off", minWidth: 150, render: (item) => <BoDataGridStatus value={signOffLabel(item)} tone={signOffTone(item)} /> },
    { key: "assignedAt", header: "Assigned", sortable: true, minWidth: 175, render: (item) => new Date(item.assignment.assignedAt).toLocaleString("vi-VN") },
    { key: "updatedAt", header: "Updated", sortable: true, minWidth: 175, render: (item) => new Date(item.assignment.updatedAt).toLocaleString("vi-VN") },
  ], []);

  function selectAssignment(id: string, history: "push" | "replace" = "replace") {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("trainingAssignment", id); else params.delete("trainingAssignment");
    const query = params.toString(); const href = query ? `${pathname}?${query}` : pathname;
    if (history === "push") router.push(href, { scroll: false }); else router.replace(href, { scroll: false });
  }

  async function signOff(item: TrainingAssignmentBrowseItem) {
    if (item.assignment.status !== "COMPLETION_PENDING" || item.signOff) return;
    setBusy(item.assignment.id); setError("");
    try { await boApi.signOffTraining(item.assignment.id, "Reviewed from BO Training assignment detail"); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể sign-off Training."); }
    finally { setBusy(""); }
  }

  const filtered = Boolean(grid.state.search || status);
  return <section className={styles.page}>
    <header className={styles.heading}>
      <span>PINO TEAM · WORKFORCE</span>
      <h1>Training assignments</h1>
      <p>Grid-first assignment/sign-off browse. Module authoring remains a separate workflow; Core remains the only Training mutation authority.</p>
      <div><Link className={styles.secondaryButton} href="/bo/training/builder">Open Training Builder</Link></div>
    </header>
    {error ? <p className={styles.ownerError}>{error}</p> : null}
    <BoDataGrid
      rows={result.items}
      columns={columns}
      rowKey={(item) => item.assignment.id}
      caption="Training assignments and sign-off records"
      state={loading ? "loading" : error ? "error" : "ready"}
      stateMessage={error || undefined}
      search={grid.state.search}
      onSearchChange={grid.setSearch}
      searchPlaceholder="Search Staff, training, module key or Assignment ID…"
      sortKey={sort}
      sortDirection={direction}
      onSortChange={grid.setSort}
      filterChips={status ? [{ key: "status", label: "Status", value: status, onClear: () => grid.setFilter("status", null) }] : []}
      toolbarActions={<label className={styles.gridToolbarFilter}>Status<select aria-label="Filter Training assignments by status" value={status} onChange={(event) => grid.setFilter("status", event.target.value || null)}><option value="">All</option><option value="ASSIGNED">Assigned</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETION_PENDING">Completion pending</option><option value="COMPLETED">Completed</option></select></label>}
      onRefresh={refresh}
      resultLabel={`${result.page.total} assignments`}
      pagination={{ page: grid.state.page, pageSize: grid.state.pageSize, total: result.page.total, pageSizeOptions: PAGE_SIZES, onPageChange: grid.setPage, onPageSizeChange: grid.setPageSize }}
      selectedRowKey={selectedId || null}
      onRowOpen={(item) => selectAssignment(item.assignment.id, "push")}
      emptyTitle={filtered ? "No matching Training assignments" : "No Training assignments"}
      emptyMessage={filtered ? "Adjust the server-side search or status filter." : "Core has not returned any canonical Training assignment records."}
    />

    {selectedId ? <BoDataGridSidePeek title={selected?.staffDisplayLabel ?? "Training assignment"} eyebrow="Workforce · Training assignment" onClose={() => selectAssignment("")} footer={selected && selected.assignment.status === "COMPLETION_PENDING" && !selected.signOff ? <button className={styles.primaryButton} disabled={busy === selected.assignment.id} onClick={() => void signOff(selected)}>{busy === selected.assignment.id ? "Signing off…" : "Sign off"}</button> : undefined}>
      {!selected ? <section className={styles.panel}><p>This assignment is not on the current bounded page. Return to its page or clear filters.</p></section> : <div>
        <section className={styles.panel}><div className={styles.panelHeading}><div><h2>{selected.version.title}</h2><p>{selected.moduleKey} · version {selected.version.versionNumber}</p></div><BoDataGridStatus value={selected.assignment.status} tone={assignmentTone(selected.assignment.status)} /></div>
          <dl className={styles.auditDetailList}>
            <div><dt>Assignment ID</dt><dd><BoDataGridCanonicalId value={selected.assignment.id} /></dd></div>
            <div><dt>Staff</dt><dd>{selected.staffDisplayLabel}<br /><BoDataGridCanonicalId value={selected.assignment.staffMemberId} /></dd></div>
            <div><dt>Assigned</dt><dd>{new Date(selected.assignment.assignedAt).toLocaleString("vi-VN")}</dd></div>
            <div><dt>Due</dt><dd>{selected.assignment.dueDate ?? "No due date"}</dd></div>
            <div><dt>Reason</dt><dd>{selected.assignment.assignmentReason}</dd></div>
            <div><dt>Assessment</dt><dd>{selected.latestAssessment ? `${selected.latestAssessment.score} · ${selected.latestAssessment.passed ? "passed" : "not passed"}` : selected.version.assessmentThreshold === null ? "Not required" : `Pending · threshold ${selected.version.assessmentThreshold}`}</dd></div>
            <div><dt>Sign-off</dt><dd>{selected.signOff ? `${new Date(selected.signOff.signedOffAt).toLocaleString("vi-VN")} · ${selected.signOff.signedOffByUserId}` : signOffLabel(selected)}</dd></div>
            <div><dt>Completed</dt><dd>{selected.assignment.completedAt ? new Date(selected.assignment.completedAt).toLocaleString("vi-VN") : "Not completed"}</dd></div>
          </dl>
        </section>
        <section className={styles.panel}><div className={styles.panelHeading}><div><h2>Authority boundary</h2><p>Browse state is presentation only. Assignment and sign-off commands remain Core-authorized and idempotent.</p></div><BoDataGridBadge>CORE AUTHORITY</BoDataGridBadge></div></section>
      </div>}
    </BoDataGridSidePeek> : null}
  </section>;
}

function assignmentTone(status: string): "success" | "neutral" | "warning" | "info" {
  if (status === "COMPLETED") return "success";
  if (status === "COMPLETION_PENDING") return "warning";
  if (status === "IN_PROGRESS") return "info";
  return "neutral";
}
function signOffLabel(item: TrainingAssignmentBrowseItem) {
  if (item.signOff) return "Signed off";
  if (!item.version.requiresSignoff) return "Not required";
  if (item.assignment.status === "COMPLETION_PENDING") return "Pending";
  return "Required";
}
function signOffTone(item: TrainingAssignmentBrowseItem): "success" | "neutral" | "warning" {
  if (item.signOff) return "success";
  if (item.assignment.status === "COMPLETION_PENDING") return "warning";
  return "neutral";
}
