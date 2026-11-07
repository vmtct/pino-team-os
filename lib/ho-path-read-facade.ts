/** PAP-1594 / HO-PATH-READ: exact HO Staging-only GET facade to FounderControlPlane. */
import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { teamCredential, TeamAuthError } from "./team-auth";
import { callFounderCoreWithStaffPassword, type PinoCoreBinding } from "./founder-core";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";

export interface HoPathReadEnv extends HoEnv { PINO_CORE?: PinoCoreBinding }
const respond = (status: number, body: unknown, requestId?: string): Response =>
  Response.json(body, { status, headers: {
    "cache-control": "no-store", "x-content-type-options": "nosniff",
    ...(requestId ? { "x-request-id": requestId } : {}),
  } });
const fail = (status: number, code: string) => respond(status, { error: { code } });

export async function handleHoPathRead(request: Request, env: HoPathReadEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (env.APP_ENV !== "staging" || url.protocol !== "https:" ||
      url.hostname !== HO_STAGING_HOSTNAME || url.port || url.search || url.hash ||
      normalizeHostname(request.headers.get("host") || "") !== HO_STAGING_HOSTNAME ||
      url.pathname !== "/api/ho/learning/paths" || request.method !== "GET")
      return fail(404, "HO_PATH_NOT_FOUND");
    await authorizeHoShell(request.headers, env);
    const credential = await teamCredential(request, env, "BO");
    if (credential.kind !== "password") return fail(401, "HO_PATH_PASSWORD_REQUIRED");
    if (!env.PINO_CORE?.executeWithStaffPassword) return fail(503, "HO_PATH_CORE_UNAVAILABLE");
    const result = await callFounderCoreWithStaffPassword(env.PINO_CORE, {
      method: "GET", path: "learning/paths", body: {},
    }, credential.token);
    if (!Number.isSafeInteger(result.status) || result.status < 200 || result.status > 599 ||
      typeof result.requestId !== "string" || !result.requestId.trim())
      return fail(502, "HO_PATH_CORE_CONTRACT_INVALID");
    return respond(result.status, result.body, result.requestId);
  } catch (error) {
    if (error instanceof BoShellGateError) return fail(error.status, "HO_PATH_ACCESS_DENIED");
    if (error instanceof TeamAuthError) return fail(error.status, "HO_PATH_PASSWORD_REQUIRED");
    return fail(503, "HO_PATH_UNAVAILABLE");
  }
}
