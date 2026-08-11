import { redirect } from "next/navigation";
import { canAccess } from "@/lib/authorization";
import { currentStaff } from "@/lib/repositories/current-user";
import { listStaff } from "@/lib/repositories/staff";

export const dynamic = "force-dynamic";

function teamAccessValues(): string[] {
  return (process.env.PINO_TEAM_ACCESS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export default async function TeamPage() {
  const viewer = await currentStaff();
  const allowed = teamAccessValues();

  if (!viewer || !allowed.length || !canAccess(viewer, ...allowed)) {
    redirect("/");
  }

  const staff = await listStaff();

  return (
    <div className="page">
      <div className="eyebrow">TEAM</div>
      <h1>PINO Team</h1>
      <p className="subtitle">Danh sách nhân sự lấy trực tiếp từ Notion Staff.</p>

      <div className="card">
        <div className="list">
          {staff.map((person) => {
            const meta = [person.department, ...person.functions].filter(Boolean).join(" · ");
            return (
              <div className="list-item" key={person.id}>
                <div className="row">
                  <div>
                    <strong>{person.name || "Unnamed staff"}</strong>
                    <div className="muted">{meta || "No department or function data"}</div>
                  </div>
                  <span className="pill">{person.employmentStatus || "Unspecified"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
