import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { callFounderCoreWithStaffPassword, type PinoCoreBinding } from "./founder-core";
import { teamCredential, TeamAuthError } from "./team-auth";

export interface HoStaffPasswordResetEnv extends HoEnv { PINO_CORE: PinoCoreBinding }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keyPattern = /^[a-z0-9:-]{8,120}$/i;
const json = (body: unknown, status: number) => Response.json(body, { status, headers: {
  "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
} });
type AccessUser = { id: string; staffMemberId: string | null; status: string };
export function resetTarget(users: unknown, staffId: string, actorId: string):
  { status: 200; userId: string } | { status: 403 | 404 | 409 | 502 } {
  if (!Array.isArray(users)) return { status: 502 };
  const linked = users.filter((row): row is AccessUser =>
    Boolean(row && typeof row === "object" && row.staffMemberId === staffId));
  if (linked.length === 0) return { status: 404 };
  if (linked.length !== 1 || !uuid.test(linked[0]!.id)) return { status: 502 };
  const target = linked[0]!;
  if (target.id === actorId) return { status: 403 };
  if (target.status !== "active") return { status: 409 };
  return { status: 200, userId: target.id };
}
/** HO is staging only; the target is resolved server-side, never accepted from client input.
 * Core Access remains the authority for permission, Founder protection, status and revocation. */
export async function handleHoStaffPasswordReset(request: Request, env: HoStaffPasswordResetEnv, staffId: string): Promise<Response> {
  try {
    const uri = new URL(request.url);
    if (env.APP_ENV !== "staging" ||
      normalizeHostname(request.headers.get("host") || uri.hostname) !== HO_STAGING_HOSTNAME ||
      !uuid.test(staffId)) return json({ error: { code: "PLATFORM_NOT_FOUND" } }, 404);
    if (request.method !== "POST") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED" } }, 405);
    if (request.headers.get("origin") !== "https://" + HO_STAGING_HOSTNAME ||
      !request.headers.get("content-type")?.startsWith("application/json")) return json({ error: { code: "HO_REQUEST_DENIED" } }, 403);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || !keyPattern.test(idempotencyKey)) return json({ error: { code: "PLATFORM_INVALID_INPUT" } }, 400);
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 0)
      return json({ error: { code: "PLATFORM_INVALID_INPUT" } }, 400);

    const actor = await authorizeHoShell(request.headers, env);
    if (!actor.userId) return json({ error: { code: "HO_ACCESS_DENIED" } }, 403);
    const credential = await teamCredential(request, env, "BO");
    if (credential.kind !== "password") return json({ error: { code: "IDENTITY_UNAUTHORIZED" } }, 401);

    const directory = await callFounderCoreWithStaffPassword(env.PINO_CORE,
      { method: "GET", path: "access/users" }, credential.token);
    if (directory.status !== 200) return json({ error: { code: "HO_ACCESS_LOOKUP_DENIED" } },
      directory.status === 401 ? 401 : directory.status === 403 ? 403 : 503);
    const payload = directory.body as { data?: unknown } | null;
    const target = resetTarget(payload?.data, staffId, actor.userId);
    if (target.status !== 200) return json({ error: { code: "HO_RESET_TARGET_UNAVAILABLE" } }, target.status);
    const result = await callFounderCoreWithStaffPassword(env.PINO_CORE, {
      method: "POST", path: `access/users/${target.userId}/staff-password/reset`,
      body: {}, idempotencyKey,
    }, credential.token);
    return json(result.body, result.status);
  } catch (error) {
    if (error instanceof BoShellGateError) return json({ error: { code: "HO_ACCESS_DENIED" } }, error.status);
    if (error instanceof TeamAuthError) return json({ error: { code: "IDENTITY_UNAUTHORIZED" } }, error.status);
    return json({ error: { code: "HO_PASSWORD_RESET_UNAVAILABLE" } }, 503);
  }
}
