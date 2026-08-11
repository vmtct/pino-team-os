import { listStaff } from "@/lib/repositories/staff";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const staff = await listStaff();
  return <div className="page"><div className="eyebrow">TEAM</div><h1>PINO Team</h1><p className="subtitle">Danh sách nhân sự lấy trực tiếp từ Notion Staff.</p><div className="card"><div className="list">{staff.map((person) => <div className="list-item" key={person.id}><div className="row"><div><strong>{person.name || "Unnamed staff"}</strong><div className="muted">{[person.department, person.role, ...person.functions].filter(Boolean).join(" · ") || "No role data"}</div></div><span className="pill">{person.employmentStatus || "Unspecified"}</span></div></div>)}</div></div></div>;
}
