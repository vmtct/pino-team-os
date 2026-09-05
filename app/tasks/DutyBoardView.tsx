"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TosShell } from "@/app/components/tos-shell";
import { TOS_TASKS_FOOTER } from "@/app/components/tos-shell/navigation";
import {
  workforceApi,
  WorkforceApiError,
  type Assignment,
  type StaffDutyBoard,
  type StaffDutyObligation,
  type StaffProfile,
  type TimekeepingSession,
  type WorkforceContext,
} from "@/lib/workforce-api";
import { dutyDeepLink, dutyIsOverdue, dutyIsResolved, dutySourceLabel, dutyStatusLabel, dutyTitle, sourceRefSummary } from "@/lib/wfm-duty-ui";
import styles from "./tasks.module.css";

function dayInZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function apiMessage(error: unknown) {
  if (error instanceof WorkforceApiError) {
    if (error.status === 401) return "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";
    if (error.status === 403) return "Tài khoản chưa có quyền xem duty của chính mình.";
    if (error.status === 409) return "Duty context vừa thay đổi. Hãy tải lại để lấy truth mới nhất từ Core.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Không thể tải Duty Board từ Core.";
}

function formatInstant(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function DutyCard({ duty }: { duty: StaffDutyObligation }) {
  const href = dutyDeepLink(duty);
  const resolved = dutyIsResolved(duty);
  const overdue = dutyIsOverdue(duty);
  return <article className={`${styles.dutyCard} ${resolved ? styles.resolved : overdue ? styles.overdue : ""}`}>
    <div className={styles.dutyTop}>
      <div className={styles.dutyIdentity}>
        <span className={styles.source}>{dutySourceLabel(duty)}</span>
        <h3>{dutyTitle(duty)}</h3>
        <p>{sourceRefSummary(duty.sourceRef)}</p>
      </div>
      <span className={`${styles.status} ${resolved ? styles.statusResolved : overdue ? styles.statusOverdue : duty.status === "BLOCKED" ? styles.statusBlocked : ""}`}>{dutyStatusLabel(duty)}</span>
    </div>
    <div className={styles.metaGrid}>
      <div><span>Required</span><strong>{formatInstant(duty.requiredAt)}</strong></div>
      <div><span>Due</span><strong>{formatInstant(duty.dueAt)}</strong></div>
      <div><span>Blocking</span><strong>{duty.blocking ? "Có" : "Không"}</strong></div>
    </div>
    {href ? <Link className={styles.ownerLink} href={href}>{resolved ? "Mở nguồn" : "Đi xử lý ở nguồn"}<span>→</span></Link> : <div className={styles.noAction}>Không có Team owning surface khả dụng cho source này.</div>}
  </article>;
}

function DutySection({ eyebrow, title, description, duties, empty }: { eyebrow: string; title: string; description: string; duties: StaffDutyObligation[]; empty: string }) {
  return <section className={styles.section}>
    <div className={styles.sectionHeader}>
      <div><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>
      <b>{duties.filter((item) => !dutyIsResolved(item)).length}</b>
    </div>
    {duties.length ? <div className={styles.dutyList}>{duties.map((duty) => <DutyCard key={`${duty.obligationId}:${duty.sourceRef}`} duty={duty} />)}</div> : <div className={styles.empty}>{empty}</div>}
  </section>;
}

export default function DutyBoardView() {
  const [context, setContext] = useState<WorkforceContext | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [current, setCurrent] = useState<TimekeepingSession | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [checkInBoard, setCheckInBoard] = useState<StaffDutyBoard | null>(null);
  const [timedBoard, setTimedBoard] = useState<StaffDutyBoard | null>(null);
  const [checkoutBoard, setCheckoutBoard] = useState<StaffDutyBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [contextResponse, profileResponse, currentResponse] = await Promise.all([
        workforceApi.context(), workforceApi.profile(), workforceApi.currentTimekeeping(),
      ]);
      const nextContext = contextResponse.data;
      const nextCurrent = currentResponse.data;
      const center = nextCurrent ? nextContext.centers.find((item) => item.id === nextCurrent.centerId) ?? nextContext.centers[0] : nextContext.centers[0];
      if (!center) throw new Error("Chưa có Center khả dụng cho StaffMember này.");
      const workDate = nextCurrent?.workDate ?? dayInZone(center.timeZone);
      const schedulePromise = workforceApi.schedule({ centerId: center.id, startDate: workDate, endDate: workDate });
      if (nextCurrent) {
        const [timed, checkout, schedule] = await Promise.all([
          workforceApi.dutyBoard({ centerId: center.id, workDate, action: "TIMED_MILESTONE" }),
          workforceApi.dutyBoard({ centerId: center.id, workDate, action: "CHECK_OUT" }),
          schedulePromise,
        ]);
        setCheckInBoard(null); setTimedBoard(timed.data); setCheckoutBoard(checkout.data); setAssignments(schedule.data);
      } else {
        const [checkIn, schedule] = await Promise.all([
          workforceApi.dutyBoard({ centerId: center.id, workDate, action: "CHECK_IN" }), schedulePromise,
        ]);
        setCheckInBoard(checkIn.data); setTimedBoard(null); setCheckoutBoard(null); setAssignments(schedule.data);
      }
      setContext(nextContext); setProfile(profileResponse.data); setCurrent(nextCurrent); setUpdatedAt(new Date());
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(true); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  const board = timedBoard ?? checkoutBoard ?? checkInBoard;
  const center = board ? context?.centers.find((item) => item.id === board.centerId) ?? null : null;
  const assignment = current?.assignmentId ? assignments.find((item) => item.id === current.assignmentId) ?? null : assignments[0] ?? null;
  const briefing = board?.briefing ?? null;
  const acknowledgement = board?.acknowledgement ?? null;
  const beforeDuties = checkInBoard?.duties ?? [];
  const duringDuties = timedBoard?.duties ?? [];
  const closeoutDuties = useMemo(() => {
    const values = checkoutBoard?.duties ?? [];
    return values.filter((duty) => duty.action === "CHECK_OUT" || !dutyIsResolved(duty));
  }, [checkoutBoard]);

  return <TosShell title="Việc" subtitle={profile?.displayLabel ?? "PINO Team"} theme="tasks" footerItems={TOS_TASKS_FOOTER} activeFooterId="all">
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div><span>DUTY BOARD · CORE TRUTH</span><h1>{current ? "Việc trong ca hôm nay" : "Chuẩn bị trước ca"}</h1></div>
          <button className={styles.refreshButton} disabled={refreshing} onClick={() => void load(true)}>{refreshing ? "Đang tải…" : "Làm mới"}</button>
        </div>
        <div className={styles.contextGrid}>
          <div><span>Staff</span><strong>{profile?.displayLabel ?? "—"}</strong></div>
          <div><span>Center</span><strong>{center?.displayName ?? "—"}</strong></div>
          <div><span>Ngày làm việc</span><strong>{board?.workDate ?? "—"}</strong></div>
          <div><span>Ca hiện tại</span><strong>{current ? `${assignment?.shift?.displayLabel ?? "Open session"}${assignment?.shift ? ` · ${assignment.shift.startLocalTime}–${assignment.shift.endLocalTime}` : ""}` : assignment?.shift?.displayLabel ?? "Chưa check-in"}</strong></div>
        </div>
        <p className={styles.truthNote}>Completion không được tick tại đây. Mỗi duty tự đổi trạng thái khi owning source trong Core đã hoàn tất.{updatedAt ? ` · Sync ${updatedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
      </section>

      {error ? <div className={styles.error}>{error}</div> : null}
      {loading ? <div className={styles.loading}>Đang đọc duty thật từ Core…</div> : null}

      {!loading ? <>
        <section className={styles.briefingStrip}>
          <div><span>TRƯỚC CA</span><strong>{briefing ? "Briefing hôm nay" : "Không có briefing cho ngày này"}</strong><small>{briefing ? `${briefing.items.length} mục · revision ${briefing.revision.slice(0, 8)}` : "Core không compose briefing từ ShiftAssignment hiện tại."}</small></div>
          {briefing ? <span className={acknowledgement ? styles.ackDone : styles.ackPending}>{acknowledgement ? "✓ Đã acknowledge" : "○ Chưa acknowledge"}</span> : null}
        </section>
        <DutySection eyebrow="01 · TRƯỚC CA" title="Know & Acknowledge" description="Briefing, phân công và readiness do source thật quyết định." duties={beforeDuties} empty={current ? "Ca đã bắt đầu; trạng thái briefing được giữ ở header phía trên." : "Không có duty CHECK_IN từ Core."} />
        <DutySection eyebrow="02 · TRONG CA" title="Do & Submit" description="Attendance, Diary và milestone work dẫn về owning surface. Board chỉ quan sát trạng thái." duties={duringDuties} empty={current ? "Chưa có timed milestone duty trong ca này." : "Check-in để Core bind duty với exact TimekeepingSession."} />
        <DutySection eyebrow="03 · CUỐI CA" title="Prove & Close" description="Chỉ hiện checkout-specific hoặc duty chưa resolve được carry sang closeout." duties={closeoutDuties} empty={current ? "Không còn duty unresolved ở closeout projection." : "Chưa có open TimekeepingSession để tính closeout."} />
        {board?.gate.unavailableSources.length ? <div className={styles.sourceWarning}>Source unavailable: {board.gate.unavailableSources.join(", ")}. Duty Board không tự suy đoán completion.</div> : null}
      </> : null}
    </main>
  </TosShell>;
}
