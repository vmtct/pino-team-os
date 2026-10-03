"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { boApi, BoApiError, type BoAcquisitionCrmCatalog, type BoAcquisitionIntent, type BoAcquisitionIntentStatus } from "@/lib/bo-api";
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
  const [crmCatalog, setCrmCatalog] = useState<Load<BoAcquisitionCrmCatalog>>({ state: "loading" });
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
    void boApi.acquisitionCrmCatalog().then((data) => setCrmCatalog({ state: "ready", data })).catch((error: unknown) => setCrmCatalog({ state: "error", message: message(error) }));
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId]);

  const rows = useMemo(() => queue.state === "ready" ? queue.data : [], [queue]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("vi");
    if (!term) return rows;
    return rows.filter((row) => `${row.phone ?? "pancake"} ${row.sourceBrand} ${row.sourceSurface} ${row.intentKind} ${row.crm.ownerDisplayLabel ?? ""} ${row.crm.pathProgramLabel ?? ""} ${row.crm.qualificationStatus}`.toLocaleLowerCase("vi").includes(term));
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
              <div><strong>{leadLabel(row)}</strong><Status status={row.status} /></div>
              <span>{sourceLabel(row.sourceBrand)} · {intentLabel(row.intentKind)} · {qualificationLabel(row.crm.qualificationStatus)}</span>
              <small>{row.crm.ownerDisplayLabel ?? "Chưa có owner"} · {followUpLabel(row.crm.followUpState, row.crm.nextFollowUpAt)}</small>
            </button>
          ))}
        </aside>

        <article className={styles.detail}>
          {!selectedId ? <State text="Chọn một lead để xem chi tiết." /> : null}
          {detail?.state === "loading" ? <State text="Đang tải chi tiết…" /> : null}
          {detail?.state === "error" ? <State text={detail.message} error /> : null}
          {intent ? <>
            <div className={styles.detailHead}>
              <div><span>Lead</span><h2>{leadLabel(intent)}</h2></div>
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
            {crmCatalog.state === "ready" ? <CrmPanel key={`${intent.id}:${intent.crm.version}:${intent.crmActivities?.length ?? 0}`} intent={intent} catalog={crmCatalog.data} blocked={blocked} runCommand={runCommand} /> : <State text={crmCatalog.state === "error" ? crmCatalog.message : "Đang tải CRM catalog…"} error={crmCatalog.state === "error"} />}
            <div className={styles.pancakePanel}>
              <div><strong>Pancake</strong><span>Conversation vẫn ở Pancake; PAP chỉ giữ provider reference + deep link.</span></div>
              {(intent.pancakeConversations ?? []).length === 0 ? <p>Chưa có conversation binding.</p> : null}
              {(intent.pancakeConversations ?? []).map((conversation) => (
                <div className={styles.pancakeConversation} key={conversation.id}>
                  <div>
                    <strong>{conversation.channelDisplayName}</strong>
                    <span>{conversation.channel} · <code>{conversation.refId}</code></span>
                  </div>
                  {conversation.usable && conversation.providerDeepLink
                    ? <a href={conversation.providerDeepLink} target="_blank" rel="noopener noreferrer">Chat trên Pancake ↗</a>
                    : <span className={styles.chatUnavailable}>Chat unavailable</span>}
                </div>
              ))}
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
function leadLabel(intent: BoAcquisitionIntent) {
  if (intent.phone) return intent.phone;
  return intent.sourceSurface === "PANCAKE" ? "Pancake Lead" : "Lead chưa có số điện thoại";
}
function sourceLabel(source: BoAcquisitionIntent["sourceBrand"]) { return source === "PINO_HOUSE" ? "PINO House" : "Toppi"; }
function intentLabel(kind: BoAcquisitionIntent["intentKind"]) { return ({ OPEN_STUDIO: "Open Studio", PROGRAM_INTEREST: "Quan tâm chương trình", GENERAL_INQUIRY: "Tư vấn chung" } as const)[kind]; }
function formatTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "—";
}
function message(error: unknown) { return error instanceof Error ? error.message : "Không thể hoàn tất yêu cầu."; }

