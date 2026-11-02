import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { teamCredential, TeamAuthError } from "./team-auth";
import type { WorkforcePlanningCoreBinding, WorkforcePlanningResponse } from "./bo-workforce-planning-handler";

export interface HoGlobalWeekEnv extends HoEnv { PINO_WORKFORCE_CORE: WorkforcePlanningCoreBinding }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const replayKey = /^[a-zA-Z0-9:_-]{8,120}$/;
const noCache = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
const json = (body: unknown, status: number) => Response.json(body, { status, headers: noCache });
type Command = { termWeekId: string; locked: boolean; expectedVersion: number; reason: string };

export function parseGlobalWeekLock(body: unknown): Command | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (Object.keys(b).length !== 4 || !uuid.test(String(b.termWeekId)) ||
      typeof b.locked !== "boolean" || !Number.isSafeInteger(b.expectedVersion) ||
      Number(b.expectedVersion) < 0 || typeof b.reason !== "string" ||
      !b.reason.trim() || b.reason.trim().length > 500) return null;
  return { termWeekId: String(b.termWeekId), locked: b.locked, expectedVersion: Number(b.expectedVersion), reason: b.reason.trim() };
}
function validState(body: unknown, termWeekId: string): {termWeekId:string;locked:boolean;version:number} | null {
  if (!body || typeof body !== "object") return null;
  const data = (body as {data?: unknown}).data;
  if (!data || typeof data !== "object") return null;
  const state = data as Record<string,unknown>;
  if (state.termWeekId !== termWeekId || typeof state.locked !== "boolean" ||
      !Number.isSafeInteger(state.version) || Number(state.version) < 0) return null;
  return {termWeekId,locked:state.locked,version:Number(state.version)};
}
const coreCall = (env:HoGlobalWeekEnv, method:"GET"|"POST",body:object,token:string,key?:string):Promise<WorkforcePlanningResponse> =>
  env.PINO_WORKFORCE_CORE.executePlanningWithStaffPassword(
    { method, path:"global-week-registration-lock", body, ...(key ? {idempotencyKey:key} : {}) }, token);

export async function handleHoGlobalWeekLock(request: Request, env: HoGlobalWeekEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (env.APP_ENV !== "staging" ||
        normalizeHostname(request.headers.get("host") || url.hostname) !== HO_STAGING_HOSTNAME ||
        url.pathname !== "/api/ho/workforce/global-week-registration")
      return json({error:{code:"PLATFORM_NOT_FOUND"}},404);
    if (request.method !== "GET" && request.method !== "POST")
      return json({error:{code:"PLATFORM_METHOD_NOT_ALLOWED"}},405);
    if (request.method === "POST" &&
        (request.headers.get("origin") !== "https://" + HO_STAGING_HOSTNAME ||
         !request.headers.get("content-type")?.startsWith("application/json")))
      return json({error:{code:"HO_REQUEST_DENIED"}},403);
    const key = request.headers.get("idempotency-key")?.trim();
    if (request.method === "POST" && (!key || !replayKey.test(key)))
      return json({error:{code:"PLATFORM_INVALID_INPUT"}},400);
    // The HO cohort check must run before a Core read or mutation; never use a BO cookie alone.
    const actor = await authorizeHoShell(request.headers, env);
    if (!actor.userId || !actor.permissionKeys.includes("operating_cycle.global_week.lock"))
      return json({error:{code:"HO_GLOBAL_WEEK_LOCK_DENIED"}},403);
    const credential = await teamCredential(request, env, "BO");
    if (credential.kind !== "password")
      return json({error:{code:"IDENTITY_UNAUTHORIZED"}},401);
    const command = request.method === "POST" ? parseGlobalWeekLock(await request.json().catch(()=>null)) : null;
    const termWeekId = command?.termWeekId ?? url.searchParams.get("termWeekId") ?? "";
    if (!uuid.test(termWeekId) || (request.method === "POST" && !command))
      return json({error:{code:"PLATFORM_INVALID_INPUT"}},400);
    if (request.method === "POST" && command) {
      const response = await coreCall(env,"POST",command,credential.token,key);
      if (response.status !== 200) return json(response.body,response.status);
      const acknowledged = validState(response.body,termWeekId);
      if (!acknowledged || acknowledged.locked !== command.locked || acknowledged.version !== command.expectedVersion + 1)
        return json({error:{code:"HO_GLOBAL_WEEK_CONFIRMATION_FAILED"}},502);
    }
    // Read the authoritative Core state, never optimistically claim save.
    const readback = await coreCall(env,"GET",{termWeekId},credential.token);
    if (readback.status !== 200) return json(readback.body,readback.status);
    const state = validState(readback.body,termWeekId);
    if (!state || (command && (state.locked !== command.locked || state.version !== command.expectedVersion + 1)))
      return json({error:{code:"HO_GLOBAL_WEEK_READBACK_MISMATCH"}},502);
    return json({data:state},200);
  } catch (error) {
    if (error instanceof BoShellGateError) return json({error:{code:"HO_ACCESS_DENIED"}},error.status);
    if (error instanceof TeamAuthError) return json({error:{code:"IDENTITY_UNAUTHORIZED"}},error.status);
    return json({error:{code:"HO_GLOBAL_WEEK_UNAVAILABLE"}},503);
  }
}
