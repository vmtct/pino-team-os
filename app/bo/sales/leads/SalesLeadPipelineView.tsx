"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BoDataGrid, BoDataGridCanonicalId, BoDataGridSidePeek, BoDataGridStatus, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import { useBoDataGridUrlState } from "@/app/bo/components/data-grid/useBoDataGridUrlState";
import { boApi, BoApiError, type BoAcquisitionCreateInput, type BoAcquisitionIntent, type BoAcquisitionIntentStatus } from "@/lib/bo-api";
import { boDataGridRange } from "@/lib/bo-data-grid-state";
import { isIntentDetailCurrent, resolveActionBoundIntentId, shouldRestoreActionBoundIntent } from "@/lib/bo-lead-action-binding";
import styles from "./sales-leads.module.css";

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };
type DetailLoad = { state: "loading"; intentId: string } | { state: "error"; intentId: string; message: string } | { state: "ready"; intentId: string; data: BoAcquisitionIntent };
type CommandAttempt = { key: string; intentId: string; idempotencyKey: string; action: (key: string) => Promise<unknown>; success: string };
type CreateAttempt = { idempotencyKey: string; input: BoAcquisitionCreateInput };
type CreateDraft = { phone: string; sourceBrand: BoAcquisitionCreateInput["sourceBrand"]; intentKind: BoAcquisitionCreateInput["intentKind"]; childAge: string };
type FilterStatus = "ALL" | BoAcquisitionIntentStatus;

const EMPTY_CREATE_DRAFT: CreateDraft = { phone: "", sourceBrand: "PINO_HOUSE", intentKind: "GENERAL_INQUIRY", childAge: "" };
const LEAD_GRID_OPTIONS = { defaultPageSize: 25, allowedPageSizes: [10, 25, 50, 100] as const };

const FILTERS: Array<{ value: FilterStatus; label: string }> = [
  { value: "ALL", label: "Tất cả" },
  { value: "SUBMITTED", label: "Mới" },
  { value: "CONTACTED", label: "Đã liên hệ" },
  { value: "CONTACT_VERIFIED", label: "Đã xác minh" },
  { value: "CLOSED", label: "Đã đóng" },
];

