"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { boApi, BoApiError, type BoAcquisitionCenter, type BoAcquisitionCreateInput, type BoAcquisitionIntent, type BoAcquisitionIntentStatus } from "@/lib/bo-api";
import styles from "./sales-leads.module.css";

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };
type CommandAttempt = { key: string; idempotencyKey: string; action: (key: string) => Promise<unknown>; success: string };
type CreateAttempt = { idempotencyKey: string; input: BoAcquisitionCreateInput };
type CreateDraft = { centerId: string; phone: string; sourceBrand: BoAcquisitionCreateInput["sourceBrand"]; intentKind: BoAcquisitionCreateInput["intentKind"]; childAge: string };
type FilterStatus = "ALL" | BoAcquisitionIntentStatus;

const EMPTY_CREATE_DRAFT: CreateDraft = { centerId: "", phone: "", sourceBrand: "PINO_HOUSE", intentKind: "GENERAL_INQUIRY", childAge: "" };

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
  const [centers, setCenters] = useState<Load<BoAcquisitionCenter[]>>({ state: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Load<BoAcquisitionIntent> | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [createDraft, setCreateDraft] = useState<CreateDraft>(EMPTY_CREATE_DRAFT);
  const [createAttempt, setCreateAttempt] = useState<CreateAttempt | null>(null);
  const [createState, setCreateState] = useState<{ busy: boolean; notice: string | null; error: string | null }>({ busy: false, notice: null, error: null });
  const [commandState, setCommandState] = useState<{ busy: string | null; notice: string | null; error: string | null }>({ busy: null, notice: null, error: null });
  const [pendingAttempt, setPendingAttempt] = useState<CommandAttempt | null>(null);
  const selectionToken = useRef(0);
  const selectedIdRef = useRef<string | null>(null);
  const createSelectionRef = useRef<string | null>(null);

  async function loadQueue(preferId?: string | null, filterStatus: FilterStatus = status) {
    const rows = await boApi.acquisitionIntents(filterStatus === "ALL" ? undefined : filterStatus);
    setQueue({ state: "ready", data: rows });
    const preferred = preferId ?? selectedIdRef.current;
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
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  useEffect(() => {
    let active = true;
    void boApi.acquisitionCenters().then((items) => {
      if (!active) return;
      setCenters({ state: "ready", data: items });
      setCreateDraft((draft) => draft.centerId || !items[0] ? draft : { ...draft, centerId: items[0].id });
    }).catch((error: unknown) => {
      if (active) setCenters({ state: "error", message: message(error) });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setQueue({ state: "loading" });
    void boApi.acquisitionIntents(status === "ALL" ? undefined : status).then((rows) => {
      if (!active) return;
      setQueue({ state: "ready", data: rows });
      const preferred = createSelectionRef.current;
      const currentSelectedId = selectedIdRef.current;
      const next = preferred && rows.some((row) => row.id === preferred) ? preferred : currentSelectedId && rows.some((row) => row.id === currentSelectedId) ? currentSelectedId : rows[0]?.id ?? null;
      setSelectedId(next);
      if (preferred && next === preferred) createSelectionRef.current = null;
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
      createSelectionRef.current = result.intentId;
      setStatus("ALL");
      setQuery("");
      const next = await loadQueue(result.intentId, "ALL");
      if (status === "ALL") createSelectionRef.current = null;
      if (next === result.intentId) await loadDetail(result.intentId);
      setCreateAttempt(null);
      setCreateDraft({ ...EMPTY_CREATE_DRAFT, centerId: attempt.input.centerId });
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
    if (!createDraft.centerId) {
      setCreateState({ busy: false, notice: null, error: "Center là bắt buộc." });
      return;
    }
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
      input: { centerId: createDraft.centerId, phone, sourceBrand: createDraft.sourceBrand, intentKind: createDraft.intentKind, childAge },
    };
    setCreateAttempt(attempt);
    void executeCreate(attempt);
  }

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
          <label>
            <span>Center</span>
            <select aria-label="Center Lead" value={createDraft.centerId} onChange={(event) => updateCreateDraft({ centerId: event.target.value })} disabled={blocked || centers.state !== "ready"}>
              <option value="">Chọn Center…</option>
              {centers.state === "ready" ? centers.data.map((center) => <option key={center.id} value={center.id}>{center.displayName}</option>) : null}
            </select>
          </label>
          <label>
            <span>Số điện thoại</span>
            <input aria-label="Số điện thoại Lead" autoComplete="tel" inputMode="tel" required placeholder="09…" value={createDraft.phone} onChange={(event) => updateCreateDraft({ phone: event.target.value })} disabled={blocked} />
          </label>
          <label>
            <span>Thương hiệu</span>
            <select aria-label="Thương hiệu Lead" value={createDraft.sourceBrand} onChange={(event) => updateCreateDraft({ sourceBrand: event.target.value as CreateDraft["sourceBrand"] })} disabled={blocked}>
              <option value="PINO_HOUSE">PINO House</option>
              <option value="TOPPI">Toppi</option>
            </select>
          </label>
          <label>
            <span>Nhu cầu</span>
            <select aria-label="Nhu cầu Lead" value={createDraft.intentKind} onChange={(event) => updateCreateDraft({ intentKind: event.target.value as CreateDraft["intentKind"] })} disabled={blocked}>
              <option value="GENERAL_INQUIRY">Tư vấn chung</option>
              <option value="PROGRAM_INTEREST">Quan tâm chương trình</option>
              <option value="OPEN_STUDIO">Open Studio</option>
            </select>
          </label>
          <label>
            <span>Tuổi bé</span>
            <input aria-label="Tuổi bé của Lead" type="number" min={2} max={17} placeholder="Không bắt buộc" value={createDraft.childAge} onChange={(event) => updateCreateDraft({ childAge: event.target.value })} disabled={blocked} />
          </label>
          <button type="submit" disabled={blocked || !createDraft.centerId || !createDraft.phone.trim()}>{createState.busy ? "Đang tạo…" : "Tạo Lead"}</button>
        </div>
        {centers.state === "error" ? <p className={styles.error}>{centers.message}</p> : null}
        {createAttempt && createState.error ? <button className={styles.retry} type="button" onClick={() => void executeCreate(createAttempt)} disabled={createState.busy || Boolean(commandState.busy)}>Thử lại tạo Lead</button> : null}
        {createState.notice ? <p className={styles.notice}>{createState.notice}</p> : null}
        {createState.error ? <p className={styles.error}>{createState.error}</p> : null}
      </form>

      <div className={styles.filters}>
        <div className={styles.statusFilters}>
          {FILTERS.map((item) => <button key={item.value} type="button" className={status === item.value ? styles.filterActive : ""} onClick={() => setStatus(item.value)} disabled={blocked}>{item.label}</button>)}
        </div>
        <input aria-label="Tìm lead" placeholder="Tìm số điện thoại, nguồn, nhu cầu…" value={query} onChange={(event) => setQuery(event.target.value)} disabled={blocked} />
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
              <Fact label="Center" value={centerLabel(intent.centerId, centers)} />
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
function centerLabel(centerId: string | null, centers: Load<BoAcquisitionCenter[]>) {
  if (!centerId) return "Chưa gán · Founder only";
  return centers.state === "ready" ? centers.data.find((center) => center.id === centerId)?.displayName ?? centerId : centerId;
}
function sourceLabel(source: BoAcquisitionIntent["sourceBrand"]) { return source === "PINO_HOUSE" ? "PINO House" : "Toppi"; }
function intentLabel(kind: BoAcquisitionIntent["intentKind"]) { return ({ OPEN_STUDIO: "Open Studio", PROGRAM_INTEREST: "Quan tâm chương trình", GENERAL_INQUIRY: "Tư vấn chung" } as const)[kind]; }
function formatTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "—";
}
function message(error: unknown) { return error instanceof Error ? error.message : "Không thể hoàn tất yêu cầu."; }
