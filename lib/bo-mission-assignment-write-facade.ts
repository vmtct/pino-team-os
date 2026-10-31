import { callBoAccessCoreWithCredential, type BoAccessCoreBinding, type BoAccessRequest } from "./bo-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";
import { BO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";

/** PAP-1210 / Epic PAP-1188: exact BO staging-only command relay.
 * Core owns Center, Student membership, ACTIVE Mission, CAS, idempotency and audit.
 * This facade never confers management permissions from caller-supplied fields.
 */
export interface BoMissionWriteEnv extends TeamAccessEnv {
  APP_ENV?: string;
  PINO_BO_CORE: BoAccessCoreBinding;
}
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ASSIGNMENT = new RegExp("^learning/mission-assignments/(" + UUID + ")(?:/(cancel))?$", "i");
const CENTER = new RegExp("^" + UUID + "$", "i");
const KEY = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,159}$/;
const ROOT = "learning/mission-assignments";
const fail = (status: number, code: string) =>
  Response.json({ error: { code } }, { status, headers: { "cache-control": "no-store" } });
const label = (v: unknown, max: number): boolean => v === null
  || (typeof v === "string" && v.trim().length > 0 && v.trim().length <= max);
const only = (o: Record<string, unknown>, keys: string[]) =>
  Object.keys(o).every(k => keys.includes(k));
export function isBoMissionAssignmentWritePath(path: string): boolean {
  return path === ROOT || ASSIGNMENT.test(path);
}
function bodyValid(path: string, method: string, body: Record<string, unknown>): boolean {
  if (typeof body.centerId !== "string" || !CENTER.test(body.centerId)) return false;
  if (path === ROOT && method === "POST") {
    return only(body, ["centerId", "studentId", "missionId", "contextKey", "contextLabel"])
      && typeof body.studentId === "string" && CENTER.test(body.studentId)
      && typeof body.missionId === "string" && CENTER.test(body.missionId)
      && (body.contextKey === undefined || body.contextKey === null
        || (typeof body.contextKey === "string" && body.contextKey.trim().length > 0 && body.contextKey.trim().length <= 120))
      && (body.contextLabel === undefined || label(body.contextLabel, 200));
  }
  const match = ASSIGNMENT.exec(path);
  if (!match || !Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1) return false;
  if (!match[2] && method === "PUT") {
    return only(body, ["centerId", "expectedVersion", "contextLabel"])
      && Object.hasOwn(body, "contextLabel") && label(body.contextLabel, 200);
  }
  if (match[2] === "cancel" && method === "POST") {
    return only(body, ["centerId", "expectedVersion", "reason"])
      && typeof body.reason === "string" && body.reason.trim().length > 0 && body.reason.trim().length <= 500;
  }
  return false;
}
export async function handleBoMissionAssignmentWrite(
  request: Request, env: BoMissionWriteEnv, path: string,
  credentialReader: typeof teamCredential = teamCredential,
): Promise<Response> {
  const method = request.method.toUpperCase();
  const match = ASSIGNMENT.exec(path);
  if (!isBoMissionAssignmentWritePath(path)) return fail(404, "PLATFORM_NOT_FOUND");
  if (env.APP_ENV !== "staging" ||
      normalizeHostname(request.headers.get("host") || new URL(request.url).hostname) !== BO_STAGING_HOSTNAME)
    return fail(404, "PLATFORM_NOT_FOUND");
  if (!((path === ROOT && method === "POST") ||
      (match && !match[2] && method === "PUT") ||
      (match?.[2] === "cancel" && method === "POST")))
    return fail(405, "PLATFORM_METHOD_NOT_ALLOWED");
  if (request.headers.get("origin") !== "https://" + BO_STAGING_HOSTNAME ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return fail(403, "BO_MISSION_ORIGIN_DENIED");
  const key = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!KEY.test(key)) return fail(400, "PLATFORM_INVALID_INPUT");
  const query = new URL(request.url).searchParams;
  if (query.size !== 1 || query.getAll("centerId").length !== 1 || !CENTER.test(query.get("centerId") ?? ""))
    return fail(400, "PLATFORM_INVALID_INPUT");
  let data: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return fail(413, "PLATFORM_INVALID_INPUT");
    data = JSON.parse(raw);
  } catch { return fail(400, "PLATFORM_INVALID_INPUT"); }
  if (!data || typeof data !== "object" || Array.isArray(data)) return fail(400, "PLATFORM_INVALID_INPUT");
  const body = data as Record<string, unknown>;
  if (body.centerId !== query.get("centerId") || !bodyValid(path, method, body))
    return fail(400, "PLATFORM_INVALID_INPUT");
  try {
    const credential = await credentialReader(request, env, "BO");
    const coreRequest: BoAccessRequest = { method, path, body, idempotencyKey: key };
    const result = await callBoAccessCoreWithCredential(env.PINO_BO_CORE, coreRequest, credential);
    return Response.json(result.body, {
      status: result.status,
      headers: { "cache-control": "no-store", "x-request-id": result.requestId },
    });
  } catch (error) {
    if (error instanceof TeamAuthError) return fail(error.status, "IDENTITY_AUTHENTICATION_FAILED");
    return fail(503, "BO_MISSION_WRITE_UNAVAILABLE");
  }
}
