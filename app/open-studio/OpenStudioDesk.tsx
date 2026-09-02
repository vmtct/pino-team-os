"use client";

import { useEffect, useMemo, useState } from "react";
import { TosShell } from "@/app/components/tos-shell";
import { TOS_OPEN_STUDIO_FOOTER } from "@/app/components/tos-shell/navigation";
import { workforceApi, WorkforceApiError, type WorkforceContext } from "@/lib/workforce-api";
import { tosLearningApi, TosLearningApiError, type LearningOptions } from "@/lib/tos-learning-api";
import { tosDayOfLearningApi, TosDayOfLearningApiError, type OpenStudioDayClaim, type SessionLearningOwner } from "@/lib/tos-day-of-learning-api";
import styles from "./open-studio.module.css";

type Readiness = { owner: SessionLearningOwner | null; options: LearningOptions | null };
type Notes = Record<string, { learningNote: string; observation: string }>;
function dayInZone(timeZone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function clock(value: string) { return value.match(/T(\d{2}:\d{2})/)?.[1] ?? value; }
export default function OpenStudioDesk() {
  const [context, setContext] = useState<WorkforceContext | null>(null);
  const [centerId, setCenterId] = useState("");
  const [localDate, setLocalDate] = useState("");
  const [claims, setClaims] = useState<OpenStudioDayClaim[]>([]);
  const [readiness, setReadiness] = useState<Record<string, Readiness>>({});
  const [notes, setNotes] = useState<Notes>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadDay(nextCenter: string, nextDate: string) {
    setLoading(true); setError(""); setSuccess("");
    try {
      const response = await tosDayOfLearningApi.openStudioDay(nextCenter, nextDate);
      setClaims(response.data.claims);
      const sessionIds = [...new Set(response.data.claims.filter((item) => item.status === "RESERVED" && item.participantMode === "OWNER").map((item) => item.sessionId))];
      const pairs = await Promise.all(sessionIds.map(async (sessionId) => {
        const [owner, options] = await Promise.all([
          tosDayOfLearningApi.learningOwner(sessionId).then((value) => value.data.owner).catch(() => null),
          tosLearningApi.learningOptions(sessionId).then((value) => value.data).catch(() => null),
        ]);
        return [sessionId, { owner, options }] as const;
      }));
      setReadiness(Object.fromEntries(pairs));
    } catch (cause) { setError(apiMessage(cause)); setClaims([]); setReadiness({}); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    void workforceApi.context().then(async (response) => {
      if (!active) return;
      setContext(response.data);
      const center = response.data.centers[0];
      if (!center) { setError("Chưa có Center khả dụng cho tài khoản này."); setLoading(false); return; }
      const date = dayInZone(center.timeZone);
      setCenterId(center.id); setLocalDate(date);
      await loadDay(center.id, date);
    }).catch((cause: unknown) => { if (active) { setError(apiMessage(cause)); setLoading(false); } });
    return () => { active = false; };
    // bootstrap once; subsequent filters are explicit.
  }, []);

  function updateNotes(claimId: string, patch: Partial<Notes[string]>) {
    setNotes((current) => ({ ...current, [claimId]: { ...(current[claimId] ?? { learningNote: "", observation: "" }), ...patch } }));
  }
  async function settle(claim: OpenStudioDayClaim, attendanceStatus: "PRESENT" | "ABSENT") {
    if (claim.status !== "RESERVED" || claim.participantMode !== "OWNER") return;
    const ready = readiness[claim.sessionId];
    const syllabus = ready?.options?.primarySyllabusId
      ? ready.options.syllabi.find((item) => item.id === ready.options!.primarySyllabusId) ?? null
      : ready?.options?.syllabi.find((item) => item.publicationStatus === "PUBLISHED") ?? null;
    if (attendanceStatus === "PRESENT" && (!ready?.owner || !syllabus)) { setError("Session chưa đủ Learning Owner + Syllabus để ghi Có mặt."); return; }
    setBusy(`${claim.id}:${attendanceStatus}`); setError(""); setSuccess("");
    try {
      const note = notes[claim.id];
      await tosDayOfLearningApi.settleOpenStudioOwner({ claimId: claim.id, attendanceStatus, ...(attendanceStatus === "PRESENT" ? { syllabusId: syllabus!.id, learningNote: note?.learningNote, observation: note?.observation } : {}) }, crypto.randomUUID());
      setSuccess(`${claim.studentDisplayName ?? "Learner"}: ${attendanceStatus === "PRESENT" ? "Có mặt + evidence" : "Vắng"} đã được settle.`);
      await loadDay(centerId, localDate);
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setBusy(""); }
  }
  const selectedCenter = context?.centers.find((item) => item.id === centerId) ?? null;
  const reserved = useMemo(() => claims.filter((item) => item.status === "RESERVED"), [claims]);
  const resolved = useMemo(() => claims.filter((item) => item.status !== "RESERVED"), [claims]);

  return <TosShell title="Open Studio Desk" subtitle={selectedCenter?.displayName ?? "PINO Team"} theme="classroom" footerItems={TOS_OPEN_STUDIO_FOOTER} activeFooterId="desk">
    <main className={styles.page}>
      <section className={styles.toolbar}>
        <label>Center<select value={centerId} onChange={(event) => { setCenterId(event.target.value); void loadDay(event.target.value, localDate); }}>{context?.centers.map((center) => <option key={center.id} value={center.id}>{center.displayName}</option>)}</select></label>
        <label>Ngày<input type="date" value={localDate} onChange={(event) => { setLocalDate(event.target.value); void loadDay(centerId, event.target.value); }} /></label>
      </section>
      {error ? <div className={styles.error}>{error}</div> : null}
      {success ? <div className={styles.success}>{success}</div> : null}
      {loading ? <div className={styles.empty}>Đang tải Open Studio claims từ Core…</div> : null}
      {!loading && !claims.length ? <div className={styles.empty}><strong>Không có Open Studio claim</strong><span>Ngày này chưa có reservation cần vận hành.</span></div> : null}
      {!loading && claims.length ? <>
        <section className={styles.header}><div><span>RESERVED</span><h2>Chờ outcome</h2></div><b>{reserved.length}</b></section>
        <section className={styles.grid}>{reserved.map((claim) => <ClaimCard key={claim.id} claim={claim} ready={readiness[claim.sessionId]} note={notes[claim.id]} busy={busy} onNotes={(patch) => updateNotes(claim.id, patch)} onSettle={settle} />)}</section>
        <section className={styles.header}><div><span>CANONICAL</span><h2>Đã settle / release</h2></div><b>{resolved.length}</b></section>
        <section className={styles.grid}>{resolved.map((claim) => <ResolvedCard key={claim.id} claim={claim} />)}</section>
      </> : null}
    </main>
  </TosShell>;
}
function ClaimCard({ claim, ready, note, busy, onNotes, onSettle }: { claim: OpenStudioDayClaim; ready?: Readiness; note?: Notes[string]; busy: string; onNotes: (patch: Partial<Notes[string]>) => void; onSettle: (claim: OpenStudioDayClaim, status: "PRESENT" | "ABSENT") => Promise<void> }) {
  const syllabus = ready?.options?.primarySyllabusId ? ready.options.syllabi.find((item) => item.id === ready.options!.primarySyllabusId) ?? null : ready?.options?.syllabi.find((item) => item.publicationStatus === "PUBLISHED") ?? null;
  const presentReady = claim.participantMode === "OWNER" && Boolean(ready?.owner && syllabus);
  return <article className={styles.card}>
    <div className={styles.cardTop}><div className={styles.avatar}>{(claim.studentDisplayName ?? claim.participantMode).charAt(0)}</div><div><strong>{claim.studentDisplayName ?? claim.participantMode}</strong><span>{clock(claim.scheduledStartsLocal)}–{clock(claim.scheduledEndsLocal)} · {claim.experienceType}</span><small>{claim.passClass} · {claim.participantMode}</small></div><em>{claim.reservationStatus ?? claim.status}</em></div>
    <div className={presentReady ? styles.ready : styles.blocked}><strong>{presentReady ? "Evidence ready" : "Present blocked"}</strong><span>{!ready?.owner ? "Thiếu Learning Owner" : !syllabus ? "Thiếu Syllabus" : syllabus.title}</span></div>
    {claim.participantMode === "OWNER" ? <div className={styles.notes}><label>Learning note<input value={note?.learningNote ?? ""} onChange={(event) => onNotes({ learningNote: event.target.value })} placeholder="Điểm chính của buổi…" /></label><label>Observation<input value={note?.observation ?? ""} onChange={(event) => onNotes({ observation: event.target.value })} placeholder="Quan sát ngắn…" /></label></div> : <p className={styles.hint}>Sibling/Guest dùng registration-present/no-show flow; OWNER outcome không áp dụng.</p>}
    <div className={styles.actions}><button disabled={claim.participantMode !== "OWNER" || !!busy} onClick={() => void onSettle(claim, "ABSENT")}>{busy === `${claim.id}:ABSENT` ? "Đang ghi…" : "Vắng"}</button><button className={styles.primary} disabled={!presentReady || !!busy} onClick={() => void onSettle(claim, "PRESENT")}>{busy === `${claim.id}:PRESENT` ? "Đang ghi…" : "Có mặt + Evidence"}</button></div>
  </article>;
}

function ResolvedCard({ claim }: { claim: OpenStudioDayClaim }) { return <article className={styles.card}><div className={styles.cardTop}><div className={styles.avatar}>{(claim.studentDisplayName ?? claim.participantMode).charAt(0)}</div><div><strong>{claim.studentDisplayName ?? claim.participantMode}</strong><span>{claim.localDate} · {clock(claim.scheduledStartsLocal)}</span><small>{claim.passClass} · {claim.participantMode}</small></div><em>{claim.status}</em></div><div className={styles.ready}><strong>{claim.settlementState}</strong><span>{claim.participantOutcome ?? "Không có outcome"}</span></div></article>; }

function apiMessage(error: unknown) {
  if (error instanceof TosLearningApiError || error instanceof TosDayOfLearningApiError || error instanceof WorkforceApiError) {
    if (error.status === 401) return "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";
    if (error.status === 403) return "Tài khoản hiện chưa có quyền Open Studio tại Center này.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Không thể hoàn tất Open Studio operation.";
}
