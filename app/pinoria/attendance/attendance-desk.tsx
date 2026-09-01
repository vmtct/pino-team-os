"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TosShell } from "@/app/components/tos-shell/TosShell";
import { workforceApi } from "@/lib/workforce-api";
import { tosLearningApi, type DaySession, type RosterEntry, type SessionRoster } from "@/lib/tos-learning-api";
import {
  canSettleFromRosterSource,
  tosReceptionAttendanceApi,
  type SessionLearningOwner,
} from "@/lib/tos-reception-attendance-api";
import styles from "./attendance.module.css";

const CENTER_STORAGE = "pino.arrival.centerId";
const footer = [
  { id: "home", label: "Home", href: "/dashboard" },
  { id: "presence", label: "Hiện diện", href: "/pinoria" },
  { id: "attendance", label: "Điểm danh", href: "/pinoria/attendance" },
  { id: "wardrobe", label: "Tủ đồ", href: "/pinoria/wardrobe-prototype" },
];

function todayAtHouse() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function time(value: string) {
  return value.slice(11, 16);
}

function sourceLabel(entry: RosterEntry) {
  if (entry.status === "CONFLICT") return "Nhiều nguồn · cần Operations xử lý";
  const source = entry.sources[0];
  if (!source) return "Thiếu nguồn canonical";
  if (source.sourceType === "ENROLLMENT") return "Lịch học định kỳ";
  if (source.sourceType === "RENEWAL_GRACE") return "Renewal grace";
  return `Booking · ${source.basis}`;
}

type PresentReadiness = {
  owner: SessionLearningOwner | null;
  syllabusId: string | null;
  note: string;
};

const emptyReadiness: PresentReadiness = { owner: null, syllabusId: null, note: "Đang kiểm tra điều kiện Có mặt…" };

