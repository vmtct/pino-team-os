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

/** PAP-1345 — staging-only Founder QA allowance. No general Access administration UI. */
export const TV_QA_USER_ID = "01a0b922-8911-7adc-b132-d0a10b7cb269";
export const TV_QA_STAFF_ID = "01a0b922-8911-7efe-a5e5-40ae89e768bf";
export const TV_QA_CENTER_ID = "01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
export const TV_QA_ROLE_KEY = "pap1243-tvlaunch-cantho-qa-staging";

export type TvQaGrantPlan =
  | { kind: "denied"; reason: string }
  | { kind: "already"; roleId: string; assignmentId: string; otherAssignmentIds: string[] }
  | { kind: "ready"; roleId: string; expiredAssignmentId: string | null; otherAssignmentIds: string[] };

export function planTvQaGrant(
  user: BoAccessSystemUser | null,
  roles: readonly BoAccessRole[],
  now = Date.now(),
): TvQaGrantPlan {
  if (!user || user.id !== TV_QA_USER_ID || user.staffMemberId !== TV_QA_STAFF_ID || user.status !== "active")
    return { kind: "denied", reason: "QA target is unavailable" };
  const eligible = roles.filter(role => role.roleKey === TV_QA_ROLE_KEY && role.status === "active" &&
    role.roleType === "custom" && role.permissionCount === 1);
  if (eligible.length !== 1) return { kind: "denied", reason: "QA role identity is unavailable or ambiguous" };
  const role = eligible[0]!;
  const matches = user.assignments.filter(a => a.roleId === role.id &&
    a.scopeType === "CENTER" && a.scopeId === TV_QA_CENTER_ID);
  if (matches.length > 1) return { kind: "denied", reason: "Duplicate QA assignments require reconciliation" };
  const same = matches[0] ?? null;
  const starts = same ? Date.parse(same.effectiveFrom) : NaN;
  const expires = same?.effectiveUntil ? Date.parse(same.effectiveUntil) : Infinity;
  if (same && Number.isFinite(starts) && starts <= now && expires > now)
    return { kind: "already", roleId: role.id, assignmentId: same.assignmentId, otherAssignmentIds: user.assignments.filter(a => a.assignmentId !== same.assignmentId).map(a => a.assignmentId) };
  if (same && (!Number.isFinite(starts) || Number.isNaN(expires) || expires > now))
    return { kind: "denied", reason: "QA assignment state is ambiguous" };
  return {
    kind: "ready", roleId: role.id,
    expiredAssignmentId: same?.assignmentId ?? null,
    otherAssignmentIds: user.assignments.filter(a => a.assignmentId !== same?.assignmentId).map(a => a.assignmentId),
  };
}

export function verifyTvQaReadback(
  user: BoAccessSystemUser | null,
  baselineOtherIds: readonly string[],
  roleId: string,
  now = Date.now(),
): boolean {
  if (!user || user.id !== TV_QA_USER_ID || user.staffMemberId !== TV_QA_STAFF_ID || user.status !== "active") return false;
  if (!baselineOtherIds.every(id => user.assignments.some(a => a.assignmentId === id))) return false;
  const matches = user.assignments.filter(a => a.roleId === roleId &&
    a.scopeType === "CENTER" && a.scopeId === TV_QA_CENTER_ID);
  return matches.length === 1 && matches[0]!.effectiveUntil === null &&
    Date.parse(matches[0]!.effectiveFrom) <= now;
}

/** Existing HO Founder-only API already supports additive assign/remove through Core ACL. */
export async function writeTvQaStaffCommand(
  staffId: string,
  command: { action: "assign"; roleId: string; scopeType: "CENTER"; scopeId: string } |
    { action: "remove"; assignmentId: string },
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (staffId !== TV_QA_STAFF_ID) throw Error("Invalid synthetic Staff target");
  if (command.action === "assign" &&
    (command.scopeType !== "CENTER" || command.scopeId !== TV_QA_CENTER_ID))
    throw Error("Invalid QA Center scope");
  const response = await fetcher("/api/ho/staff/" + encodeURIComponent(staffId) + "/role", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw Error("HO Founder Access command denied (" + response.status + ")");
}
