import { currentStaff } from "@/lib/repositories/current-user";
import { currentStaffSchedule } from "@/lib/repositories/staff-schedule";
import { SCHEDULE_DAYS } from "@/lib/domain/staff-schedule";

export const dynamic = "force-dynamic";
function formatDate(value: string): string { if (!value) return ""; return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(value)); }

export default async function SchedulePage() {
  const staff = await currentStaff();
  if (!staff) return <div className="page"><div className="eyebrow">MY SCHEDULE</div><h1>Lịch của tôi</h1><p className="subtitle">Chưa xác định được nhân sự từ identity hiện tại.</p></div>;
  const schedule = await currentStaffSchedule(staff);
  if (!schedule) return <div className="page"><div className="eyebrow">MY SCHEDULE</div><h1>Lịch của tôi</h1><p className="subtitle">Chưa có lịch được duyệt cho tuần hiện tại.</p><div className="card"><div className="muted">Nhân sự</div><div className="metric" style={{fontSize:20}}>{staff.name || "—"}</div><p className="muted">Khi lịch tuần được cập nhật trong Notion, lịch sẽ xuất hiện tại đây.</p></div></div>;
  return <div className="page">
    <div className="eyebrow">MY SCHEDULE</div>
    <div className="row" style={{alignItems:"end"}}><div><h1>Lịch của tôi</h1><p className="subtitle">{schedule.weekName || "Tuần hiện tại"} · {formatDate(schedule.weekStart)} — {formatDate(schedule.weekEnd)}</p></div><span className="pill">{schedule.status || "—"}</span></div>
    <div className="grid grid-4">
      {SCHEDULE_DAYS.map(([key, label]) => { const dayShifts = schedule.shifts[key] ?? []; return <div className="card" key={key}><div className="muted">{label}</div>{dayShifts.length ? <div className="list">{dayShifts.map((shift) => <div className="list-item" key={shift.id}><div className="row"><strong>{shift.code}</strong><span className="pill">{shift.period}</span></div><div style={{fontSize:20,fontWeight:750,marginTop:8}}>{shift.startTime} — {shift.endTime}</div></div>)}</div> : <div style={{marginTop:18}} className="muted">Không có ca</div>}</div>; })}
    </div>
    {schedule.note ? <div className="card section"><div className="muted">Ghi chú</div><p style={{marginBottom:0}}>{schedule.note}</p></div> : null}
  </div>;
}
