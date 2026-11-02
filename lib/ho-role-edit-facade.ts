import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { callBoAccessCoreWithStaffPassword, type BoAccessCoreBinding } from "./bo-core";
import { teamCredential, TeamAuthError } from "./team-auth";

export interface HoRoleEditEnv extends HoEnv { PINO_BO_CORE: BoAccessCoreBinding }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keyPattern = /^[a-zA-Z0-9:_-]{8,120}$/;
const permissionPattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const json = (body: unknown, status: number) => Response.json(body, { status, headers: {
  "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
} });
type RoleEdit = { displayName: string; description: string | null; permissionKeys: string[]; expectedUpdatedAt: string };

export function parseHoRoleEdit(body: unknown): RoleEdit | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (Object.keys(b).length !== 4 || ["displayName","description","permissionKeys","expectedUpdatedAt"].some(k => !(k in b))) return null;
  if (typeof b.displayName !== "string" || !b.displayName.trim() || b.displayName.trim().length > 120) return null;
  if (b.description !== null && (typeof b.description !== "string" || b.description.trim().length > 500)) return null;
  if (!Array.isArray(b.permissionKeys) || b.permissionKeys.length > 500 ||
      b.permissionKeys.some(k => typeof k !== "string" || !permissionPattern.test(k)) ||
      new Set(b.permissionKeys).size !== b.permissionKeys.length) return null;
  if (typeof b.expectedUpdatedAt !== "string" || b.expectedUpdatedAt.length > 48 ||
      !Number.isFinite(Date.parse(b.expectedUpdatedAt))) return null;
  return {
    displayName: b.displayName.trim(),
    description: typeof b.description === "string" ? b.description.trim() || null : null,
    permissionKeys: [...b.permissionKeys].sort(),
    expectedUpdatedAt: b.expectedUpdatedAt,
  };
}
function rows(body: unknown): unknown[] | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const data = (body as { data?: unknown }).data;
  return Array.isArray(data) ? data : null;
}
type RoleDetail = { id: string; roleKey: string; roleType: "system" | "custom"; status: string; updatedAt: string; permissionKeys: string[] };
function detail(body: unknown): RoleDetail | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const d = (body as { data?: unknown }).data;
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  const role = d as RoleDetail;
  return typeof role.id === "string" && typeof role.roleKey === "string" &&
    typeof role.updatedAt === "string" && Array.isArray(role.permissionKeys) ? role : null;
}
/** Staging-only HO write, bound to live Founder pilot + Core role.edit authorization. */
export async function handleHoRoleEdit(request: Request, env: HoRoleEditEnv, roleId: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (env.APP_ENV !== "staging" ||
        normalizeHostname(request.headers.get("host") || url.hostname) !== HO_STAGING_HOSTNAME ||
        !uuid.test(roleId)) return json({ error: { code: "PLATFORM_NOT_FOUND" } }, 404);
    if (request.method !== "POST") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED" } }, 405);
    if (request.headers.get("origin") !== "https://" + HO_STAGING_HOSTNAME ||
        !request.headers.get("content-type")?.startsWith("application/json")) return json({ error: { code: "HO_REQUEST_DENIED" } }, 403);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || !keyPattern.test(idempotencyKey)) return json({ error: { code: "PLATFORM_INVALID_INPUT" } }, 400);
    const command = parseHoRoleEdit(await request.json().catch(() => null));
    if (!command) return json({ error: { code: "PLATFORM_INVALID_INPUT" } }, 400);
    const actor = await authorizeHoShell(request.headers, env);
    if (!actor.userId || !actor.permissionKeys.includes("access.role.edit"))
      return json({ error: { code: "HO_ROLE_EDIT_DENIED" } }, 403);
    const credential = await teamCredential(request, env, "BO");
    if (credential.kind !== "password") return json({ error: { code: "IDENTITY_UNAUTHORIZED" } }, 401);
    const readRole = await callBoAccessCoreWithStaffPassword(env.PINO_BO_CORE,
      { method: "GET", path: "access/roles/" + roleId }, credential.token);
    if (readRole.status !== 200) return json({ error: { code: "HO_ROLE_LOOKUP_DENIED" } },
      [401,403,404].includes(readRole.status) ? readRole.status : 503);
    const current = detail(readRole.body);
    if (!current || current.id !== roleId) return json({ error: { code: "HO_ROLE_INVALID" } }, 502);
    if (current.roleType !== "custom" || current.roleKey === "founder" || current.status !== "active")
      return json({ error: { code: "HO_ROLE_PROTECTED" } }, 403);
    if (current.updatedAt !== command.expectedUpdatedAt)
      return json({ error: { code: "HO_ROLE_VERSION_CONFLICT" } }, 409);
    const catalog = await callBoAccessCoreWithStaffPassword(env.PINO_BO_CORE,
      { method: "GET", path: "access/permissions" }, credential.token);
    if (catalog.status !== 200) return json({ error: { code: "HO_PERMISSION_CATALOG_DENIED" } },
      [401,403].includes(catalog.status) ? catalog.status : 503);
    const data = rows(catalog.body);
    if (!data) return json({ error: { code: "HO_PERMISSION_CATALOG_INVALID" } }, 502);
    const approved = new Set(data.filter((x): x is { key: string } =>
      Boolean(x && typeof x === "object" && "key" in x && typeof x.key === "string"))
      .map(x => x.key));
    if (command.permissionKeys.some(key => !approved.has(key) || !actor.permissionKeys.includes(key)))
      return json({ error: { code: "HO_ROLE_PERMISSION_ESCALATION" } }, 403);
    const result = await callBoAccessCoreWithStaffPassword(env.PINO_BO_CORE, {
      method: "POST", path: "access/roles/" + roleId + "/update", body: command, idempotencyKey,
    }, credential.token);
    return json(result.body, result.status);
  } catch (error) {
    if (error instanceof BoShellGateError) return json({ error: { code: "HO_ACCESS_DENIED" } }, error.status);
    if (error instanceof TeamAuthError) return json({ error: { code: "IDENTITY_UNAUTHORIZED" } }, error.status);
    return json({ error: { code: "HO_ROLE_EDIT_UNAVAILABLE" } }, 503);
  }
}
