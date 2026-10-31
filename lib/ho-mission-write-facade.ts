import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { callFounderCoreWithStaffPassword, type PinoCoreBinding } from "./founder-core";
import { teamCredential, TeamAuthError } from "./team-auth";

/** PAP-1207 Core GLOBAL writer transport. No BO catalog writes and no Production admission. */
export interface HoMissionWriteEnv extends HoEnv { PINO_CORE?: PinoCoreBinding }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const idempotency = /^[a-zA-Z0-9][a-zA-Z0-9_-]{7,119}$/;
const fields = ["code", "name", "level", "status", "plsValue", "description", "guideline",
  "paperSize", "pathProgramId", "pathKeySnapshot", "prerequisiteMissionId", "prerequisiteCodeSnapshot"] as const;
type CoreMission = {
  code: string; name: string; level: number; status: "ACTIVE" | "INACTIVE"; plsValue: number;
  description: string | null; guideline: string | null; paperSize: "B5" | "A4" | "A3" | null;
  pathProgramId: string | null; pathKeySnapshot: string | null;
  prerequisiteMissionId: string | null; prerequisiteCodeSnapshot: string | null;
};
type MissionCommand = CoreMission & { expectedVersion?: number };
const respond = (status: number, body: unknown) => Response.json(body, { status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
function optionalText(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || v.length > max) return undefined;
  return v.trim() || null;
}
export function parseHoMissionCommand(value: unknown, method: "POST" | "PUT"): MissionCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const allowed = method === "PUT" ? [...fields, "expectedVersion"] : [...fields];
  if (Object.keys(raw).some(k => !allowed.includes(k as (typeof allowed)[number]))) return null;
  if (typeof raw.code !== "string" || !/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(raw.code.trim()) ||
      typeof raw.name !== "string" || !raw.name.trim() || raw.name.trim().length > 160 ||
      !Number.isSafeInteger(raw.level) || Number(raw.level) < 1 || Number(raw.level) > 5 ||
      !Number.isSafeInteger(raw.plsValue) || Number(raw.plsValue) < 0 ||
      !["ACTIVE", "INACTIVE"].includes(String(raw.status)) ||
      !(raw.paperSize == null || ["B5", "A4", "A3"].includes(String(raw.paperSize))) ||
      (method === "PUT" && (!Number.isSafeInteger(raw.expectedVersion) || Number(raw.expectedVersion) < 1))) return null;
  const description = optionalText(raw.description, 4000);
  const guideline = optionalText(raw.guideline, 8000);
  const pathProgramId = optionalText(raw.pathProgramId, 36);
  const pathKeySnapshot = optionalText(raw.pathKeySnapshot, 120);
  const prerequisiteMissionId = optionalText(raw.prerequisiteMissionId, 36);
  const prerequisiteCodeSnapshot = optionalText(raw.prerequisiteCodeSnapshot, 120);
  if ([description, guideline, pathProgramId, pathKeySnapshot, prerequisiteMissionId,
    prerequisiteCodeSnapshot].some(v => v === undefined) ||
      (pathProgramId !== null && !uuid.test(pathProgramId!)) ||
      (prerequisiteMissionId !== null && !uuid.test(prerequisiteMissionId!))) return null;
  return {
    code: raw.code.trim().toUpperCase(), name: raw.name.trim(), level: Number(raw.level),
    status: raw.status as "ACTIVE" | "INACTIVE", plsValue: Number(raw.plsValue),
    description: description!, guideline: guideline!, paperSize: (raw.paperSize ?? null) as CoreMission["paperSize"],
    pathProgramId: pathProgramId!, pathKeySnapshot: pathKeySnapshot!,
    prerequisiteMissionId: prerequisiteMissionId!, prerequisiteCodeSnapshot: prerequisiteCodeSnapshot!,
    ...(method === "PUT" ? { expectedVersion: Number(raw.expectedVersion) } : {}),
  };
}
export async function handleHoMissionWrite(request: Request, env: HoMissionWriteEnv, missionId?: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (env.APP_ENV !== "staging" || url.protocol !== "https:" || url.search || url.hash ||
        url.username || url.password || url.hostname !== HO_STAGING_HOSTNAME ||
        normalizeHostname(request.headers.get("host") || "") !== HO_STAGING_HOSTNAME ||
        (missionId !== undefined && !uuid.test(missionId))) return respond(404, { error: { code: "PLATFORM_NOT_FOUND" } });
    const method = request.method.toUpperCase();
    if (missionId === undefined ? method !== "POST" : method !== "PUT")
      return respond(405, { error: { code: "PLATFORM_METHOD_NOT_ALLOWED" } });
    if (request.headers.get("origin") !== "https://" + HO_STAGING_HOSTNAME ||
        !/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? ""))
      return respond(403, { error: { code: "HO_REQUEST_DENIED" } });
    const key = request.headers.get("idempotency-key") ?? "";
    if (!idempotency.test(key)) return respond(400, { error: { code: "HO_MISSION_IDEMPOTENCY_REQUIRED" } });
    // Do not parse arbitrarily large bodies or send raw untrusted fields to Core.
    const raw = await request.text();
    if (raw.length > 16000) return respond(413, { error: { code: "HO_MISSION_BODY_TOO_LARGE" } });
    const command = parseHoMissionCommand(JSON.parse(raw) as unknown, method as "POST" | "PUT");
    if (!command) return respond(400, { error: { code: "HO_MISSION_INVALID_INPUT" } });
    const actor = await authorizeHoShell(request.headers, env);
    if (!actor.userId || !actor.permissionKeys.includes("learning.mission.manage"))
      return respond(403, { error: { code: "HO_MISSION_PERMISSION_DENIED" } });
    const credential = await teamCredential(request, env, "BO");
    if (credential.kind !== "password") return respond(401, { error: { code: "IDENTITY_UNAUTHORIZED" } });
    if (!env.PINO_CORE || typeof env.PINO_CORE.executeWithStaffPassword !== "function")
      return respond(503, { error: { code: "HO_MISSION_CORE_UNAVAILABLE" } });
    const result = await callFounderCoreWithStaffPassword(env.PINO_CORE, {
      method, path: "learning/missions" + (missionId ? "/" + missionId : ""), body: command,
      idempotencyKey: key,
    }, credential.token);
    return respond(result.status, result.body);
  } catch (error) {
    if (error instanceof BoShellGateError) return respond(error.status, { error: { code: "HO_ACCESS_DENIED" } });
    if (error instanceof TeamAuthError) return respond(error.status, { error: { code: "IDENTITY_UNAUTHORIZED" } });
    if (error instanceof SyntaxError) return respond(400, { error: { code: "HO_MISSION_INVALID_JSON" } });
    return respond(503, { error: { code: "HO_MISSION_CORE_UNAVAILABLE" } });
  }
}

