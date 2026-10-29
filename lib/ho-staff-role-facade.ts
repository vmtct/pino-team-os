import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { callFounderCoreWithStaffPassword, type PinoCoreBinding } from "./founder-core";
import { teamCredential, TeamAuthError } from "./team-auth";

export interface HoStaffRoleEnv extends HoEnv { PINO_CORE: PinoCoreBinding }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keyPattern = /^[a-z0-9:-]{8,120}$/i;
type AccessUser = {
  id: string; staffMemberId: string | null; status: string;
  assignments: { assignmentId: string; roleKey: string }[];
};
const response = (body: unknown, status: number) => Response.json(body, { status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
export function linkedRoleUser(rows: unknown, staffId: string, actorId: string):
  { user: AccessUser } | { error: 403 | 404 | 409 | 502 } {
  if (!Array.isArray(rows)) return { error: 502 };
  const linked = rows.filter((row): row is AccessUser =>
    Boolean(row && typeof row === "object" && row.staffMemberId === staffId));
  if (!linked.length) return { error: 404 };
  if (linked.length !== 1 || !uuid.test(linked[0]!.id) || !Array.isArray(linked[0]!.assignments))
    return { error: 502 };
  const user = linked[0]!;
  if (user.id === actorId) return { error: 403 };
  if (user.status !== "active") return { error: 409 };
  return { user };
}
type Command = { action: "assign"; roleId: string; scopeType: "GLOBAL" | "CENTER" | "PATH" | "RUNNING_CLASS"; scopeId: string | null }
  | { action: "remove"; assignmentId: string };
export function parseStaffRoleCommand(body: unknown): Command | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string,unknown>, keys = Object.keys(b);
  if (b.action === "remove" && keys.length === 2 && typeof b.assignmentId === "string" && uuid.test(b.assignmentId))
    return { action: "remove", assignmentId: b.assignmentId };
  if (b.action !== "assign" || keys.length !== 4 || typeof b.roleId !== "string" || !uuid.test(b.roleId) ||
      !["GLOBAL","CENTER","PATH","RUNNING_CLASS"].includes(String(b.scopeType))) return null;
  if (b.scopeType === "GLOBAL" && b.scopeId === null)
    return { action: "assign", roleId: b.roleId, scopeType: "GLOBAL", scopeId: null };
  if (b.scopeType !== "GLOBAL" && typeof b.scopeId === "string" && uuid.test(b.scopeId))
    return { action: "assign", roleId: b.roleId, scopeType: b.scopeType as "CENTER"|"PATH"|"RUNNING_CLASS", scopeId: b.scopeId };
  return null;
}
/** HO staging only; Staff→Access mapping and role mutations are authorized by Core. */
export async function handleHoStaffRole(request: Request, env: HoStaffRoleEnv, staffId: string): Promise<Response> {
  try {
    const uri = new URL(request.url);
    if (env.APP_ENV !== "staging" || normalizeHostname(request.headers.get("host") || uri.hostname) !== HO_STAGING_HOSTNAME ||
      !uuid.test(staffId)) return response({ error: { code: "PLATFORM_NOT_FOUND" } }, 404);
    if (request.method !== "POST") return response({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED" } }, 405);
    if (request.headers.get("origin") !== "https://" + HO_STAGING_HOSTNAME ||
        !request.headers.get("content-type")?.startsWith("application/json"))
      return response({ error: { code: "HO_REQUEST_DENIED" } }, 403);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || !keyPattern.test(idempotencyKey))
      return response({ error: { code: "PLATFORM_INVALID_INPUT" } }, 400);
    const command = parseStaffRoleCommand(await request.json().catch(() => null));
    if (!command) return response({ error: { code: "PLATFORM_INVALID_INPUT" } }, 400);
    const actor = await authorizeHoShell(request.headers, env);
    if (!actor.userId) return response({ error: { code: "HO_ACCESS_DENIED" } }, 403);
    const credential = await teamCredential(request, env, "BO");
    if (credential.kind !== "password") return response({ error: { code: "IDENTITY_UNAUTHORIZED" } }, 401);
    const directory = await callFounderCoreWithStaffPassword(env.PINO_CORE,
      { method: "GET", path: "access/users" }, credential.token);
    if (directory.status !== 200)
      return response({ error: { code: "HO_ACCESS_LOOKUP_DENIED" } },
        directory.status === 401 ? 401 : directory.status === 403 ? 403 : 503);
    const target = linkedRoleUser((directory.body as { data?: unknown } | null)?.data, staffId, actor.userId);
    if ("error" in target) return response({ error: { code: "HO_ROLE_TARGET_UNAVAILABLE" } }, target.error);
    let path: string;
    let body: Record<string,unknown>;
    if (command.action === "assign") {
      const directoryRoles = await callFounderCoreWithStaffPassword(env.PINO_CORE,
        { method: "GET", path: "access/roles" }, credential.token);
      if (directoryRoles.status !== 200)
        return response({ error: { code: "HO_ROLE_DIRECTORY_UNAVAILABLE" } },
          directoryRoles.status === 403 ? 403 : 503);
      const roles = (directoryRoles.body as { data?: unknown } | null)?.data;
      if (!Array.isArray(roles)) return response({ error: { code: "HO_ROLE_DIRECTORY_INVALID" } }, 502);
      const role = roles.find(r => r && r.id === command.roleId);
      if (!role || role.status !== "active" || role.roleKey === "founder")
        return response({ error: { code: "HO_ROLE_NOT_ASSIGNABLE" } }, 403);
      path = "access/assignments";
      body = { userId: target.user.id, roleId: command.roleId, scopeType: command.scopeType, scopeId: command.scopeId };
    } else {
      const assignment = target.user.assignments.find(a => a.assignmentId === command.assignmentId);
      if (!assignment || assignment.roleKey === "founder")
        return response({ error: { code: "HO_ASSIGNMENT_NOT_REMOVABLE" } }, 403);
      path = "access/assignments/remove";
      body = { assignmentId: command.assignmentId };
    }
    const result = await callFounderCoreWithStaffPassword(env.PINO_CORE,
      { method: "POST", path, body, idempotencyKey }, credential.token);
    return response(result.body, result.status);
  } catch (error) {
    if (error instanceof BoShellGateError) return response({ error: { code: "HO_ACCESS_DENIED" } }, error.status);
    if (error instanceof TeamAuthError) return response({ error: { code: "IDENTITY_UNAUTHORIZED" } }, error.status);
    return response({ error: { code: "HO_ROLE_UNAVAILABLE" } }, 503);
  }
}
