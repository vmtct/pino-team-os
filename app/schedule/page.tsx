import { currentStaffSchedule } from "@/lib/repositories/staff-schedule";
import { staffByUsername } from "@/lib/repositories/staff-access";
import { SCHEDULE_DAYS } from "@/lib/domain/staff-schedule";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function dayDate(weekStart: string, offset: number): string {
  if (!weekStart) return "";
  const date = new Date(weekStart);
  date.setUTCDate(date.getUTCDate() + offset);
  return formatDate(date.toISOString());
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const username = (await searchParams).t?.trim() ?? "";
  const staff = username ? await staffByUsername(username) : null;

  if (!staff) {
    return (
      <main className="main">
        <div className="page">
          <div className="eyebrow">PINO TEAM OS</div>
          <h1>Staff link không hợp lệ</h1>
          <p className="subtitle">Vui lòng sử dụng đường dẫn lịch cá nhân được PINO cấp.</p>
        </div>
      </main>
    );
  }

  let schedule;
  try {
    schedule = await currentStaffSchedule(staff);
  } catch (error) {
    console.error("[Schedule] page load failed", { staffId: staff.id, message: error instanceof Error ? error.message : String(error) });
    return (
      <main className="main">
        <div className="page">
          <div className="eyebrow">MY SCHEDULE</div>
          <h1>{staff.name || "Lịch làm việc"}</h1>
          <p className="subtitle">Không thể tải lịch lúc này.</p>
        </div>
      </main>
    );
  }

  if (!schedule) {
    return (
      <main className="main">
        <div className="page">
          <div className="eyebrow">MY SCHEDULE</div>
          <h1>{staff.name || "Lịch làm việc"}</h1>
          <p className="subtitle">Chưa có lịch được duyệt cho tuần hiện tại.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main">
      <div className="page">
        <div className="eyebrow">MY SCHEDULE</div>
        <div className="row" style={{ alignItems: "end" }}>
          <div>
            <h1>{staff.name}</h1>
            <p className="subtitle">{schedule.weekName || "Tuần hiện tại"} · {formatDate(schedule.weekStart)} — {formatDate(schedule.weekEnd)}</p>
          </div>
          <span className="pill">{schedule.status || "—"}</span>
        </div>
        <div className="grid grid-4">
          {SCHEDULE_DAYS.map(([key, label], index) => {
            const dayShifts = schedule.shifts[key] ?? [];
            return (
              <div className="card" key={key}>
                <div className="muted">{label} · {dayDate(schedule.weekStart, index)}</div>
                {dayShifts.length ? (
                  <div className="list">
                    {dayShifts.map((shift) => (
                      <div className="list-item" key={shift.id}>
                        <div className="row"><strong>{shift.code}</strong><span className="pill">{shift.period}</span></div>
                        <div style={{ fontSize: 20, fontWeight: 750, marginTop: 8 }}>{shift.startTime} — {shift.endTime}</div>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ marginTop: 18 }} className="muted">Không có ca</div>}
              </div>
            );
          })}
        </div>
        {schedule.note ? <div className="card section"><div className="muted">Ghi chú</div><p style={{ marginBottom: 0 }}>{schedule.note}</p></div> : null}
      </div>
    </main>
  );
}
