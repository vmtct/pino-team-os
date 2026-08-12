import { currentStaffSchedule, diagnoseStaffSchedule, type ScheduleDiagnostic } from "@/lib/repositories/staff-schedule";
import { staffByUsername } from "@/lib/repositories/staff-access";
import { SCHEDULE_DAYS } from "@/lib/domain/staff-schedule";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DebugState = {
  traceId: string;
  username: string;
  staff: { status: string; id?: string; name?: string; email?: string; error?: string };
  schedule?: ScheduleDiagnostic;
  scheduleError?: string;
};

function traceId(): string {
  return `sch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

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

function DebugPanel({ debug }: { debug: DebugState }) {
  return (
    <section className="card section" style={{ marginTop: 28, border: "2px solid #111", background: "#fafafa" }}>
      <div className="row" style={{ alignItems: "center" }}>
        <strong>SYSTEM DEBUG</strong>
        <span className="pill">TRACE {debug.traceId}</span>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", marginTop: 16, fontSize: 13, lineHeight: 1.55 }}>
        {JSON.stringify(debug, null, 2)}
      </pre>
    </section>
  );
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ t?: string; debug?: string }> }) {
  const params = await searchParams;
  const username = params.t?.trim() ?? "";
  const debugEnabled = params.debug === "1" || params.debug === "true";
  const trace = traceId();
  let debug: DebugState = { traceId: trace, username, staff: { status: "NOT_RUN" } };

  let staff = null;
  try {
    staff = username ? await staffByUsername(username) : null;
    debug.staff = staff
      ? { status: "PASS", id: staff.id, name: staff.name, email: staff.email }
      : { status: "FAIL", error: username ? "No Staff matched username" : "Missing query parameter t" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debug.staff = { status: "ERROR", error: message };
  }

  if (!staff) {
    return (
      <main className="main">
        <div className="page">
          <div className="eyebrow">PINO TEAM OS</div>
          <h1>Staff link không hợp lệ</h1>
          <p className="subtitle">Vui lòng sử dụng đường dẫn lịch cá nhân được PINO cấp.</p>
          {debugEnabled ? <DebugPanel debug={debug} /> : null}
        </div>
      </main>
    );
  }

  let schedule;
  try {
    if (debugEnabled) {
      debug.schedule = await diagnoseStaffSchedule(staff);
    }
    schedule = await currentStaffSchedule(staff);
    if (debugEnabled && debug.schedule) {
      debug.schedule.result.reason = schedule ? "ok" : debug.schedule.result.reason === "ok" ? "current week resolved but schedule mapping returned null" : debug.schedule.result.reason;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debug.scheduleError = message;
    console.error("[Schedule] page load failed", { traceId: trace, staffId: staff.id, message });
  }

  if (!schedule) {
    return (
      <main className="main">
        <div className="page">
          <div className="eyebrow">MY SCHEDULE</div>
          <h1>{staff.name || "Lịch làm việc"}</h1>
          <p className="subtitle">Chưa có lịch được duyệt cho tuần hiện tại.</p>
          {debugEnabled ? <DebugPanel debug={debug} /> : null}
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
        {debugEnabled ? <DebugPanel debug={debug} /> : null}
      </div>
    </main>
  );
}