export function SalesLeadPipelineView() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const grid = useBoDataGridUrlState(LEAD_GRID_OPTIONS);
  const selectedId = searchParams.get("leadIntent");
  const status = normalizeStatusFilter(grid.state.filters.status);
  const query = grid.state.search;
  const [queue, setQueue] = useState<Load<BoAcquisitionIntent[]>>({ state: "loading" });
  const [detail, setDetail] = useState<DetailLoad | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [createDraft, setCreateDraft] = useState<CreateDraft>(EMPTY_CREATE_DRAFT);
  const [createAttempt, setCreateAttempt] = useState<CreateAttempt | null>(null);
  const [createState, setCreateState] = useState<{ busy: boolean; notice: string | null; error: string | null }>({ busy: false, notice: null, error: null });
  const [commandState, setCommandState] = useState<{ busy: string | null; notice: string | null; error: string | null }>({ busy: null, notice: null, error: null });
  const [pendingAttempt, setPendingAttempt] = useState<CommandAttempt | null>(null);
  const actionLockedIntentId = pendingAttempt?.intentId ?? null;
  const effectiveSelectedId = resolveActionBoundIntentId(selectedId, actionLockedIntentId);
  const selectionToken = useRef(0);
  const selectedIdRef = useRef<string | null>(null);

  function setStatus(next: FilterStatus) { grid.setFilter("status", next === "ALL" ? null : next); }
  function setQuery(next: string) { grid.setSearch(next); }

  function selectIntent(nextId: string | null, history: "push" | "replace" = "replace") {
    if (pendingAttempt && nextId !== pendingAttempt.intentId) return;
    selectionToken.current += 1;
    selectedIdRef.current = nextId;
    const params = new URLSearchParams(searchParams.toString());
    if (nextId) params.set("leadIntent", nextId);
    else params.delete("leadIntent");
    const nextQuery = params.toString();
    const href = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    if (history === "push") router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
    if (!nextId) setDetail(null);
    setCloseReason("");
    setCommandState({ busy: null, notice: null, error: null });
  }

  function selectCreatedIntent(nextId: string) {
    selectionToken.current += 1;
    selectedIdRef.current = nextId;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("f_status");
    params.delete("page");
    params.set("leadIntent", nextId);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    setCloseReason("");
    setCommandState({ busy: null, notice: null, error: null });
  }

  async function loadQueue(preferId?: string | null, filterStatus: FilterStatus = status) {
    const rows = await boApi.acquisitionIntents(filterStatus === "ALL" ? undefined : filterStatus);
    setQueue({ state: "ready", data: rows });
    return preferId && rows.some((row) => row.id === preferId) ? preferId : null;
  }

  async function loadDetail(intentId: string) {
    const token = ++selectionToken.current;
    setDetail({ state: "loading", intentId });
    try {
      const data = await boApi.acquisitionIntent(intentId);
      if (token === selectionToken.current) setDetail({ state: "ready", intentId, data });
    } catch (error) {
      if (token === selectionToken.current) setDetail({ state: "error", intentId, message: message(error) });
    }
  }

  useEffect(() => { selectedIdRef.current = effectiveSelectedId; }, [effectiveSelectedId]);

  useEffect(() => {
    if (!shouldRestoreActionBoundIntent(selectedId, actionLockedIntentId) || !actionLockedIntentId) return;
    selectionToken.current += 1;
    selectedIdRef.current = actionLockedIntentId;
    const params = new URLSearchParams(searchParams.toString());
    params.set("leadIntent", actionLockedIntentId);
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [actionLockedIntentId, pathname, router, searchParams, selectedId]);

  useEffect(() => {
    let active = true;
    setQueue({ state: "loading" });
    void boApi.acquisitionIntents(status === "ALL" ? undefined : status).then((rows) => {
      if (!active) return;
      setQueue({ state: "ready", data: rows });
      const currentSelectedId = selectedIdRef.current;
      if (currentSelectedId && !rows.some((row) => row.id === currentSelectedId)) selectIntent(null);
    }).catch((error: unknown) => {
      if (active) setQueue({ state: "error", message: message(error) });
    });
    return () => { active = false; };
  }, [status]);

  useEffect(() => {
    if (effectiveSelectedId) void loadDetail(effectiveSelectedId);
    else setDetail(null);
  }, [effectiveSelectedId]);

  const rows = useMemo(() => queue.state === "ready" ? queue.data : [], [queue]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("vi");
    if (!term) return rows;
    return rows.filter((row) => `${row.phone} ${row.id} ${row.leadId} ${row.sourceBrand} ${row.sourceSurface} ${row.intentKind} ${row.childAge ?? ""} ${row.status}`.toLocaleLowerCase("vi").includes(term));
  }, [query, rows]);
  const sorted = useMemo(() => {
    const key = grid.state.sortKey ?? "updated";
    const direction = grid.state.sortDirection === "desc" ? -1 : 1;
    return [...filtered].sort((left, right) => direction * compareLeadRows(left, right, key));
  }, [filtered, grid.state.sortDirection, grid.state.sortKey]);
  const range = boDataGridRange(grid.state.page, grid.state.pageSize, sorted.length);
  const visibleRows = sorted.slice((range.page - 1) * grid.state.pageSize, range.page * grid.state.pageSize);
  const columns = useMemo<BoDataGridColumn<BoAcquisitionIntent>[]>(() => [
    { key: "contact", header: "Lead / contact", sortable: true, sticky: true, minWidth: 220, render: (row) => <div className={styles.leadGridIdentity}><strong>{row.phone}</strong><BoDataGridCanonicalId value={row.id} label="Copy Intent ID" /></div> },
    { key: "source", header: "Source", sortable: true, minWidth: 160, render: (row) => <div className={styles.leadGridStack}><strong>{sourceLabel(row.sourceBrand)}</strong><small>{row.sourceSurface}</small></div> },
    { key: "intent", header: "Intent / age", sortable: true, minWidth: 180, render: (row) => <div className={styles.leadGridStack}><strong>{intentLabel(row.intentKind)}</strong><small>{row.childAge === null ? "Age —" : `Age ${row.childAge}`}</small></div> },
    { key: "status", header: "Lifecycle", sortable: true, minWidth: 150, render: (row) => <BoDataGridStatus value={statusLabel(row.status)} tone={statusTone(row.status)} /> },
    { key: "updated", header: "Updated", sortable: true, minWidth: 160, render: (row) => <div className={styles.leadGridStack}><strong>{formatTime(row.updatedAt)}</strong><small>Created {formatTime(row.createdAt)}</small></div> },
  ], []);

  function updateCreateDraft(patch: Partial<CreateDraft>) {
    setCreateDraft((current) => ({ ...current, ...patch }));
    setCreateAttempt(null);
    setCreateState({ busy: false, notice: null, error: null });
  }

  async function executeCreate(attempt: CreateAttempt) {
    if (createState.busy || commandState.busy || pendingAttempt) return;
    setCreateState({ busy: true, notice: null, error: null });
    try {
      const result = await boApi.createAcquisitionIntent(attempt.input, attempt.idempotencyKey);
      const next = await loadQueue(result.intentId, "ALL");
      if (next === result.intentId) {
        selectCreatedIntent(result.intentId);
        await loadDetail(result.intentId);
      }
      setCreateAttempt(null);
      setCreateDraft(EMPTY_CREATE_DRAFT);
      setCreateState({ busy: false, notice: "Đã tạo Lead.", error: null });
    } catch (error) {
      const definitive = error instanceof BoApiError && error.structuredResponse && error.status >= 400 && error.status < 500;
      if (definitive) setCreateAttempt(null);
      else setCreateAttempt(attempt);
      setCreateState({ busy: false, notice: null, error: message(error) });
    }
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createState.busy || commandState.busy || pendingAttempt) return;
    const phone = createDraft.phone.trim();
    const childAge = createDraft.childAge.trim() === "" ? null : Number(createDraft.childAge);
    if (!phone) {
      setCreateState({ busy: false, notice: null, error: "Số điện thoại là bắt buộc." });
      return;
    }
    if (childAge !== null && (!Number.isSafeInteger(childAge) || childAge < 2 || childAge > 17)) {
      setCreateState({ busy: false, notice: null, error: "Tuổi bé phải từ 2 đến 17." });
      return;
    }
    const attempt = createAttempt ?? {
      idempotencyKey: crypto.randomUUID(),
      input: { phone, sourceBrand: createDraft.sourceBrand, intentKind: createDraft.intentKind, childAge },
    };
    setCreateAttempt(attempt);
    void executeCreate(attempt);
  }

  async function executeAttempt(attempt: CommandAttempt) {
    if (commandState.busy) return;
    const intentId = attempt.intentId;
    setCommandState({ busy: attempt.key, notice: null, error: null });
    try {
      await attempt.action(attempt.idempotencyKey);
      const next = await loadQueue(intentId);
      if (next === intentId && selectedIdRef.current === intentId) await loadDetail(intentId);
      setPendingAttempt(null);
      setCloseReason("");
      setCommandState({ busy: null, notice: attempt.success, error: null });
    } catch (error) {
      const definitive = error instanceof BoApiError && error.structuredResponse && error.status >= 400 && error.status < 500;
      if (definitive) setPendingAttempt(null);
      else setPendingAttempt(attempt);
      setCommandState({ busy: null, notice: null, error: message(error) });
    }
  }

  function runCommand(key: string, intent: BoAcquisitionIntent, action: (idempotencyKey: string) => Promise<unknown>, success: string) {
    if (!isIntentDetailCurrent(effectiveSelectedId, intent.id)) return;
    const attempt = pendingAttempt?.key === key && pendingAttempt.intentId === intent.id
      ? pendingAttempt
      : { key, intentId: intent.id, idempotencyKey: crypto.randomUUID(), action, success };
    setPendingAttempt(attempt);
    void executeAttempt(attempt);
  }

  const detailIsCurrent = isIntentDetailCurrent(effectiveSelectedId, detail?.intentId ?? null);
  const intent = detailIsCurrent && detail?.state === "ready" ? detail.data : null;
  const blocked = Boolean(commandState.busy || pendingAttempt || createState.busy || createAttempt);
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <span>Sales · PLT-LEAD F1</span>
          <h1>Lead pipeline</h1>
          <p>Queue trên canonical Acquisition Lead/Intent. PAP chỉ trình bày và gửi command; Core giữ lifecycle và authorization.</p>
        </div>
        <div className={styles.permission}>acquisition.lead.manage</div>
      </header>

      <form className={styles.createPanel} onSubmit={submitCreate}>
        <div className={styles.createHead}>
          <div><strong>Tạo Lead</strong><span>Tạo Intent thủ công trên Lead canonical hiện hữu.</span></div>
          <span className={styles.staffSource}>Nguồn nhập: Staff</span>
        </div>
        <div className={styles.createGrid}>
          <label><span>Số điện thoại</span><input aria-label="Số điện thoại Lead" autoComplete="tel" inputMode="tel" required placeholder="09…" value={createDraft.phone} onChange={(event) => updateCreateDraft({ phone: event.target.value })} disabled={blocked} /></label>
          <label><span>Thương hiệu</span><select aria-label="Thương hiệu Lead" value={createDraft.sourceBrand} onChange={(event) => updateCreateDraft({ sourceBrand: event.target.value as CreateDraft["sourceBrand"] })} disabled={blocked}><option value="PINO_HOUSE">PINO House</option><option value="TOPPI">Toppi</option></select></label>
          <label><span>Nhu cầu</span><select aria-label="Nhu cầu Lead" value={createDraft.intentKind} onChange={(event) => updateCreateDraft({ intentKind: event.target.value as CreateDraft["intentKind"] })} disabled={blocked}><option value="GENERAL_INQUIRY">Tư vấn chung</option><option value="PROGRAM_INTEREST">Quan tâm chương trình</option><option value="OPEN_STUDIO">Open Studio</option></select></label>
          <label><span>Tuổi bé</span><input aria-label="Tuổi bé của Lead" type="number" min={2} max={17} placeholder="Không bắt buộc" value={createDraft.childAge} onChange={(event) => updateCreateDraft({ childAge: event.target.value })} disabled={blocked} /></label>
          <button type="submit" disabled={blocked || !createDraft.phone.trim()}>{createState.busy ? "Đang tạo…" : "Tạo Lead"}</button>
        </div>
        {createAttempt && createState.error ? <button className={styles.retry} type="button" onClick={() => void executeCreate(createAttempt)} disabled={createState.busy || Boolean(commandState.busy)}>Thử lại tạo Lead</button> : null}
        {createState.notice ? <p className={styles.notice}>{createState.notice}</p> : null}
        {createState.error ? <p className={styles.error}>{createState.error}</p> : null}
      </form>

      <BoDataGrid
        rows={visibleRows}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Lead intents"
        state={queue.state === "loading" ? "loading" : queue.state === "error" ? "error" : "ready"}
        stateMessage={queue.state === "error" ? queue.message : undefined}
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="Tìm số điện thoại, nguồn, nhu cầu, ID…"
        sortKey={grid.state.sortKey ?? "updated"}
        sortDirection={grid.state.sortDirection}
        onSortChange={grid.setSort}
        filterChips={status === "ALL" ? [] : [{ key: "status", label: "Lifecycle", value: statusLabel(status), onClear: () => setStatus("ALL") }]}
        resultLabel={`${sorted.length} / ${rows.length} intents`}
        selectedRowKey={effectiveSelectedId}
        onRowOpen={blocked ? undefined : (row) => selectIntent(row.id, "push")}
        emptyTitle="Không có Lead phù hợp"
        emptyMessage="Thử đổi search hoặc lifecycle filter; canonical Lead/Intent state không bị thay đổi."
        pagination={{ page: range.page, pageSize: grid.state.pageSize, total: sorted.length, pageSizeOptions: LEAD_GRID_OPTIONS.allowedPageSizes, onPageChange: grid.setPage, onPageSizeChange: grid.setPageSize }}
        toolbarActions={<label className={styles.leadGridFilter}>Lifecycle<select aria-label="Filter Leads by lifecycle" value={status} disabled={blocked} onChange={(event) => setStatus(event.target.value as FilterStatus)}>{FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}
      />

      {effectiveSelectedId ? <BoDataGridSidePeek title={intent?.phone ?? "Lead"} eyebrow="Sales · Lead Intent" onClose={() => { if (!blocked) selectIntent(null); }}>
        <div className={styles.leadGridPeek}>
          {!detailIsCurrent || detail?.state === "loading" ? <State text="Đang tải chi tiết…" /> : null}
          {detailIsCurrent && detail?.state === "error" ? <State text={detail.message} error /> : null}
          {intent ? <div className={styles.detail}>
            <div className={styles.detailHead}><div><span>Lead</span><h2>{intent.phone}</h2></div><Status status={intent.status} /></div>
            <div className={styles.facts}>
              <Fact label="Nguồn" value={`${sourceLabel(intent.sourceBrand)} · ${intent.sourceSurface}`} />
              <Fact label="Nhu cầu" value={intentLabel(intent.intentKind)} />
              <Fact label="Tuổi bé" value={intent.childAge === null ? "—" : String(intent.childAge)} />
              <Fact label="Phiên bản" value={`v${intent.version}`} />
              <Fact label="Tạo lúc" value={formatTime(intent.createdAt)} />
              <Fact label="Cập nhật" value={formatTime(intent.updatedAt)} />
              <Fact label="Xác minh" value={intent.verificationMethod ?? "—"} />
              <Fact label="Lead ID" value={intent.leadId} mono />
            </div>
            <div className={styles.pancakePanel}>
              <div><strong>Pancake</strong><span>Conversation vẫn ở Pancake; PAP chỉ giữ provider reference + deep link.</span></div>
              {(intent.pancakeConversations ?? []).length === 0 ? <p>Chưa có conversation binding.</p> : null}
              {(intent.pancakeConversations ?? []).map((conversation) => <div className={styles.pancakeConversation} key={conversation.id}><div><strong>{conversation.channelDisplayName}</strong><span>{conversation.channel} · <code>{conversation.refId}</code></span></div>{conversation.usable && conversation.providerDeepLink ? <a href={conversation.providerDeepLink} target="_blank" rel="noopener noreferrer">Chat trên Pancake ↗</a> : <span className={styles.chatUnavailable}>Chat unavailable</span>}</div>)}
            </div>
            <div className={styles.timeline}>
              <strong>Contact timeline</strong>
              <div><span>Submitted</span><time>{formatTime(intent.createdAt)}</time></div>
              <div><span>Contacted</span><time>{formatTime(intent.contactedAt)}</time></div>
              <div><span>Verified</span><time>{formatTime(intent.verifiedAt)}</time></div>
              <div><span>Closed</span><time>{formatTime(intent.closedAt)}</time></div>
              {intent.closeReason ? <p>Lý do đóng: {intent.closeReason}</p> : null}
            </div>
            <div className={styles.actions}>
              <div><strong>Lifecycle actions</strong><span>expectedVersion và transition rules luôn do Core quyết định.</span></div>
              <div className={styles.actionButtons}>
                {intent.status === "SUBMITTED" ? <button type="button" onClick={() => runCommand(`contacted:${intent.id}:${intent.version}`, intent, (key) => boApi.markAcquisitionContacted(intent.id, intent.version, key), "Đã đánh dấu liên hệ.")} disabled={blocked}>Đã liên hệ</button> : null}
                {intent.status === "SUBMITTED" || intent.status === "CONTACTED" ? <button type="button" onClick={() => runCommand(`verify:${intent.id}:${intent.version}`, intent, (key) => boApi.verifyAcquisitionContact(intent.id, intent.version, key), "Đã xác minh liên hệ.")} disabled={blocked}>Xác minh Zalo</button> : null}
              </div>
              {intent.status !== "CLOSED" ? <div className={styles.closeComposer}><input aria-label="Lý do đóng lead" placeholder="Lý do đóng…" value={closeReason} onChange={(event) => setCloseReason(event.target.value)} disabled={blocked} /><button type="button" className={styles.danger} onClick={() => runCommand(`close:${intent.id}:${intent.version}:${closeReason.trim()}`, intent, (key) => boApi.closeAcquisitionIntent(intent.id, intent.version, closeReason.trim(), key), "Đã đóng intent.")} disabled={blocked || !closeReason.trim()}>Đóng intent</button></div> : null}
            </div>
            {pendingAttempt && pendingAttempt.intentId === intent.id && commandState.error ? <button className={styles.retry} type="button" onClick={() => void executeAttempt(pendingAttempt)} disabled={Boolean(commandState.busy)}>Thử lại cùng yêu cầu</button> : null}
            {commandState.notice ? <p className={styles.notice}>{commandState.notice}</p> : null}
            {commandState.error ? <p className={styles.error}>{commandState.error}</p> : null}
          </div> : null}
        </div>
      </BoDataGridSidePeek> : null}
    </main>
  );
}

