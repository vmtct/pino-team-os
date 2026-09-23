"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { boApi, BoApiError, type BoAcquisitionIntent, type BoAcquisitionIntentStatus } from "@/lib/bo-api";
import styles from "./sales-leads.module.css";

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };
type CommandAttempt = { key: string; idempotencyKey: string; action: (key: string) => Promise<unknown>; success: string };
type FilterStatus = "ALL" | BoAcquisitionIntentStatus;

const FILTERS: Array<{ value: FilterStatus; label: string }> = [
  { value: "ALL", label: "Tất cả" },
  { value: "SUBMITTED", label: "Mới" },
  { value: "CONTACTED", label: "Đã liên hệ" },
  { value: "CONTACT_VERIFIED", label: "Đã xác minh" },
  { value: "CLOSED", label: "Đã đóng" },
];

export function SalesLeadPipelineView() {
  const [status, setStatus] = useState<FilterStatus>("ALL");
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState<Load<BoAcquisitionIntent[]>>({ state: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Load<BoAcquisitionIntent> | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [commandState, setCommandState] = useState<{ busy: string | null; notice: string | null; error: string | null }>({ busy: null, notice: null, error: null });
  const [pendingAttempt, setPendingAttempt] = useState<CommandAttempt | null>(null);
  const selectionToken = useRef(0);

  async function loadQueue(preferId?: string | null) {
    const rows = await boApi.acquisitionIntents(status === "ALL" ? undefined : status);
    setQueue({ state: "ready", data: rows });
    const preferred = preferId ?? selectedId;
    const next = preferred && rows.some((row) => row.id === preferred) ? preferred : rows[0]?.id ?? null;
    setSelectedId(next);
    if (!next) setDetail(null);
    return next;
  }

  async function loadDetail(intentId: string) {
    const token = ++selectionToken.current;
    setDetail({ state: "loading" });
    try {
      const data = await boApi.acquisitionIntent(intentId);
      if (token === selectionToken.current) setDetail({ state: "ready", data });
    } catch (error) {
      if (token === selectionToken.current) setDetail({ state: "error", message: message(error) });
    }
  }
  useEffect(() => {
    let active = true;
    setQueue({ state: "loading" });
    void boApi.acquisitionIntents(status === "ALL" ? undefined : status).then((rows) => {
      if (!active) return;
      setQueue({ state: "ready", data: rows });
      const next = rows.some((row) => row.id === selectedId) ? selectedId : rows[0]?.id ?? null;
      setSelectedId(next);
      if (!next) setDetail(null);
    }).catch((error: unknown) => {
      if (active) setQueue({ state: "error", message: message(error) });
    });
    return () => { active = false; };
  }, [status]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId]);

  const rows = useMemo(() => queue.state === "ready" ? queue.data : [], [queue]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("vi");
    if (!term) return rows;
    return rows.filter((row) => `${row.phone} ${row.sourceBrand} ${row.intentKind}`.toLocaleLowerCase("vi").includes(term));
  }, [query, rows]);
  async function executeAttempt(attempt: CommandAttempt, intentId: string) {
    if (commandState.busy) return;
    setCommandState({ busy: attempt.key, notice: null, error: null });
    try {
      await attempt.action(attempt.idempotencyKey);
      const next = await loadQueue(intentId);
      if (next === intentId) await loadDetail(intentId);
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
    const attempt = pendingAttempt?.key === key ? pendingAttempt : { key, idempotencyKey: crypto.randomUUID(), action, success };
    setPendingAttempt(attempt);
    void executeAttempt(attempt, intent.id);
  }

  const intent = detail?.state === "ready" ? detail.data : null;
  const blocked = Boolean(commandState.busy || pendingAttempt);
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <span>Sales · PLT-SALES F0</span>
          <h1>Lead pipeline</h1>
          <p>Queue trên canonical Acquisition Lead/Intent. PAP chỉ trình bày và gửi command; Core giữ lifecycle và authorization.</p>
        </div>
        <div className={styles.permission}>acquisition.lead.manage</div>
      </header>

      <div className={styles.filters}>
        <div className={styles.statusFilters}>
          {FILTERS.map((item) => <button key={item.value} type="button" className={status === item.value ? styles.filterActive : ""} onClick={() => setStatus(item.value)} disabled={blocked}>{item.label}</button>)}
        </div>
        <input aria-label="Tìm lead" placeholder="Tìm số điện thoại, nguồn, nhu cầu…" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      <section className={styles.workspace}>
        <aside className={styles.queue}>
          <div className={styles.queueHead}><strong>Lead intents</strong><span>{filtered.length}</span></div>
          {queue.state === "loading" ? <State text="Đang tải lead…" /> : null}
          {queue.state === "error" ? <State text={queue.message} error /> : null}
          {queue.state === "ready" && filtered.length === 0 ? <State text="Không có lead phù hợp." /> : null}
          {filtered.map((row) => (
            <button key={row.id} type="button" className={`${styles.leadCard} ${selectedId === row.id ? styles.leadCardActive : ""}`} onClick={() => {
              if (!blocked) { selectionToken.current += 1; setSelectedId(row.id); setCommandState({ busy: null, notice: null, error: null }); }
            }} disabled={blocked}>
              <div><strong>{row.phone}</strong><Status status={row.status} /></div>
              <span>{sourceLabel(row.sourceBrand)} · {intentLabel(row.intentKind)}</span>
              <small>{formatTime(row.createdAt)}</small>
            </button>
          ))}
        </aside>

        <article className={styles.detail}>
          {!selectedId ? <State text="Chọn một lead để xem chi tiết." /> : null}
          {detail?.state === "loading" ? <State text="Đang tải chi tiết…" /> : null}
          {detail?.state === "error" ? <State text={detail.message} error /> : null}
          {intent ? <>
            <div className={styles.detailHead}>
              <div><span>Lead</span><h2>{intent.phone}</h2></div>
              <Status status={intent.status} />
            </div>
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
              {intent.status !== "CLOSED" ? <div className={styles.closeComposer}>
                <input aria-label="Lý do đóng lead" placeholder="Lý do đóng…" value={closeReason} onChange={(event) => setCloseReason(event.target.value)} disabled={blocked} />
                <button type="button" className={styles.danger} onClick={() => runCommand(`close:${intent.id}:${intent.version}:${closeReason.trim()}`, intent, (key) => boApi.closeAcquisitionIntent(intent.id, intent.version, closeReason.trim(), key), "Đã đóng intent.")} disabled={blocked || !closeReason.trim()}>Đóng intent</button>
              </div> : null}
            </div>
            {pendingAttempt && commandState.error ? <button className={styles.retry} type="button" onClick={() => void executeAttempt(pendingAttempt, intent.id)} disabled={Boolean(commandState.busy)}>Thử lại cùng yêu cầu</button> : null}
            {commandState.notice ? <p className={styles.notice}>{commandState.notice}</p> : null}
            {commandState.error ? <p className={styles.error}>{commandState.error}</p> : null}
          </> : null}
        </article>
      </section>
    </main>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><span>{label}</span><strong className={mono ? styles.mono : ""}>{value}</strong></div>;
}
function State({ text, error = false }: { text: string; error?: boolean }) {
  return <div className={`${styles.state} ${error ? styles.stateError : ""}`}>{text}</div>;
}
function Status({ status }: { status: BoAcquisitionIntentStatus }) {
  return <span className={`${styles.status} ${styles[`status${status}`]}`}>{statusLabel(status)}</span>;
}
function statusLabel(status: BoAcquisitionIntentStatus) {
  return ({ SUBMITTED: "Mới", CONTACTED: "Đã liên hệ", CONTACT_VERIFIED: "Đã xác minh", CLOSED: "Đã đóng" } as const)[status];
}
function sourceLabel(source: BoAcquisitionIntent["sourceBrand"]) { return source === "PINO_HOUSE" ? "PINO House" : "Toppi"; }
function intentLabel(kind: BoAcquisitionIntent["intentKind"]) { return ({ OPEN_STUDIO: "Open Studio", PROGRAM_INTEREST: "Quan tâm chương trình", GENERAL_INQUIRY: "Tư vấn chung" } as const)[kind]; }
function formatTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "—";
}
function message(error: unknown) { return error instanceof Error ? error.message : "Không thể hoàn tất yêu cầu."; }
