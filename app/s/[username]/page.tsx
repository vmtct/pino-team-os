import { currentStaff } from "@/lib/repositories/current-staff";

export const dynamic = "force-dynamic";

export default async function StaffHomePage() {
  const staff = await currentStaff();
  if (!staff) return null;
  return <div className="page"><div className="eyebrow">PINO TEAM OS</div><h1>{staff.name || "PINO Team"}</h1><p className="subtitle">Không gian làm việc cá nhân của bạn.</p><div className="grid grid-3"><div className="card"><div className="muted">Department</div><div className="metric" style={{ fontSize: 20 }}>{staff.department || "—"}</div></div><div className="card"><div className="muted">Status</div><div className="metric" style={{ fontSize: 20 }}>{staff.employmentStatus || "—"}</div></div><div className="card"><div className="muted">Functions</div><div className="metric" style={{ fontSize: 20 }}>{staff.functions.length}</div></div></div><div className="section grid grid-2"><div className="card"><h2>My Schedule</h2><p className="muted">Xem ca làm theo tuần từ Notion Staff Schedule.</p></div><div className="card"><h2>My Space</h2><p className="muted">Thông tin nhân sự, functions và trạng thái làm việc.</p></div></div></div>;
}