function compareLeadRows(left: BoAcquisitionIntent, right: BoAcquisitionIntent, key: string) {
  if (key === "contact") return left.phone.localeCompare(right.phone) || left.id.localeCompare(right.id);
  if (key === "source") return `${left.sourceBrand} ${left.sourceSurface}`.localeCompare(`${right.sourceBrand} ${right.sourceSurface}`) || left.phone.localeCompare(right.phone);
  if (key === "intent") return `${left.intentKind} ${left.childAge ?? 999}`.localeCompare(`${right.intentKind} ${right.childAge ?? 999}`) || left.phone.localeCompare(right.phone);
  if (key === "status") return left.status.localeCompare(right.status) || right.updatedAt.localeCompare(left.updatedAt);
  return left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id);
}
function normalizeStatusFilter(value: string | undefined): FilterStatus {
  return value && FILTERS.some((item) => item.value === value) ? value as FilterStatus : "ALL";
}
function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div><span>{label}</span><strong className={mono ? styles.mono : ""}>{value}</strong></div>; }
function State({ text, error = false }: { text: string; error?: boolean }) { return <div className={`${styles.state} ${error ? styles.stateError : ""}`}>{text}</div>; }
function Status({ status }: { status: BoAcquisitionIntentStatus }) { return <span className={`${styles.status} ${styles[`status${status}`]}`}>{statusLabel(status)}</span>; }
function statusTone(status: BoAcquisitionIntentStatus): "warning" | "info" | "success" | "neutral" { return status === "SUBMITTED" ? "warning" : status === "CONTACTED" ? "info" : status === "CONTACT_VERIFIED" ? "success" : "neutral"; }
function statusLabel(status: BoAcquisitionIntentStatus) { return ({ SUBMITTED: "Mới", CONTACTED: "Đã liên hệ", CONTACT_VERIFIED: "Đã xác minh", CLOSED: "Đã đóng" } as const)[status]; }
function sourceLabel(source: BoAcquisitionIntent["sourceBrand"]) { return source === "PINO_HOUSE" ? "PINO House" : "Toppi"; }
function intentLabel(kind: BoAcquisitionIntent["intentKind"]) { return ({ OPEN_STUDIO: "Open Studio", PROGRAM_INTEREST: "Quan tâm chương trình", GENERAL_INQUIRY: "Tư vấn chung" } as const)[kind]; }
function formatTime(value: string | null) { return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "—"; }
function message(error: unknown) { return error instanceof Error ? error.message : "Không thể hoàn tất yêu cầu."; }
