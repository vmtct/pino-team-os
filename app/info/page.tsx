import { staffByUsername } from "@/lib/repositories/staff-access";
import { staffProfile } from "@/lib/repositories/staff-profile";
import ScheduleLogin from "@/app/schedule/ScheduleLogin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InfoPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const params = await searchParams;
  const mobile = params.t?.trim() ?? "";
  if (!mobile) return <ScheduleLogin />;
  const staff = await staffByUsername(mobile);
  if (!staff) return <ScheduleLogin error="Không tìm thấy nhân sự với số điện thoại này. Vui lòng xác nhận lại." />;
  const profile = await staffProfile(staff);
  const fields: Array<[string, string]> = [
    ["Họ tên", staff.name],
    ["Email", profile.email],
    ["Ngày sinh", profile.dateOfBirth],
    ["Giới tính", profile.gender],
    ["CCCD", profile.cccd],
    ["Ngày cấp CCCD", profile.idIssueDate],
    ["Nơi cấp CCCD", profile.idIssuePlace],
    ["Địa chỉ", profile.address],
  ];
  return <main className="main"><div className="page"><div className="eyebrow">PINO TEAM OS · STAFF INFO</div><div className="row" style={{ alignItems: "end", gap: 16 }}><div><h1>{staff.name}</h1><p className="subtitle">Thông tin nhân sự · chỉ xem</p></div></div><div className="card section" style={{ marginTop: 24 }}><div className="grid" style={{ gap: 16 }}>{fields.map(([label, value]) => <div className="list-item" key={label}><div className="muted">{label}</div><div style={{ marginTop: 5, fontWeight: 700 }}>{value || "—"}</div></div>)}</div></div><div className="row" style={{ gap: 10, marginTop: 16 }}><a className="button" href={`/dashboard?t=${encodeURIComponent(mobile)}`}>Dashboard</a><a className="button" href={`/check-in?t=${encodeURIComponent(mobile)}`}>Check in/out</a><a className="button" href={`/timesheet?t=${encodeURIComponent(mobile)}`}>View Timesheets</a></div></div></main>;
}