export function AttendanceDesk() {
  const [centerId, setCenterId] = useState("");
  const [localDate, setLocalDate] = useState(todayAtHouse);
  const [sessions, setSessions] = useState<DaySession[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [roster, setRoster] = useState<SessionRoster | null>(null);
  const [readiness, setReadiness] = useState<PresentReadiness>(emptyReadiness);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    async function resolveCenter() {
      try {
        const queryCenter = new URLSearchParams(location.search).get("centerId")?.trim();
        const saved = localStorage.getItem(CENTER_STORAGE)?.trim();
        const context = !queryCenter && !saved ? await workforceApi.context() : null;
        const value = queryCenter || saved || context?.data.centers[0]?.id || "";
        if (!active) return;
        if (value) localStorage.setItem(CENTER_STORAGE, value);
        setCenterId(value);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Không xác định được Center");
      }
    }
    void resolveCenter();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!centerId || !localDate) return;
    let active = true;
    setLoading(true);
    setError("");
    void tosLearningApi.sessionsDay(centerId, localDate)
      .then(({ data }) => {
        if (!active) return;
        setSessions(data.sessions);
        setSelectedId((current) => data.sessions.some((session) => session.id === current) ? current : data.sessions[0]?.id ?? "");
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Không tải được ca học"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [centerId, localDate]);

  const selected = useMemo(() => sessions.find((session) => session.id === selectedId) ?? null, [sessions, selectedId]);

  const loadRoster = useCallback(async (sessionId: string) => {
    const response = await tosLearningApi.roster(sessionId);
    setRoster(response.data);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setRoster(null);
      setReadiness(emptyReadiness);
      return;
    }
    let active = true;
    setRoster(null);
    setReadiness(emptyReadiness);
    setError("");
    void Promise.all([
      tosLearningApi.roster(selectedId),
      Promise.allSettled([
        tosReceptionAttendanceApi.learningOwner(selectedId),
        tosLearningApi.learningOptions(selectedId),
      ]),
    ]).then(([rosterResponse, checks]) => {
      if (!active) return;
      setRoster(rosterResponse.data);
      const owner = checks[0].status === "fulfilled" ? checks[0].value.data : null;
      const syllabusId = checks[1].status === "fulfilled" ? checks[1].value.data.primarySyllabusId : null;
      let note = "Sẵn sàng ghi Có mặt";
      if (!owner) note = checks[0].status === "rejected" ? "Không đủ quyền kiểm tra Learning Owner" : "Session chưa có Learning Owner";
      else if (!syllabusId) note = checks[1].status === "rejected" ? "Không đủ quyền kiểm tra giáo án" : "Session chưa có giáo án chính";
      setReadiness({ owner, syllabusId, note });
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không tải được roster");
    });
    return () => { active = false; };
  }, [selectedId]);

  async function settle(entry: RosterEntry, attendanceStatus: "PRESENT" | "ABSENT") {
    if (entry.status !== "CANDIDATE") return;
    const source = entry.sources[0];
    if (!selected || !source || !canSettleFromRosterSource(source)) return;
    if (attendanceStatus === "PRESENT" && (!readiness.owner || !readiness.syllabusId)) return;
    const actionKey = `${entry.studentProfileId}:${attendanceStatus}`;
    setBusy(actionKey);
    setError("");
    setSuccess("");
    try {
      await tosReceptionAttendanceApi.settle({
        studentProfileId: entry.studentProfileId,
        sessionId: selected.id,
        source,
        attendanceStatus,
        recordedAt: new Date().toISOString(),
        ...(attendanceStatus === "PRESENT" ? { syllabusId: readiness.syllabusId! } : {}),
      }, crypto.randomUUID());
      setSuccess(`${entry.studentDisplayName}: ${attendanceStatus === "PRESENT" ? "Có mặt" : "Vắng"} đã được Core ghi nhận.`);
      await loadRoster(selected.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không ghi nhận được Attendance");
    } finally {
      setBusy("");
    }
  }

  const candidates = roster?.entries ?? [];
  const resolved = roster?.resolvedParticipations ?? [];

  return (
    <TosShell title="Điểm danh" subtitle="Reception · Session Attendance" theme="pinoria" footerItems={footer} activeFooterId="attendance">
      <div className={styles.page}>
        <section className={styles.notice}>
          <strong>Hiện diện House ≠ Điểm danh lớp</strong>
          <span>Check-in/out ở quầy không tự tạo Attendance. Có mặt/Vắng chỉ được ghi theo Session bên dưới.</span>
        </section>

        <section className={styles.controls}>
          <label><span>Ngày vận hành</span><input type="date" value={localDate} onChange={(event) => setLocalDate(event.target.value)} /></label>
          <button type="button" onClick={() => setLocalDate(todayAtHouse())}>Hôm nay</button>
        </section>

        {error ? <div className={styles.error}>{error}</div> : null}
        {success ? <div className={styles.success}>{success}</div> : null}

        <section className={styles.sessions} aria-label="Các Session trong ngày">
          {loading ? <div className={styles.empty}>Đang tải Session…</div> : null}
          {!loading && !sessions.length ? <div className={styles.empty}>Không có Session tại Center này trong ngày đã chọn.</div> : null}
          {sessions.map((session) => (
            <button key={session.id} type="button" className={session.id === selectedId ? styles.sessionActive : styles.sessionCard} onClick={() => setSelectedId(session.id)}>
              <span>{time(session.scheduledStartsLocal)}–{time(session.scheduledEndsLocal)}</span>
              <strong>{session.operationalName || session.pathDisplayName}</strong>
              <small>{session.learningSpaceDisplayName || "Chưa gán phòng"} · {session.status}</small>
            </button>
          ))}
        </section>

        {selected ? <section className={styles.readiness}>
          <div><span>SESSION</span><strong>{selected.operationalName || selected.pathDisplayName}</strong></div>
          <div className={readiness.owner && readiness.syllabusId ? styles.ready : styles.blocked}>
            <b>{readiness.owner && readiness.syllabusId ? "Có mặt sẵn sàng" : "Có mặt đang bị chặn"}</b>
            <small>{readiness.note}</small>
          </div>
        </section> : null}

        {roster?.unresolvedRegistrations.length ? <div className={styles.warning}>
          {roster.unresolvedRegistrations.length} Registration chưa resolve Student — xử lý ở Operations trước khi điểm danh.
        </div> : null}

        {selected && roster ? <section className={styles.roster}>
          <div className={styles.sectionTitle}><strong>Chưa ghi nhận</strong><span>{candidates.length}</span></div>
          {!candidates.length ? <div className={styles.empty}>Không còn học viên chờ ghi Attendance.</div> : null}
          {candidates.map((entry) => {
            const source = entry.status === "CANDIDATE" ? entry.sources[0] : null;
            const sourceSupported = source ? canSettleFromRosterSource(source) : false;
            const presentBlocked = !sourceSupported || !readiness.owner || !readiness.syllabusId;
            return <article className={styles.learner} key={entry.studentProfileId}>
              <div className={styles.avatar}>{entry.studentDisplayName.charAt(0).toUpperCase()}</div>
              <div className={styles.identity}>
                <strong>{entry.studentDisplayName}</strong>
                <small>{sourceLabel(entry)}</small>
                {!sourceSupported ? <em>Nguồn này cần Operations resolve thêm dữ liệu trước.</em> : null}
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.absent} disabled={entry.status !== "CANDIDATE" || !sourceSupported || !!busy} onClick={() => entry.status === "CANDIDATE" && void settle(entry, "ABSENT")}>{busy === `${entry.studentProfileId}:ABSENT` ? "…" : "Vắng"}</button>
                <button type="button" className={styles.present} disabled={entry.status !== "CANDIDATE" || presentBlocked || !!busy} onClick={() => entry.status === "CANDIDATE" && void settle(entry, "PRESENT")}>{busy === `${entry.studentProfileId}:PRESENT` ? "…" : "Có mặt"}</button>
              </div>
            </article>;
          })}
        </section> : null}

        {selected && roster ? <section className={styles.roster}>
          <div className={styles.sectionTitle}><strong>Đã ghi nhận</strong><span>{resolved.length}</span></div>
          {!resolved.length ? <div className={styles.empty}>Chưa có Attendance canonical.</div> : null}
          {resolved.map((entry) => <article className={styles.resolved} key={entry.attendanceId}>
            <div className={styles.avatar}>{entry.studentDisplayName.charAt(0).toUpperCase()}</div>
            <div className={styles.identity}><strong>{entry.studentDisplayName}</strong><small>{entry.basis}</small></div>
            <span className={entry.attendanceStatus === "PRESENT" ? styles.presentBadge : styles.absentBadge}>{entry.attendanceStatus === "PRESENT" ? "Có mặt" : "Vắng"}</span>
          </article>)}
          <p className={styles.correctionNote}>Correction không nằm trong first slice này; trạng thái đã ghi là read-only tại quầy.</p>
        </section> : null}
      </div>
    </TosShell>
  );
}