/** PAP-1207: independent GLOBAL Founder readback for HO Mission writes.
 * A successful BO catalog read is not a substitute for verifying the Founder writer.
 */
export async function handleHoMissionRead(request: Request, env: HoMissionWriteEnv, missionId: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (env.APP_ENV !== "staging" || url.protocol !== "https:" || url.search || url.hash ||
        url.username || url.password || url.hostname !== HO_STAGING_HOSTNAME ||
        normalizeHostname(request.headers.get("host") || "") !== HO_STAGING_HOSTNAME ||
        !uuid.test(missionId)) return respond(404, { error: { code: "PLATFORM_NOT_FOUND" } });
    if (request.method !== "GET") return respond(405, { error: { code: "PLATFORM_METHOD_NOT_ALLOWED" } });
    const actor = await authorizeHoShell(request.headers, env);
    if (!actor.userId || !actor.permissionKeys.includes("learning.mission.manage"))
      return respond(403, { error: { code: "HO_MISSION_PERMISSION_DENIED" } });
    const credential = await teamCredential(request, env, "BO");
    if (credential.kind !== "password") return respond(401, { error: { code: "IDENTITY_UNAUTHORIZED" } });
    if (!env.PINO_CORE || typeof env.PINO_CORE.executeWithStaffPassword !== "function")
      return respond(503, { error: { code: "HO_MISSION_CORE_UNAVAILABLE" } });
    const result = await callFounderCoreWithStaffPassword(env.PINO_CORE, {
      method: "GET", path: "learning/missions/" + missionId,
    }, credential.token);
    return respond(result.status, result.body);
  } catch (error) {
    if (error instanceof BoShellGateError) return respond(error.status, { error: { code: "HO_ACCESS_DENIED" } });
    if (error instanceof TeamAuthError) return respond(error.status, { error: { code: "IDENTITY_UNAUTHORIZED" } });
    return respond(503, { error: { code: "HO_MISSION_CORE_UNAVAILABLE" } });
  }
}