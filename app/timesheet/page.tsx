import { staffByUsername } from "@/lib/repositories/staff-access";
import { listTimesheetsForStaff } from "@/lib/repositories/timesheet";
import ScheduleLogin from "@/app/schedule/ScheduleLogin";
import TimesheetTable from "./TimesheetTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TimesheetPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const params = await searchParams;
  const mobile = params.t?.trim() ?? "";
  if (!mobile) return <ScheduleLogin />;
  const staff = await staffByUsername(mobile);
  if (!staff) return <ScheduleLogin error="Không tìm thấy nhân sự với số điện thoại này. Vui lòng xác nhận lại." />;
  let entries;
  try { entries = await listTimesheetsForStaff(staff); }
  catch (error) { return <main className="main"><div className="page"><div className="eyebrow">PINO TEAM OS · TIMESHEETS</div><h1>{staff.name}</h1><div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: "#fff1f2", color: "#991b1b" }}>{error instanceof Error ? error.message : "Không thể tải bảng chấm công."}</div></div></main>; }
  return <main className="main"><div className="page"><div className="eyebrow">PINO TEAM OS · TIMESHEETS</div><div className="row" style={{ alignItems: "end", gap: 16 }}><div><h1>{staff.name}</h1><p className="subtitle">Lịch sử chấm công · chỉ xem · GMT+7</p></div><span className="pill">{entries.length} bản ghi</span></div><TimesheetTable entries={entries} /><div className="row" style={{ gap: 10, marginTop: 16 }}><a className="button" href={`/dashboard?t=${encodeURIComponent(mobile)}`}>Dashboard</a><a className="button" href={`/info?t=${encodeURIComponent(mobile)}`}>View Info</a><a className="button" href={`/check-in?t=${encodeURIComponent(mobile)}`}>Check in/out</a></div></div></main>;
}
