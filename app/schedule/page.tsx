import { currentStaffSchedule, diagnoseStaffSchedule, listStaffScheduleHistory, type ScheduleDiagnostic } from "@/lib/repositories/staff-schedule";
import { staffByUsername } from "@/lib/repositories/staff-access";
import { missingStaffProfileFields, staffProfile } from "@/lib/repositories/staff-profile";
import { getShiftRegistration } from "@/lib/repositories/shift-registration";
import { SCHEDULE_DAYS } from "@/lib/domain/staff-schedule";
import StaffProfileGate from "./StaffProfileGate";
import ScheduleLogin from "./ScheduleLogin";
import ShiftRegistration from "./ShiftRegistration";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DebugState = { traceId: string; username: string; staff: { status: string; id?: string; name?: string; email?: string; error?: string }; schedule?: ScheduleDiagnostic; scheduleError?: string };
function traceId(): string { return `sch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
function formatDate(value: string): string { if (!value) return ""; return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(value)); }
function formatRange(start: string, end: string): string { return `${formatDate(start)} — ${formatDate(end)}`; }
function dayDate(weekStart: string, offset: number): string { if (!weekStart) return ""; const date = new Date(weekStart); date.setUTCDate(date.getUTCDate() + offset); return formatDate(date.toISOString()); }
function DebugPanel({ debug }: { debug: DebugState }) { return <section className="card section" style={{ marginTop: 28, border: "2px solid #111", background: "#fafafa" }}><div className="row" style={{ alignItems: "center" }}><strong>SYSTEM DEBUG</strong><span className="pill">TRACE {debug.traceId}</span></div><pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", marginTop: 16, fontSize: 13, lineHeight: 1.55 }}>{JSON.stringify(debug, null, 2)}</pre></section>; }

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ t?: string; week?: string; debug?: string }> }) {
  const params = await searchParams;
  const username = params.t?.trim() ?? "";
  const requestedWeek = params.week?.trim() ?? "";
  const debugEnabled = params.debug === "1" || params.debug === "true";
  const trace = traceId();
  let debug: DebugState = { traceId: trace, username, staff: { status: "NOT_RUN" } };

  if (!username) return <ScheduleLogin />;

  let staff = null;
  try {
    staff = await staffByUsername(username);
    debug.staff = staff ? { status: "PASS", id: staff.id, name: staff.name, email: staff.email } : { status: "FAIL", error: "No Staff matched mobile" };
  } catch (error) { debug.staff = { status: "ERROR", error: error instanceof Error ? error.message : String(error) }; }
  if (!staff) return <ScheduleLogin error="Không tìm thấy nhân sự với số điện thoại này. Vui lòng xác nhận lại." />;

  const profile = await staffProfile(staff);
  const missing = missingStaffProfileFields(profile);
  if (missing.length) {
    return (
      <main className="main">
        <div className="page" aria-hidden="true" style={{ filter: "blur(3px)", pointerEvents: "none", userSelect: "none" }}>
          <div className="eyebrow">MY SCHEDULE</div><h1>{staff.name}</h1><p className="subtitle">Hoàn tất hồ sơ để xem lịch.</p>
        </div>
        <StaffProfileGate username={username} staffName={staff.name} profile={profile} missing={missing} />
      </main>
    );
  }

  let registration = null;
  try { registration = await getShiftRegistration(staff); }
  catch (error) { console.error("[Shift Registration] load failed", { staffId: staff.id, message: error instanceof Error ? error.message : String(error) }); }

  let history;
  try { history = await listStaffScheduleHistory(staff); }
  catch (error) { const message = error instanceof Error ? error.message : String(error); debug.scheduleError = message; return <main className="main"><div className="page"><div className="eyebrow">MY SCHEDULE</div><h1>{staff.name || "Lịch làm việc"}</h1><p className="subtitle">Không thể tải lịch lúc này.</p>{debugEnabled ? <DebugPanel debug={debug} /> : null}</div></main>; }

  if (!history.length) return <main className="main"><div className="page"><div className="eyebrow">MY SCHEDULE</div><h1>{staff.name || "Lịch làm việc"}</h1>{registration ? <ShiftRegistration username={username} initial={registration} /> : null}<p className="subtitle">Chưa có lịch làm việc.</p>{debugEnabled ? <DebugPanel debug={debug} /> : null}</div></main>;

  let schedule = requestedWeek ? history.find((item) => item.weekId === requestedWeek) ?? null : null;
  if (!schedule) schedule = history.find((item) => { const now = new Date(); const start = new Date(item.weekStart); const end = new Date(item.weekEnd); end.setHours(23, 59, 59, 999); return now >= start && now <= end; }) ?? history[0];

  if (debugEnabled) { try { debug.schedule = await diagnoseStaffSchedule(staff); } catch (error) { debug.scheduleError = error instanceof Error ? error.message : String(error); } }
  const current = history.find((item) => { const now = new Date(); const start = new Date(item.weekStart); const end = new Date(item.weekEnd); end.setHours(23, 59, 59, 999); return now >= start && now <= end; });
  const selectedIsCurrent = Boolean(current && current.weekId === schedule.weekId);

  return (
    <main className="main">
      <div className="page">
        <div className="eyebrow">MY SCHEDULE</div>
        {registration ? <ShiftRegistration username={username} initial={registration} /> : null}
        <div className="row" style={{ alignItems: "end", gap: 16 }}><div><h1>{staff.name}</h1><p className="subtitle">{schedule.weekName || "Tuần"} · {formatRange(schedule.weekStart, schedule.weekEnd)}</p></div><span className="pill">{selectedIsCurrent ? "Tuần hiện tại" : schedule.status || "—"}</span></div>
        <div className="card section" style={{ marginBottom: 24 }}><div className="muted" style={{ marginBottom: 8 }}>XEM LỊCH THEO TUẦN</div><div className="row" style={{ gap: 8, flexWrap: "wrap" }}>{history.map((item) => { const href = `/schedule?t=${encodeURIComponent(username)}&week=${encodeURIComponent(item.weekId)}${debugEnabled ? "&debug=1" : ""}`; const isSelected = item.weekId === schedule.weekId; return <a key={item.weekId} className={isSelected ? "pill" : "button"} href={href}>{item.weekName || formatRange(item.weekStart, item.weekEnd)}</a>; })}</div><p className="muted" style={{ marginBottom: 0, marginTop: 12 }}>{history.length > 1 ? "Các tuần được sắp xếp từ mới nhất đến cũ nhất." : "Chưa có tuần trước."}</p></div>
        <div className="grid grid-4">{SCHEDULE_DAYS.map(([key, label], index) => { const dayShifts = schedule.shifts[key] ?? []; return <div className="card" key={key}><div className="muted">{label} · {dayDate(schedule.weekStart, index)}</div>{dayShifts.length ? <div className="list">{dayShifts.map((shift) => <div className="list-item" key={shift.id}><div className="row"><strong>{shift.code}</strong><span className="pill">{shift.period}</span></div><div style={{ fontSize: 20, fontWeight: 750, marginTop: 8 }}>{shift.startTime} — {shift.endTime}</div></div>)}</div> : <div style={{ marginTop: 18 }} className="muted">Không có ca</div>}</div>; })}</div>
        {schedule.note ? <div className="card section"><div className="muted">Ghi chú</div><p style={{ marginBottom: 0 }}>{schedule.note}</p></div> : null}
        {debugEnabled ? <DebugPanel debug={debug} /> : null}
      </div>
    </main>
  );
}
