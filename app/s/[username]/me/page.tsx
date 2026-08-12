import { currentStaff } from "@/lib/repositories/current-staff";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const staff = await currentStaff();
  if (!staff) return null;
  return <div className="page"><div className="eyebrow">MY SPACE</div><h1>{staff.name || "My profile"}</h1><p className="subtitle">Thông tin lấy trực tiếp từ Notion Staff.</p><div className="grid grid-3"><div className="card"><div className="muted">Department</div><div className="metric" style={{ fontSize: 20 }}>{staff.department || "—"}</div></div><div className="card"><div className="muted">Status</div><div className="metric" style={{ fontSize: 20 }}>{staff.employmentStatus || "—"}</div></div><div className="card"><div className="muted">Phone</div><div className="metric" style={{ fontSize: 20 }}>{staff.phone || "—"}</div></div></div><div className="section grid grid-2"><div className="card"><h2>Functions</h2><div className="list">{staff.functions.length ? staff.functions.map((item) => <div className="list-item" key={item}><strong>{item}</strong></div>) : <div className="list-item"><span className="muted">Chưa có dữ liệu</span></div>}</div></div><div className="card"><h2>Programs</h2><p className="muted">{staff.programs.length ? `${staff.programs.length} chương trình được liên kết.` : "Chưa có chương trình được liên kết."}</p></div></div></div>;
}
