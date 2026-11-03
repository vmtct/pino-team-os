import { authorizeHoShell } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { teamCredential, TeamAuthError } from "./team-auth";
import type { HoGlobalTermWeeksEnv } from "./ho-global-termweeks-read-facade";
import { GLOBAL_TERMS_API, GLOBAL_TERMS_PERMISSION, isGlobalTermsRequest, object, parseCoreTerm, parseCoreTermDetail, parseCoreTermList, parseTermCommand } from "./ho-global-terms-contract";

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
const error = (code: string, status: number) => json({ error: { code } }, status);
/** Server-only live Core identity proof; a pilot ID or a permission is insufficient. */
export function hasLiveFounder(users: unknown, userId: string, now = Date.now()): boolean {
  if (!Array.isArray(users)) return false;
  const user = users.map(object).find(u => u?.id === userId);
  return user?.status === "active" && Array.isArray(user.assignments) && user.assignments.some(raw => {
    const a = object(raw);
    return a?.roleKey === "founder" && a.roleType === "system" && a.roleStatus === "active" && a.scopeType === "GLOBAL" && a.scopeId === null &&
      typeof a.effectiveFrom === "string" && Date.parse(a.effectiveFrom) <= now &&
      (a.effectiveUntil === null || typeof a.effectiveUntil === "string" && Date.parse(a.effectiveUntil) > now);
  });
}
export async function authorizeGlobalTerms(request: Request, env: HoGlobalTermWeeksEnv): Promise<string> {
  const actor = await authorizeHoShell(request.headers, env);
  if (!actor.permissionKeys.includes(GLOBAL_TERMS_PERMISSION)) throw new BoShellGateError(403, "Global Term access denied");
  const credential = await teamCredential(request, env, "BO");
  if (credential.kind !== "password") throw new TeamAuthError(401, "Password session required");
  const proof = await env.PINO_BO_CORE.executeWithStaffPassword({ method: "GET", path: "access/users" }, credential.token);
  if (proof.status !== 200) throw new BoShellGateError(proof.status, "Founder proof unavailable");
  if (!hasLiveFounder(object(proof.body)?.data, actor.userId)) throw new BoShellGateError(403, "Live Founder required");
  return credential.token;
}
export async function handleHoGlobalTerms(request: Request, env: HoGlobalTermWeeksEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (env.APP_ENV !== "staging" || url.protocol !== "https:" || url.hostname !== HO_STAGING_HOSTNAME ||
      normalizeHostname(request.headers.get("host") || "") !== HO_STAGING_HOSTNAME || url.search || !isGlobalTermsRequest(url.pathname, request.method)) return error("PLATFORM_NOT_FOUND", 404);
    if (request.method === "POST" && (request.headers.get("origin") !== url.origin || request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json")) return error("HO_REQUEST_DENIED", 403);
    const key = request.headers.get("idempotency-key");
    if (request.method === "POST" && (!key || !/^[A-Za-z0-9:_-]{8,120}$/.test(key))) return error("PLATFORM_INVALID_INPUT", 400);
    const token = await authorizeGlobalTerms(request, env);
    const suffix = url.pathname.slice(GLOBAL_TERMS_API.length);
    const id = suffix.split("/")[1];
    const action = suffix.endsWith("/delete") ? "delete" : suffix.endsWith("/update") ? "update" : "create";
    const input = request.method === "POST" ? parseTermCommand(await request.json().catch(() => null), action) : {};
    if (!input) return error("PLATFORM_INVALID_INPUT", 400);
    const core = env.PINO_WORKFORCE_CORE;
    const call = (method: string, path: string, body: unknown = {}, idempotencyKey?: string) => core.executePlanningWithStaffPassword({ method, path, body, ...(idempotencyKey ? { idempotencyKey } : {}) }, token);
    const result = await call(request.method, "global-terms/ho" + suffix, input, request.method === "POST" ? key! : undefined);
    const desired = request.method === "POST" && action === "create" ? 201 : 200;
    if (result.status !== desired) {
      // Do not relay a different 2xx as a mutation receipt.
      if (result.status >= 200 && result.status < 300) return error("HO_GLOBAL_TERM_CONFIRMATION_FAILED", 502);
      return error(typeof object(object(result.body)?.error)?.code === "string" ? String(object(object(result.body)?.error)?.code) : "HO_GLOBAL_TERM_UNAVAILABLE", result.status);
    }
    if (request.method === "GET") {
      const data = id ? parseCoreTermDetail(result.body) : parseCoreTermList(result.body);
      if (!data || id && !Array.isArray(data) && data.id !== id) return error("HO_GLOBAL_TERM_DATA_INVALID", 502);
      return json({ data }, 200);
    }
    const receipt = object(object(result.body)?.data);
    if (action === "delete") {
      if (receipt?.termId !== id || receipt.deleted !== true) return error("HO_GLOBAL_TERM_CONFIRMATION_FAILED", 502);
      const read = await call("GET", "global-terms/ho/" + id);
      if (read.status !== 404) return error("HO_GLOBAL_TERM_READBACK_MISMATCH", 502);
      return json({ data: { termId: id, deleted: true } }, 200);
    }
    const term = parseCoreTerm(receipt, 0);
    if (!term || id && term.id !== id || Object.entries(input).some(([k, v]) => k !== "expectedUpdatedAt" && receipt?.[k] !== v) ||
      "expectedUpdatedAt" in input && term.updatedAt === input.expectedUpdatedAt) return error("HO_GLOBAL_TERM_CONFIRMATION_FAILED", 502);
    const read = await call("GET", "global-terms/ho/" + term.id);
    if (read.status !== 200) return error("HO_GLOBAL_TERM_READBACK_FAILED", 502);
    const detail = parseCoreTermDetail(read.body);
    if (!detail || detail.id !== term.id || detail.updatedAt !== term.updatedAt || detail.name !== term.name || detail.code !== term.code || detail.startDate !== term.startDate || detail.endDate !== term.endDate) return error("HO_GLOBAL_TERM_READBACK_MISMATCH", 502);
    return json({ data: detail }, desired);
  } catch (e) {
    if (e instanceof BoShellGateError || e instanceof TeamAuthError) return error("HO_ACCESS_DENIED", e.status);
    return error("HO_GLOBAL_TERM_UNAVAILABLE", 503);
  }
}
