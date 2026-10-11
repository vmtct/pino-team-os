"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BoDataGrid,
  BoDataGridCanonicalId,
  BoDataGridSidePeek,
  BoDataGridStatus,
  useBoDataGridUrlState,
  type BoDataGridColumn,
} from "@/app/bo/components/data-grid";
import { boApi, type BoAccessAuditPage } from "@/lib/bo-api";
import type { BoAccessAuditEvent } from "@/lib/bo-access-model";
import styles from "../../bo.module.css";

const PAGE_SIZES = [10, 25, 50, 100] as const;

export function AccessAuditView() {
  const [result, setResult] = useState<BoAccessAuditPage>({
    events: [],
    page: { limit: 25, offset: 0, total: 0, page: 1, pageCount: 0, hasPrevious: false, hasNext: false },
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const { state, setSearch, setPage, setPageSize, setFilter } = useBoDataGridUrlState({
    defaultPageSize: 25,
    allowedPageSizes: PAGE_SIZES,
  });
  const outcome = state.filters.outcome ?? "";

  const refresh = useCallback(() => setRefreshToken((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void boApi.accessAuditPage({
      limit: state.pageSize,
      offset: (state.page - 1) * state.pageSize,
      ...(state.search ? { query: state.search } : {}),
      ...(outcome ? { outcome } : {}),
    }).then((data) => {
      if (!active) return;
      setResult(data);
      setError("");
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không thể tải Access audit.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [outcome, refreshToken, state.page, state.pageSize, state.search]);

  const selected = result.events.find((event) => event.id === selectedId) ?? null;
  const columns = useMemo<BoDataGridColumn<BoAccessAuditEvent>[]>(() => [
    {
      key: "action",
      header: "Event",
      sticky: true,
      minWidth: 235,
      render: (event) => <span><strong>{event.action}</strong><BoDataGridCanonicalId value={event.id} label="Copy audit event ID" /></span>,
    },
    {
      key: "time",
      header: "Time / Result",
      minWidth: 170,
      render: (event) => <span><strong>{new Date(event.occurredAt).toLocaleString("vi-VN")}</strong><br /><BoDataGridStatus value={event.outcome} tone={outcomeTone(event.outcome)} /></span>,
    },
    { key: "actor", header: "Actor", minWidth: 200, render: (event) => <span>{event.actorType}<br /><code>{event.actorId ?? "system"}</code></span> },
    { key: "target", header: "Target", minWidth: 220, render: (event) => <span>{event.subjectType}<br /><code>{event.subjectId ?? "n/a"}</code></span> },
    { key: "request", header: "Request ID", minWidth: 210, render: (event) => <BoDataGridCanonicalId value={event.requestId} label="Copy request ID" /> },
  ], []);

  const filtered = Boolean(state.search || outcome);
  return <section className={styles.page}>
    <header className={styles.heading}>
      <span>PINO TEAM · SYSTEM</span>
      <h1>Audit</h1>
      <p>Privileged Access administration history · canonical newest-first server projection.</p>
    </header>

    <BoDataGrid
      rows={result.events}
      columns={columns}
      rowKey={(event) => event.id}
      caption="Access audit events"
      state={loading ? "loading" : error ? "error" : "ready"}
      stateMessage={error || undefined}
      search={state.search}
      onSearchChange={setSearch}
      searchPlaceholder="Search event, request, actor or target…"
      filterChips={outcome ? [{ key: "outcome", label: "Result", value: outcome, onClear: () => setFilter("outcome", null) }] : []}
      toolbarActions={<label className={styles.gridToolbarFilter}>Result<select aria-label="Filter Audit by result" value={outcome} onChange={(event) => setFilter("outcome", event.target.value || null)}><option value="">All</option><option value="succeeded">Succeeded</option><option value="failed">Failed</option><option value="denied">Denied</option></select></label>}
      onRefresh={refresh}
      resultLabel={`${result.page.total} Access events · newest first`}
      pagination={{
        page: state.page,
        pageSize: state.pageSize,
        total: result.page.total,
        pageSizeOptions: PAGE_SIZES,
        onPageChange: setPage,
        onPageSizeChange: setPageSize,
      }}
      selectedRowKey={selectedId}
      onRowOpen={(event) => setSelectedId(event.id)}
      emptyTitle={filtered ? "No matching audit events" : "No Access audit events"}
      emptyMessage={filtered ? "Adjust the server-side search or result filter." : "Core has not returned any canonical ACCESS_* audit events."}
    />

    {selected ? <AuditEventSidePeek event={selected} onClose={() => setSelectedId(null)} /> : null}
  </section>;
}

function AuditEventSidePeek({ event, onClose }: { event: BoAccessAuditEvent; onClose: () => void }) {
  return <BoDataGridSidePeek title={event.action} eyebrow={new Date(event.occurredAt).toLocaleString("vi-VN")} onClose={onClose}>
    <dl className={styles.auditDetailList}>
      <div><dt>Result</dt><dd><BoDataGridStatus value={event.outcome} tone={outcomeTone(event.outcome)} /></dd></div>
      <div><dt>Event ID</dt><dd><BoDataGridCanonicalId value={event.id} /></dd></div>
      <div><dt>Request ID</dt><dd><BoDataGridCanonicalId value={event.requestId} /></dd></div>
      <div><dt>Actor</dt><dd><code>{event.actorType}:{event.actorId ?? "system"}</code></dd></div>
      <div><dt>Target</dt><dd><code>{event.subjectType}:{event.subjectId ?? "n/a"}</code></dd></div>
    </dl>
    <section className={styles.auditPayload}><span>PROVENANCE PAYLOAD</span><pre>{JSON.stringify(event.payload, null, 2)}</pre></section>
  </BoDataGridSidePeek>;
}

function outcomeTone(outcome: string): "success" | "neutral" | "warning" | "danger" {
  if (outcome === "succeeded") return "success";
  if (outcome === "denied") return "warning";
  if (outcome === "failed") return "danger";
  return "neutral";
}
