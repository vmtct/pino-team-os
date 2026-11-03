/** PAP-1300 / PAP-1097 S4: narrow authenticated BO facade for canonical Self–Item ownership.
 * Core remains the only authorization, ownership, CAS and audit authority.
 */
import { callBoAccessCoreWithCredential, type BoAccessCoreBinding, type BoAccessRequest } from "./bo-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";

export interface BoSelfItemEnv extends TeamAccessEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
}
const V7 = "[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const SELF = new RegExp("^pinoria/selfs/(" + V7 + ")/(items|catalog)$");
const COMMAND = new RegExp("^pinoria/selfs/(" + V7 + ")/items/(" + V7 + ")/(grant|revoke)$");
const CENTER = new RegExp("^" + V7 + "$");

export function isBoSelfItemPath(path: string): boolean {
  return path.startsWith("pinoria/selfs/");
}
class BadInput extends Error {}
function centerFromRequest(request: Request): string {
  const entries = [...new URL(request.url).searchParams.entries()];
  if (entries.length !== 1 || entries[0]?.[0] !== "centerId" || !CENTER.test(entries[0][1]))
    throw new BadInput("Exactly one canonical centerId is required");
  return entries[0][1];
}
function requestKey(request: Request): string {
  const key = request.headers.get("idempotency-key");
  if (!key || key.trim() !== key || key.length < 8 || key.length > 200 || /[\r\n]/.test(key))
    throw new BadInput("A bounded Idempotency-Key is required");
  return key;
}
async function commandBody(request: Request): Promise<{ expectedSelfVersion: number; reason: string }> {
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json"))
    throw new BadInput("JSON content type required");
  let raw: unknown;
  try { raw = await request.json(); } catch { throw new BadInput("Valid JSON body is required"); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new BadInput("Object body is required");
  const body = raw as Record<string,unknown>;
  if (Object.keys(body).length !== 2 || Object.keys(body).some(k => !["expectedSelfVersion","reason"].includes(k)) ||
    !Number.isSafeInteger(body.expectedSelfVersion) || Number(body.expectedSelfVersion) < 1 ||
    typeof body.reason !== "string" || !body.reason.trim() || body.reason.trim().length > 1000)
    throw new BadInput("Only expectedSelfVersion and nonempty reason are allowed");
  return { expectedSelfVersion: Number(body.expectedSelfVersion), reason: body.reason.trim() };
}
function json(body: unknown, status: number, requestId?: string) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...(requestId ? { "x-request-id": requestId } : {}) } });
}
export async function handleBoSelfItemRequest(
  request: Request, env: BoSelfItemEnv, path: string,
  keyResolver?: Parameters<typeof teamCredential>[3],
): Promise<Response> {
  try {
    if (!isBoSelfItemPath(path)) return json({ error: { code: "PLATFORM_NOT_FOUND" } }, 404);
    const read = SELF.exec(path), command = COMMAND.exec(path);
    if (!read && !command) return json({ error: { code: "PLATFORM_NOT_FOUND" } }, 404);
    if ((read && request.method !== "GET") || (command && request.method !== "POST"))
      return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED" } }, 405);
    const centerId = centerFromRequest(request);
    const key = command ? requestKey(request) : undefined;
    const body = command ? await commandBody(request) : undefined;
    const credential = await teamCredential(request, env, "BO", keyResolver);
    const coreRequest: BoAccessRequest = {
      method: request.method, path,
      resource: { centerId },
      ...(body ? { body } : {}),
      ...(key ? { idempotencyKey: key } : {}),
    };
    const result = await callBoAccessCoreWithCredential(env.PINO_BO_CORE, coreRequest, credential);
    return json(result.body, result.status, result.requestId);
  } catch (error) {
    if (error instanceof TeamAuthError)
      return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, error.status);
    if (error instanceof BadInput)
      return json({ error: { code: "PLATFORM_INVALID_INPUT", message: error.message } }, 400);
    console.error("PAP-1300 Self Item facade error", error instanceof Error ? error.name : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}