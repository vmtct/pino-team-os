import { callBoAccessCoreWithCredential, type BoAccessCoreBinding, type BoAccessRequest } from "./bo-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";
import { BO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";

/**
 * PAP-1210 / Epic PAP-1676 MISSION-ASSIGNMENT.
 * BO BFF facade for the independent Completion projection and narrow Manager Reopen.
 * Server-side Core validates actor, role, Center, Assignment, CAS and replay.
 * Existing BO general Assignment Create/Edit/Cancel remains owned by PAP-1678 cutover.
 */
export interface BoMissionCompletionEnv extends TeamAccessEnv {
  APP_ENV?: string;
  PINO_BO_CORE: BoAccessCoreBinding;
}
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const centerPattern = new RegExp("^" + uuid + "$", "i");
const completion = new RegExp("^learning/mission-assignments/(" + uuid + ")/(execution|completion-history|reopen)$", "i");
const keyPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,159}$/;
const fail = (status: number, code: string) => Response.json({ error: { code } }, {
  status, headers: { "cache-control": "no-store" },
});
const json = (body: unknown, status: number, requestId: string) => Response.json(body, {
  status, headers: { "cache-control": "no-store", "x-request-id": requestId },
});
export const isBoMissionCompletionPath = (path: string): boolean => completion.test(path);

function validReadScope(url: URL, kind: string): { centerId: string; query: string } | null {
  const params = url.searchParams;
  if (!centerPattern.test(params.get("centerId") ?? "") || params.getAll("centerId").length !== 1) return null;
  const allowed = kind === "execution" ? ["centerId"] : ["centerId", "limit", "offset"];
  for (const name of params.keys()) {
    if (!allowed.includes(name) || params.getAll(name).length !== 1) return null;
  }
  if (kind === "completion-history") {
    if (params.has("limit")) {
      const limit = params.get("limit")!;
      if (!/^[1-9]\d*$/.test(limit) || Number(limit) > 100) return null;
    }
    if (params.has("offset")) {
      const offset = params.get("offset")!;
      if (!/^(0|[1-9]\d*)$/.test(offset) || Number(offset) > 10000) return null;
    }
  }
  return { centerId: params.get("centerId")!, query: params.toString() };
}
function validReopenBody(value: unknown): value is { centerId: string; expectedVersion: number; reason: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const b = value as Record<string, unknown>;
  return Object.keys(b).every(k => ["centerId", "expectedVersion", "reason"].includes(k))
    && typeof b.centerId === "string" && centerPattern.test(b.centerId)
    && Number.isSafeInteger(b.expectedVersion) && Number(b.expectedVersion) >= 1
    && typeof b.reason === "string" && b.reason.trim().length >= 10
    && b.reason.trim().length <= 500 && b.reason.trim() === b.reason;
}
export async function handleBoMissionCompletionRequest(
  request: Request, env: BoMissionCompletionEnv, path: string,
  credentialReader: typeof teamCredential = teamCredential,
): Promise<Response> {
  const matched = completion.exec(path);
  if (!matched) return fail(404, "PLATFORM_NOT_FOUND");
  const url = new URL(request.url);
  if (env.APP_ENV !== "staging" ||
      normalizeHostname(request.headers.get("host") || url.hostname) !== BO_STAGING_HOSTNAME ||
      url.hostname !== BO_STAGING_HOSTNAME ||
      url.pathname !== "/api/bo/" + path) return fail(404, "PLATFORM_NOT_FOUND");
  const kind = matched[2]!.toLowerCase();
  const method = request.method.toUpperCase();
  if ((kind === "reopen" && method !== "POST") || (kind !== "reopen" && method !== "GET"))
    return fail(405, "PLATFORM_METHOD_NOT_ALLOWED");

  let coreRequest: BoAccessRequest;
  if (method === "GET") {
    const scope = validReadScope(url, kind);
    if (!scope) return fail(400, "PLATFORM_INVALID_INPUT");
    coreRequest = { method, path: path + "?" + scope.query, resource: { centerId: scope.centerId } };
  } else {
    if (url.search || request.headers.get("origin") !== "https://" + BO_STAGING_HOSTNAME)
      return fail(403, "BO_MISSION_ORIGIN_DENIED");
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
      return fail(400, "PLATFORM_INVALID_INPUT");
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
    if (!keyPattern.test(idempotencyKey)) return fail(400, "PLATFORM_INVALID_INPUT");
    let body: unknown;
    try {
      const raw = await request.text();
      if (raw.length > 4096) return fail(413, "PLATFORM_INVALID_INPUT");
      body = JSON.parse(raw);
    } catch { return fail(400, "PLATFORM_INVALID_INPUT"); }
    if (!validReopenBody(body)) return fail(400, "PLATFORM_INVALID_INPUT");
    coreRequest = { method, path, resource: { centerId: body.centerId }, body, idempotencyKey };
  }
  try {
    const credential = await credentialReader(request, env, "BO");
    const result = await callBoAccessCoreWithCredential(env.PINO_BO_CORE, coreRequest, credential);
    return json(result.body, result.status, result.requestId);
  } catch (error) {
    if (error instanceof TeamAuthError) return fail(error.status, "IDENTITY_AUTHENTICATION_FAILED");
    return fail(503, "BO_MISSION_COMPLETION_UNAVAILABLE");
  }
}
