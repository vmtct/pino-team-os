import type { BoAccessSystemUser } from "./bo-access-model";
import type { BoAccessRole } from "./bo-model";
export function resolveStaffRoleAccount(rows: BoAccessSystemUser[], staffId: string) {
  const matches = rows.filter(user => user.staffMemberId === staffId);
  return { user: matches.length === 1 ? matches[0]! : null, ambiguous: matches.length > 1 };
}
export function staffRoleEditorModel(user: BoAccessSystemUser | null, roles: BoAccessRole[], active: boolean, principalId: string, ambiguous: boolean) {
  const assignment = user?.assignments.length === 1 ? user.assignments[0]! : null;
  return {
    assignment,
    editable: Boolean(active && user?.status === "active" && user.id !== principalId && assignment && assignment.roleKey !== "founder" && !ambiguous),
    roles: roles.filter(role => role.status === "active" && role.roleKey !== "founder"),
  };
}
/** Existing two-command boundary: preserve scope and report partial success truthfully. */
export async function replaceStaffRole(staffId: string, assignment: BoAccessSystemUser["assignments"][number], roleId: string, fetcher: typeof fetch = fetch) {
  async function mutate(body: object) {
    const response = await fetcher("/api/ho/staff/" + encodeURIComponent(staffId) + "/role", {
      method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw Error(response.status === 403 ? "Không có quyền sửa vai trò." : "Không lưu được vai trò.");
  }
  await mutate({ action: "assign", roleId, scopeType: assignment.scopeType, scopeId: assignment.scopeId });
  try { await mutate({ action: "remove", assignmentId: assignment.assignmentId }); }
  catch { throw Error("Đã gán vai trò mới nhưng chưa gỡ được vai trò cũ. Cần kiểm tra ACL."); }
}