function CrmPanel({ intent, catalog, blocked, runCommand }: {
  intent: BoAcquisitionIntent;
  catalog: BoAcquisitionCrmCatalog;
  blocked: boolean;
  runCommand: (key: string, intent: BoAcquisitionIntent, action: (idempotencyKey: string) => Promise<unknown>, success: string) => void;
}) {
  const [interestArea, setInterestArea] = useState(intent.crm.interestArea);
  const [pathProgramId, setPathProgramId] = useState(intent.crm.pathProgramId ?? "");
  const [productPlanId, setProductPlanId] = useState(intent.crm.productPlanId ?? "");
  const [preferredCenterId, setPreferredCenterId] = useState(intent.crm.preferredCenterId ?? "");
  const [ownerStaffMemberId, setOwnerStaffMemberId] = useState(intent.crm.ownerStaffMemberId ?? "");
  const [nextFollowUp, setNextFollowUp] = useState(toLocalInput(intent.crm.nextFollowUpAt));
  const [qualificationStatus, setQualificationStatus] = useState(intent.crm.qualificationStatus);
  const [qualificationReason, setQualificationReason] = useState(intent.crm.qualificationReason ?? "");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<"" | "CONNECTED" | "NO_ANSWER" | "CALL_BACK" | "NOT_INTERESTED" | "OTHER">("");

  const crmKey = ["crm", intent.id, intent.crm.version, interestArea, pathProgramId, productPlanId, preferredCenterId, ownerStaffMemberId, nextFollowUp, qualificationStatus, qualificationReason].join(":");
  const save = (key: string) => boApi.configureAcquisitionCrm(intent.id, {
    expectedVersion: intent.crm.version,
    interestArea,
    pathProgramId: pathProgramId || null,
    productPlanId: productPlanId || null,
    preferredCenterId: preferredCenterId || null,
    ownerStaffMemberId: ownerStaffMemberId || null,
    nextFollowUpAt: fromLocalInput(nextFollowUp),
    qualificationStatus,
    qualificationReason: qualificationReason.trim() || null,
  }, key);

  return <section className={styles.crmPanel}>
    <div className={styles.crmHead}>
      <div><strong>CRM · Interest & Follow-up</strong><span>Commercial metadata ở PAP; hội thoại vẫn ở Pancake.</span></div>
      <span className={`${styles.followBadge} ${intent.crm.followUpState === "OVERDUE" ? styles.followOverdue : ""}`}>{followUpLabel(intent.crm.followUpState, intent.crm.nextFollowUpAt)}</span>
    </div>
    <div className={styles.crmGrid}>
      <label>Interest
        <select value={interestArea} onChange={(e) => setInterestArea(e.target.value as typeof interestArea)} disabled={blocked}>
          <option value="GENERAL">Tư vấn chung</option><option value="ART">Mỹ thuật</option><option value="PIANO">Piano</option>
          <option value="OPEN_STUDIO">Open Studio</option><option value="PROGRAM">Chương trình</option><option value="OTHER">Khác</option>
        </select>
      </label>
      <label>Path
        <select value={pathProgramId} onChange={(e) => setPathProgramId(e.target.value)} disabled={blocked}>
          <option value="">—</option>{catalog.paths.map((x) => <option key={x.id} value={x.id}>{x.displayName}</option>)}
        </select>
      </label>
      <label>Product plan
        <select value={productPlanId} onChange={(e) => setProductPlanId(e.target.value)} disabled={blocked}>
          <option value="">—</option>{catalog.productPlans.map((x) => <option key={x.id} value={x.id}>{x.cadence} buổi/tuần · {x.termWeeks} tuần</option>)}
        </select>
      </label>
      <label>Center
        <select value={preferredCenterId} onChange={(e) => setPreferredCenterId(e.target.value)} disabled={blocked}>
          <option value="">—</option>{catalog.centers.map((x) => <option key={x.id} value={x.id}>{x.displayName}</option>)}
        </select>
      </label>
      <label>Owner
        <select value={ownerStaffMemberId} onChange={(e) => setOwnerStaffMemberId(e.target.value)} disabled={blocked}>
          <option value="">Chưa gán</option>{catalog.owners.map((x) => <option key={x.id} value={x.id}>{x.displayLabel}</option>)}
        </select>
      </label>
      <label>Next follow-up
        <input type="datetime-local" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} disabled={blocked || intent.status === "CLOSED"} />
      </label>
      <label>Qualification
        <select value={qualificationStatus} onChange={(e) => setQualificationStatus(e.target.value as typeof qualificationStatus)} disabled={blocked}>
          <option value="UNQUALIFIED">Chưa qualify</option><option value="QUALIFIED">Qualified</option><option value="NOT_A_FIT">Not a fit</option>
        </select>
      </label>
      <label>Lý do qualification
        <input value={qualificationReason} onChange={(e) => setQualificationReason(e.target.value)} maxLength={500} disabled={blocked} placeholder={qualificationStatus === "NOT_A_FIT" ? "Bắt buộc khi Not a fit" : "Tuỳ chọn"} />
      </label>
    </div>
    <button type="button" className={styles.crmSave} onClick={() => runCommand(crmKey, intent, save, "Đã cập nhật CRM.")} disabled={blocked || (qualificationStatus === "NOT_A_FIT" && !qualificationReason.trim())}>Lưu CRM</button>

    <div className={styles.activityComposer}>
      <textarea aria-label="Ghi chú CRM" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Ghi chú follow-up…" disabled={blocked} />
      <button type="button" onClick={() => runCommand("note:"+intent.id+":"+note.trim(), intent, (key) => boApi.addAcquisitionCrmActivity(intent.id,{kind:"NOTE",note:note.trim(),contactOutcome:null},key), "Đã thêm ghi chú.")} disabled={blocked || !note.trim()}>Thêm note</button>
      <select aria-label="Kết quả liên hệ" value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)} disabled={blocked}>
        <option value="">Kết quả liên hệ…</option><option value="CONNECTED">Đã kết nối</option><option value="NO_ANSWER">Không bắt máy</option>
        <option value="CALL_BACK">Hẹn gọi lại</option><option value="NOT_INTERESTED">Không quan tâm</option><option value="OTHER">Khác</option>
      </select>
      <button type="button" onClick={() => runCommand("outcome:"+intent.id+":"+outcome, intent, (key) => boApi.addAcquisitionCrmActivity(intent.id,{kind:"CONTACT_OUTCOME",note:null,contactOutcome:outcome || null},key), "Đã ghi kết quả liên hệ.")} disabled={blocked || !outcome}>Ghi outcome</button>
    </div>
    <div className={styles.activityTimeline}>
      <strong>CRM activity</strong>
      {(intent.crmActivities ?? []).length === 0 ? <p>Chưa có activity.</p> : (intent.crmActivities ?? []).map((item) =>
        <div key={item.id}><span>{item.kind === "NOTE" ? item.note : contactOutcomeLabel(item.contactOutcome)}</span><small>{item.actorDisplayLabel ?? "User"} · {formatTime(item.createdAt)}</small></div>
      )}
    </div>
  </section>;
}

function qualificationLabel(value: BoAcquisitionIntent["crm"]["qualificationStatus"]) {
  return ({ UNQUALIFIED: "Chưa qualify", QUALIFIED: "Qualified", NOT_A_FIT: "Not a fit" } as const)[value];
}
function followUpLabel(state: BoAcquisitionIntent["crm"]["followUpState"], next: string | null) {
  if (state === "CLOSED") return "Closed";
  if (state === "UNPLANNED") return "Chưa hẹn follow-up";
  return (state === "OVERDUE" ? "Quá hạn" : "Sắp follow-up") + " · " + formatTime(next);
}
function contactOutcomeLabel(value: NonNullable<BoAcquisitionIntent["crmActivities"]>[number]["contactOutcome"]) {
  return value ? ({ CONNECTED: "Đã kết nối", NO_ANSWER: "Không bắt máy", CALL_BACK: "Hẹn gọi lại", NOT_INTERESTED: "Không quan tâm", OTHER: "Khác" } as const)[value] : "—";
}
function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
function fromLocalInput(value: string) {
  return value ? new Date(value + ":00+07:00").toISOString() : null;
}
