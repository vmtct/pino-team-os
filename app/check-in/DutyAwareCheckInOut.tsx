"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TosShell } from "@/app/components/tos-shell";
import { TOS_SHIFT_FOOTER } from "@/app/components/tos-shell/navigation";
import { briefingCheckInReady, isCurrentBriefingAcknowledged } from "@/lib/wfm-duty-briefing-ui";
import { closeoutGuidanceState } from "@/lib/wfm-duty-closeout-ui";
import { dutyDeepLink, dutyIsResolved, dutySourceLabel, dutyStatusLabel, dutyTitle } from "@/lib/wfm-duty-ui";
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
import styles from "./check-in.module.css";

function dayInZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function apiMessage(error: unknown) {
  if (error instanceof WorkforceApiError) {
    if (error.status === 401) return "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";
    if (error.status === 403) return "Tài khoản hiện chưa có quyền thực hiện thao tác này.";
    if (error.status === 409) return "Dữ liệu ca vừa thay đổi. Hãy tải lại trước khi tiếp tục.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Không thể tải duty context từ Core.";
}

function CloseoutDuty({ duty }: { duty: StaffDutyObligation }) {
  const href = dutyDeepLink(duty);
  const resolved = dutyIsResolved(duty);
  return <article className={`${styles.closeoutItem} ${resolved ? styles.closeoutDone : ""}`}>
    <div className={styles.closeoutTop}>
      <span>{dutySourceLabel(duty)}</span>
      <b>{dutyStatusLabel(duty)}</b>
    </div>
    <h3>{dutyTitle(duty)}</h3>
    <small>{duty.sourceRef}</small>
    {href ? <Link href={href}>{resolved ? "Mở nguồn" : "Đi xử lý"}<span>→</span></Link> : <em>Không có Team owning surface.</em>}
  </article>;
}

export default function DutyAwareCheckInOut() {
  const router = useRouter();
  const [context, setContext] = useState<WorkforceContext | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [current, setCurrent] = useState<TimekeepingSession | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [board, setBoard] = useState<StaffDutyBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(""); setBoard(null);
    try {
      const [contextResponse, profileResponse, currentResponse] = await Promise.all([
        workforceApi.context(), workforceApi.profile(), workforceApi.currentTimekeeping(),
      ]);
      const nextContext = contextResponse.data;
      const nextCurrent = currentResponse.data;
      setContext(nextContext); setProfile(profileResponse.data); setCurrent(nextCurrent);
      const center = nextCurrent ? nextContext.centers.find((item) => item.id === nextCurrent.centerId) ?? nextContext.centers[0] : nextContext.centers[0];
      if (!center) throw new Error("Chưa có Center khả dụng cho StaffMember này.");
      const workDate = nextCurrent?.workDate ?? dayInZone(center.timeZone);
      const [schedule, nextBoard] = await Promise.all([
        workforceApi.schedule({ centerId: center.id, startDate: workDate, endDate: workDate }),
        workforceApi.dutyBoard({ centerId: center.id, workDate, action: nextCurrent ? "CHECK_OUT" : "CHECK_IN" }),
      ]);
      setAssignments(schedule.data); setBoard(nextBoard.data);
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  const center = useMemo(() => {
    const centerId = current?.centerId ?? board?.centerId;
    return context?.centers.find((item) => item.id === centerId) ?? context?.centers[0] ?? null;
  }, [board?.centerId, context, current?.centerId]);
  const assignment = current?.assignmentId
    ? assignments.find((item) => item.id === current.assignmentId) ?? null
    : assignments[0] ?? null;
  const briefing = !current ? board?.briefing ?? null : null;
  const acknowledgement = !current ? board?.acknowledgement ?? null : null;
  const acknowledged = isCurrentBriefingAcknowledged(briefing, acknowledgement);
  const checkInReady = briefingCheckInReady({ boardLoaded: Boolean(!current && board), briefing, acknowledgement });
  const closeout = closeoutGuidanceState(current ? board : null);

  async function acknowledge() {
    if (!briefing) return;
    setBusy("ack"); setError("");
    try {
      await workforceApi.acknowledgeDutyBriefing({
        centerId: briefing.centerId,
        workDate: briefing.workDate,
        briefingRef: briefing.briefingRef,
        briefingRevision: briefing.revision,
      });
      await load();
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setBusy(""); }
  }

  async function checkIn() {
    if (!center || !checkInReady) return;
    setBusy("check-in"); setError("");
    try {
      await workforceApi.checkIn(center.id, assignment?.id ?? null);
      router.push("/tasks");
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setBusy(""); }
  }

  async function checkOut() {
    if (!current || !closeout.ready) return;
    setBusy("check-out"); setError("");
    try {
      await workforceApi.checkOut();
      await load();
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setBusy(""); }
  }

  return <TosShell
    title="Ca làm"
    subtitle={center?.displayName ?? profile?.displayLabel ?? "PINO Team"}
    theme="shift"
    footerItems={TOS_SHIFT_FOOTER}
    activeFooterId="check"
  >
    <main className={styles.page}>
      {error ? <div className={styles.error}>{error}</div> : null}
      {loading ? <div className={styles.loading}>Đang đọc ca và duty context từ Core…</div> : null}

      {!loading && !current ? <>
        <section className={styles.shiftCard}>
          <span>CA HÔM NAY</span>
          <h1>{assignment?.shift?.displayLabel ?? "Ca làm"}</h1>
          <p>{assignment?.shift ? `${assignment.shift.startLocalTime}–${assignment.shift.endLocalTime}` : "Không có ShiftAssignment active trong ngày."}</p>
          <small>{board?.workDate ?? "—"} · {center?.displayName ?? "—"}</small>
        </section>
        <section className={styles.briefingCard}>
          <div className={styles.sectionHeader}>
            <div><span>BRIEFING HÔM NAY</span><h2>{briefing ? "Đọc trước khi vào ca" : board ? "Không có briefing" : "Chưa tải được briefing"}</h2></div>
            {briefing ? <b className={acknowledged ? styles.done : styles.pending}>{acknowledged ? "✓ Đã đọc" : "○ Cần đọc"}</b> : null}
          </div>
          {briefing ? <div className={styles.briefingList}>
            {briefing.items.map((item) => <article key={item.key} className={styles.briefingItem}>
              <div><strong>{item.label}</strong><small>{item.sourceDomain}</small></div>
              <span>{item.value}</span>
              <em>{item.critical ? "Bắt buộc" : "Thông tin"}</em>
            </article>)}
          </div> : <p className={styles.empty}>{board ? "Core không compose briefing từ current ShiftAssignment." : "Duty context chưa sẵn sàng; Check-in giữ khóa."}</p>}
          {briefing ? <div className={styles.revision}>Revision <code>{briefing.revision.slice(0, 12)}</code></div> : null}
          {briefing && !acknowledged ? <button className={styles.ackButton} disabled={Boolean(busy)} onClick={() => void acknowledge()}>{busy === "ack" ? "Đang lưu…" : "Đã đọc & hiểu"}</button> : null}
        </section>

        <section className={styles.actionCard}>
          <div><span>CHECK IN</span><strong>{checkInReady ? "Sẵn sàng vào ca" : "Hoàn tất briefing trước"}</strong></div>
          <button className={styles.checkInButton} disabled={!checkInReady || Boolean(busy)} onClick={() => void checkIn()}>{busy === "check-in" ? "Đang check-in…" : "Check-in"}</button>
          {!checkInReady ? <p>Đây là TOS guidance gate. WFM-TIME mutation vẫn giữ nguyên authority và chưa bật hard enforcement.</p> : null}
        </section>
      </> : null}
      {!loading && current ? <>
        <section className={styles.shiftCard}>
          <span>ĐANG TRONG CA</span>
          <h1>{assignment?.shift?.displayLabel ?? "Open TimekeepingSession"}</h1>
          <p>Check-in {new Date(current.checkInAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</p>
          <small>{current.workDate} · {center?.displayName ?? "—"}</small>
        </section>

        <section className={styles.closeoutCard}>
          <div className={styles.sectionHeader}>
            <div><span>PROVE & CLOSE</span><h2>Closeout trước khi rời ca</h2></div>
            <b className={closeout.ready ? styles.done : styles.pending}>{closeout.ready ? "✓ Sạch" : `${closeout.outstanding.length} việc`}</b>
          </div>
          {board ? board.duties.length
            ? <div className={styles.closeoutList}>{board.duties.map((duty) => <CloseoutDuty key={`${duty.obligationId}:${duty.sourceRef}`} duty={duty} />)}</div>
            : <p className={styles.empty}>Core không trả duty nào cho CHECK_OUT.</p>
            : <p className={styles.empty}>CHECK_OUT duty context chưa sẵn sàng; Checkout giữ khóa.</p>}
          {closeout.ambiguous && board ? <div className={styles.closeoutWarning}>Duty truth đang unavailable hoặc ambiguous. Không suy đoán completion.</div> : null}
        </section>

        <section className={styles.actionCard}>
          <div><span>CHECK OUT</span><strong>{closeout.ready ? "Sẵn sàng checkout" : closeout.ambiguous ? "Đang chờ duty truth" : `${closeout.outstanding.length} duty cần xử lý`}</strong></div>
          <button className={styles.checkoutButton} disabled={!closeout.ready || Boolean(busy)} onClick={() => void checkOut()}>{busy === "check-out" ? "Đang checkout…" : "Checkout"}</button>
          {closeout.outstanding.length ? <Link className={styles.dutyBoardLink} href="/tasks">Mở toàn bộ Duty Board <span>→</span></Link> : null}
          {!closeout.ready ? <p>Đây là TOS guidance gate. Core WFM-DUTY vẫn ADVISORY và WFM-TIME chưa bật production denial.</p> : null}
        </section>
      </> : null}
    </main>
  </TosShell>;
}
