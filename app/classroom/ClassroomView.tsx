"use client";

import { useEffect, useMemo, useState } from "react";
import { TosShell } from "@/app/components/tos-shell";
import { workforceApi, WorkforceApiError, type StaffProfile, type WorkforceContext } from "@/lib/workforce-api";
import { tosLearningApi, TosLearningApiError, type DaySession, type LearningOptions, type ResolvedParticipation, type RosterEntry, type SessionRoster } from "@/lib/tos-learning-api";
import { canSettleSource, tosDayOfLearningApi, TosDayOfLearningApiError, type SessionLearningOwner, type StudentVisit } from "@/lib/tos-day-of-learning-api";
import styles from "./classroom.module.css";

const footer = [
  { id: "home", label: "Home", href: "/dashboard" },
  { id: "classroom", label: "Lớp học", href: "/classroom" },
  { id: "open-studio", label: "Open Studio", href: "/open-studio" },
  { id: "shift", label: "Ca làm", href: "/check-in" },
  { id: "history", label: "Lịch sử", href: "/timesheet" },
];

type Notes = Record<string, { learningNote: string; observation: string }>;
type VisitState = Record<string, StudentVisit | null>;
function dayInZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function clock(value: string) { const match = value.match(/(\d{2}:\d{2})(?::\d{2})?$/); return match?.[1] ?? value; }
function apiMessage(error: unknown) {
  if (error instanceof TosLearningApiError || error instanceof TosDayOfLearningApiError || error instanceof WorkforceApiError) {
    if (error.status === 401) return "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";
    if (error.status === 403) return "Tài khoản hiện chưa có quyền thực hiện thao tác này.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Không thể hoàn tất thao tác lớp học.";
}
function currentSyllabus(options: LearningOptions | null) {
  if (!options) return null;
  if (options.primarySyllabusId) return options.syllabi.find((item) => item.id === options.primarySyllabusId) ?? null;
  return options.syllabi.find((item) => item.publicationStatus === "PUBLISHED") ?? options.syllabi[0] ?? null;
}
function sourceLabel(entry: RosterEntry) {
  if (entry.status === "CONFLICT") return "Nhiều nguồn · cần Operations xử lý";
  const source = entry.sources[0];
  if (!source) return "Thiếu nguồn canonical";
  if (source.sourceType === "ENROLLMENT") return "Lịch học định kỳ";
  if (source.sourceType === "RENEWAL_GRACE") return "Renewal grace";
  return `Booking · ${source.basis}`;
}

export default function ClassroomView() {
  const [context, setContext] = useState<WorkforceContext | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [centerId, setCenterId] = useState("");
  const [localDate, setLocalDate] = useState("");
  const [sessions, setSessions] = useState<DaySession[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [roster, setRoster] = useState<SessionRoster | null>(null);
  const [options, setOptions] = useState<LearningOptions | null>(null);
  const [owner, setOwner] = useState<SessionLearningOwner | null>(null);
  const [visits, setVisits] = useState<VisitState>({});
  const [arrivalEnabled, setArrivalEnabled] = useState(true);
  const [notes, setNotes] = useState<Notes>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedSession = sessions.find((item) => item.id === sessionId) ?? null;
  const lessonPlan = currentSyllabus(options);
  const entries = useMemo(() => [...(roster?.entries ?? [])].sort((a, b) => a.studentDisplayName.localeCompare(b.studentDisplayName, "vi")), [roster]);
  const resolved = useMemo(() => [...(roster?.resolvedParticipations ?? [])].sort((a, b) => a.studentDisplayName.localeCompare(b.studentDisplayName, "vi")), [roster]);

  async function loadVisits(currentRoster: SessionRoster, nextCenterId: string) {
    const studentIds = [...new Set([
      ...currentRoster.entries.map((item) => item.studentProfileId),
      ...currentRoster.resolvedParticipations.map((item) => item.studentProfileId),
    ])];
    if (!studentIds.length) { setVisits({}); return; }
    const checks = await Promise.allSettled(studentIds.map(async (studentId) => [studentId, (await tosDayOfLearningApi.openVisit(studentId, nextCenterId)).data] as const));
    const next: VisitState = {};
    let denied = false;
    for (const check of checks) {
      if (check.status === "fulfilled") next[check.value[0]] = check.value[1];
      else if (check.reason instanceof TosDayOfLearningApiError && check.reason.status === 403) denied = true;
    }
    setArrivalEnabled(!denied);
    setVisits(next);
  }
  async function loadSession(nextSessionId: string, nextCenterId = centerId) {
    setSessionId(nextSessionId);
    setRoster(null);
    setOptions(null);
    setOwner(null);
    setVisits({});
    if (!nextSessionId) return;
    const [rosterResponse, optionsResult, ownerResult] = await Promise.all([
      tosLearningApi.roster(nextSessionId),
      tosLearningApi.learningOptions(nextSessionId).catch((cause) => {
        if (cause instanceof TosLearningApiError && cause.status === 403) return null;
        throw cause;
      }),
      tosDayOfLearningApi.learningOwner(nextSessionId).catch((cause) => {
        if (cause instanceof TosDayOfLearningApiError && cause.status === 403) return null;
        throw cause;
      }),
    ]);
    setRoster(rosterResponse.data);
    setOptions(optionsResult?.data ?? null);
    setOwner(ownerResult?.data.owner ?? null);
    if (nextCenterId) await loadVisits(rosterResponse.data, nextCenterId);
  }

  async function loadDay(nextCenter: string, nextDate: string) {
    setLoading(true); setError(""); setSuccess("");
    try {
      const result = await tosLearningApi.sessionsDay(nextCenter, nextDate);
      setSessions(result.data.sessions);
      await loadSession(result.data.sessions[0]?.id ?? "", nextCenter);
    } catch (cause) {
      setError(apiMessage(cause)); setSessions([]); setRoster(null); setOptions(null); setOwner(null); setVisits({});
    } finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true); setError("");
      try {
        const [contextResponse, profileResponse] = await Promise.all([workforceApi.context(), workforceApi.profile()]);
        if (!active) return;
        setContext(contextResponse.data); setProfile(profileResponse.data);
        const center = contextResponse.data.centers[0];
        if (!center) { setError("Chưa có Center khả dụng cho tài khoản này."); return; }
        const date = dayInZone(center.timeZone);
        setCenterId(center.id); setLocalDate(date);
        await loadDay(center.id, date);
      } catch (cause) { if (active) setError(apiMessage(cause)); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
    // bootstrap once; subsequent changes are explicit operator actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function chooseSession(value: string) {
    setLoading(true); setError(""); setSuccess("");
    try { await loadSession(value); }
    catch (cause) { setError(apiMessage(cause)); }
    finally { setLoading(false); }
  }
  async function changeCenter(value: string) {
    setCenterId(value);
    const center = context?.centers.find((item) => item.id === value);
    const date = center ? dayInZone(center.timeZone) : localDate;
    if (center) setLocalDate(date);
    if (value && date) await loadDay(value, date);
  }
  async function changeDate(value: string) {
    setLocalDate(value);
    if (centerId && value) await loadDay(centerId, value);
  }
  function updateNotes(studentId: string, patch: Partial<Notes[string]>) {
    setNotes((current) => {
      const previous = current[studentId] ?? { learningNote: "", observation: "" };
      return { ...current, [studentId]: { ...previous, ...patch } };
    });
  }
  async function refreshCurrent() {
    if (sessionId) await loadSession(sessionId);
  }
  async function runAction(key: string, action: () => Promise<void>, successText: string) {
    setBusy(key); setError(""); setSuccess("");
    try { await action(); setSuccess(successText); await refreshCurrent(); }
    catch (cause) { setError(apiMessage(cause)); }
    finally { setBusy(""); }
  }
  async function checkIn(entry: { studentProfileId: string; studentDisplayName: string }) {
    await runAction(`visit-in:${entry.studentProfileId}`, async () => {
      await tosDayOfLearningApi.checkIn(entry.studentProfileId, centerId, "TOS Day of Learning");
    }, `${entry.studentDisplayName}: đã check-in House.`);
  }
  async function checkOut(studentId: string, studentName: string) {
    const visit = visits[studentId]; if (!visit) return;
    await runAction(`visit-out:${studentId}`, async () => {
      await tosDayOfLearningApi.checkOut(visit, "TOS Day of Learning checkout");
    }, `${studentName}: đã check-out House.`);
  }
  async function settle(entry: RosterEntry, status: "PRESENT" | "ABSENT") {
    if (entry.status !== "CANDIDATE") return;
    const source = entry.sources[0];
    if (!selectedSession || !source || !canSettleSource(source)) return;
    if (status === "PRESENT" && (!owner || !lessonPlan)) return;
    const note = notes[entry.studentProfileId];
    await runAction(`attendance:${entry.studentProfileId}:${status}`, async () => {
      await tosDayOfLearningApi.settle({
        studentProfileId: entry.studentProfileId, sessionId: selectedSession.id, source, attendanceStatus: status,
        ...(status === "PRESENT" ? { syllabusId: lessonPlan!.id, learningNote: note?.learningNote, observation: note?.observation } : {}),
      }, crypto.randomUUID());
    }, `${entry.studentDisplayName}: ${status === "PRESENT" ? "Có mặt + evidence" : "Vắng"} đã được Core ghi nhận.`);
  }
  async function correct(entry: ResolvedParticipation, nextStatus: "PRESENT" | "ABSENT") {
    if (nextStatus === entry.attendanceStatus) return;
    if (nextStatus === "PRESENT" && (!owner || !lessonPlan)) return;
    if (nextStatus === "ABSENT" && !entry.diaryVersion) return;
    const reason = prompt(`Lý do sửa ${entry.studentDisplayName} thành ${nextStatus === "PRESENT" ? "Có mặt" : "Vắng"}`);
    if (!reason) return;
    const note = notes[entry.studentProfileId];
    await runAction(`correct:${entry.attendanceId}`, async () => {
      await tosDayOfLearningApi.correctAttendance({
        attendanceId: entry.attendanceId,
        attendanceVersion: entry.attendanceVersion,
        diaryVersion: entry.diaryVersion,
        nextStatus,
        reason,
        ...(nextStatus === "PRESENT" ? { syllabusId: lessonPlan!.id, learningNote: note?.learningNote, observation: note?.observation } : {}),
      }, crypto.randomUUID());
    }, `${entry.studentDisplayName}: Attendance đã được correction sang ${nextStatus === "PRESENT" ? "Có mặt" : "Vắng"}.`);
  }

  const selectedCenter = context?.centers.find((item) => item.id === centerId) ?? null;
  const presentReady = Boolean(owner && lessonPlan);
  return <TosShell title="Day of Learning" subtitle={selectedCenter?.displayName ?? profile?.displayLabel ?? "PINO Team"} theme="classroom" footerItems={footer} activeFooterId="classroom">
    <div className={styles.page}>
      <section className={styles.toolbar}>
        <label>Center<select value={centerId} onChange={(event) => void changeCenter(event.target.value)}>{context?.centers.map((center) => <option key={center.id} value={center.id}>{center.displayName}</option>)}</select></label>
        <label>Ngày<input type="date" value={localDate} onChange={(event) => void changeDate(event.target.value)} /></label>
      </section>
      {error ? <div className={styles.error}>{error}</div> : null}
      {success ? <div className={styles.success}>{success}</div> : null}
      {loading ? <div className={styles.empty}>Đang tải Day of Learning từ Core…</div> : null}
      {!loading && !sessions.length ? <div className={styles.empty}><strong>Không có Session</strong><span>Ngày này chưa có Session materialized.</span></div> : null}
      {sessions.length ? <section className={styles.sessionStrip}>{sessions.map((item) => <button key={item.id} className={item.id === sessionId ? styles.sessionActive : styles.sessionButton} onClick={() => void chooseSession(item.id)}><strong>{clock(item.scheduledStartsLocal)}–{clock(item.scheduledEndsLocal)}</strong><span>{item.operationalName ?? item.pathDisplayName}</span><small>{item.learningSpaceDisplayName ?? item.pathDisplayName}</small></button>)}</section> : null}
      {selectedSession && roster ? <>
        <section className={styles.sessionHeader}>
          <div><span className={styles.eyebrow}>{selectedSession.pathDisplayName}</span><h2>{selectedSession.operationalName ?? "Session"}</h2><p>{clock(selectedSession.scheduledStartsLocal)}–{clock(selectedSession.scheduledEndsLocal)} · {selectedSession.learningSpaceDisplayName ?? "Chưa gán phòng"}</p></div>
          <div className={styles.stats}><b>{entries.length}</b><span>chờ</span><b>{resolved.length}</b><span>đã ghi</span></div>
        </section>
        <section className={styles.readinessGrid}>
          <div className={arrivalEnabled ? styles.readyCard : styles.blockedCard}><span>01 · HIỆN DIỆN HOUSE</span><strong>{arrivalEnabled ? "Check-in/out sẵn sàng" : "Không có quyền Arrival"}</strong><small>Visit chỉ phản ánh có mặt tại House, không tự tạo Attendance.</small></div>
          <div className={presentReady ? styles.readyCard : styles.blockedCard}><span>02 · ATTENDANCE + EVIDENCE</span><strong>{presentReady ? "Có mặt sẵn sàng" : "Có mặt đang bị chặn"}</strong><small>{!owner ? "Session chưa có Learning Owner" : !lessonPlan ? "Chưa có Syllabus khả dụng" : lessonPlan.title}</small></div>
        </section>
        {roster.unresolvedRegistrations.length ? <div className={styles.notice}>{roster.unresolvedRegistrations.length} Registration chưa resolve Student. Flow first-attendance vẫn phải xử lý ở Operations trước.</div> : null}
        <section className={styles.rosterSection}>
          <div className={styles.sectionTitle}><div><span className={styles.eyebrow}>CHỜ XỬ LÝ</span><h3>Learners</h3></div><b>{entries.length}</b></div>
          {!entries.length ? <div className={styles.empty}>Không còn learner chờ Attendance.</div> : null}
          {entries.map((entry) => {
            const source = entry.status === "CANDIDATE" ? entry.sources[0] : null;
            const supported = source ? canSettleSource(source) : false;
            const visit = visits[entry.studentProfileId] ?? null;
            const note = notes[entry.studentProfileId] ?? { learningNote: "", observation: "" };
            return <article className={styles.learnerCard} key={entry.studentProfileId}>
              <div className={styles.learnerTop}><div className={styles.avatar}>{entry.studentDisplayName.charAt(0).toUpperCase()}</div><div className={styles.identity}><strong>{entry.studentDisplayName}</strong><small>{sourceLabel(entry)}</small></div><span className={visit ? styles.houseIn : styles.houseOut}>{visit ? "Đang ở House" : "Chưa check-in"}</span></div>
              <div className={styles.stepRow}>
                <button className={styles.visitButton} disabled={!arrivalEnabled || !!busy} onClick={() => visit ? void checkOut(entry.studentProfileId, entry.studentDisplayName) : void checkIn(entry)}>{busy.startsWith("visit-") && busy.endsWith(entry.studentProfileId) ? "…" : visit ? "Check-out House" : "Check-in House"}</button>
                <span>Visit và Attendance là 2 truth riêng biệt.</span>
              </div>
              <div className={styles.evidenceComposer}>
                <label>Learning note<input value={note.learningNote} onChange={(event) => updateNotes(entry.studentProfileId, { learningNote: event.target.value })} placeholder="Điểm chính của buổi học…" /></label>
                <label>Observation<input value={note.observation} onChange={(event) => updateNotes(entry.studentProfileId, { observation: event.target.value })} placeholder="Quan sát ngắn…" /></label>
              </div>
              <div className={styles.attendanceActions}>
                <button className={styles.absentButton} disabled={entry.status !== "CANDIDATE" || !supported || !!busy} onClick={() => void settle(entry, "ABSENT")}>{busy === `attendance:${entry.studentProfileId}:ABSENT` ? "Đang ghi…" : "Vắng"}</button>
                <button className={styles.presentButton} disabled={entry.status !== "CANDIDATE" || !supported || !presentReady || !!busy} onClick={() => void settle(entry, "PRESENT")}>{busy === `attendance:${entry.studentProfileId}:PRESENT` ? "Đang ghi…" : "Có mặt + Evidence"}</button>
              </div>
              {!supported ? <small className={styles.inlineWarning}>Nguồn roster chưa đủ canonical authority để settle.</small> : null}
            </article>;
          })}
        </section>
        <section className={styles.rosterSection}>
          <div className={styles.sectionTitle}><div><span className={styles.eyebrow}>CANONICAL</span><h3>Đã ghi nhận</h3></div><b>{resolved.length}</b></div>
          {!resolved.length ? <div className={styles.empty}>Chưa có Attendance canonical.</div> : null}
          {resolved.map((entry) => {
            const visit = visits[entry.studentProfileId] ?? null;
            const note = notes[entry.studentProfileId] ?? { learningNote: "", observation: "" };
            const nextStatus = entry.attendanceStatus === "PRESENT" ? "ABSENT" : "PRESENT";
            const correctionBlocked = nextStatus === "PRESENT" ? !presentReady : !entry.diaryVersion;
            return <article className={styles.learnerCard} key={entry.attendanceId}>
              <div className={styles.learnerTop}><div className={styles.avatar}>{entry.studentDisplayName.charAt(0).toUpperCase()}</div><div className={styles.identity}><strong>{entry.studentDisplayName}</strong><small>{entry.basis} · {entry.commercialConsequence === "CONSUME_SERVICE_UNIT" ? "trừ 1 Service Unit" : "không trừ buổi"}</small></div><span className={entry.attendanceStatus === "PRESENT" ? styles.presentBadge : styles.absentBadge}>{entry.attendanceStatus === "PRESENT" ? "Có mặt" : "Vắng"}</span></div>
              <div className={styles.stepRow}><button className={styles.visitButton} disabled={!arrivalEnabled || !!busy} onClick={() => visit ? void checkOut(entry.studentProfileId, entry.studentDisplayName) : void checkIn(entry)}>{busy.startsWith("visit-") && busy.endsWith(entry.studentProfileId) ? "…" : visit ? "Check-out House" : "Check-in House"}</button><span>{visit ? `Check-in ${new Date(visit.checkedInAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Không có open Visit"}</span></div>
              {nextStatus === "PRESENT" ? <div className={styles.evidenceComposer}><label>Learning note<input value={note.learningNote} onChange={(event) => updateNotes(entry.studentProfileId, { learningNote: event.target.value })} placeholder="Evidence khi sửa thành Có mặt…" /></label><label>Observation<input value={note.observation} onChange={(event) => updateNotes(entry.studentProfileId, { observation: event.target.value })} placeholder="Quan sát ngắn…" /></label></div> : null}
              <div className={styles.correctionRow}>
                <span>{entry.diaryId ? `Evidence saved · Diary v${entry.diaryVersion}` : "Không có Diary"}</span>
                <button className={styles.correctionButton} disabled={correctionBlocked || !!busy} onClick={() => void correct(entry, nextStatus)}>{busy === `correct:${entry.attendanceId}` ? "Đang sửa…" : `Sửa thành ${nextStatus === "PRESENT" ? "Có mặt" : "Vắng"}`}</button>
              </div>
            </article>;
          })}
        </section>
      </> : null}
    </div>
  </TosShell>;
}
