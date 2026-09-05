import { callBoAccessCoreWithStaffPassword, type BoAccessCoreBinding, type BoAccessRequest } from "./bo-core";
import { LocalStaffSessionError, staffPasswordSession } from "./local-staff-session";

export interface BoWorkforceDutyExceptionEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
}

const ROOT = "workforce/duty/checkout-exceptions";
const APPROVE = /^workforce\/duty\/checkout-exceptions\/([0-9a-f-]{36})\/approve$/;
const UUID = /^[0-9a-f-]{36}$/;

export function isBoWorkforceDutyExceptionPath(path: string): boolean {
  return path === ROOT || APPROVE.test(path);
}

export async function handleBoWorkforceDutyExceptionRequest(
  request: Request,
  env: BoWorkforceDutyExceptionEnv,
  path: string,
): Promise<Response> {
  try {
    if (!isBoWorkforceDutyExceptionPath(path)) return json({ error: { code: "PLATFORM_NOT_FOUND", message: "BO operation not found" } }, 404);
    const centerId = requiredCenterId(request);
    const token = staffPasswordSession(request);

    if (path === ROOT) {
      if (request.method !== "GET") return methodNotAllowed();
      return forward(env, token, { method: "GET", path: ROOT, resource: { centerId } });
    }
    const approval = APPROVE.exec(path);
    if (!approval || request.method !== "POST") return methodNotAllowed();
    const raw = await jsonBody(request);
    const expectedVersion = positiveInteger(raw.expectedVersion);
    const password = requiredPassword(raw.password);
    return forward(env, token, {
      method: "POST",
      path,
      resource: { centerId },
      body: { expectedVersion, password },
    });
  } catch (error) {
    if (error instanceof LocalStaffSessionError) {
      return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, 401);
    }
    if (error instanceof InputError) {
      return json({ error: { code: "PLATFORM_INVALID_INPUT", message: error.message } }, 400);
    }
    console.error("BO duty exception facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}

async function forward(env: BoWorkforceDutyExceptionEnv, token: string, coreRequest: BoAccessRequest) {
  const result = await callBoAccessCoreWithStaffPassword(env.PINO_BO_CORE, coreRequest, token);
  return json(result.body, result.status, { "x-request-id": result.requestId });
}
function requiredCenterId(request: Request): string {
  const value = new URL(request.url).searchParams.get("centerId")?.trim() ?? "";
  if (!UUID.test(value)) throw new InputError("A canonical Center id is required");
  return value;
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = await request.json(); }
  catch { throw new InputError("A JSON request body is required"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new InputError("Request body must be an object");
  return body as Record<string, unknown>;
}

function positiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new InputError("Expected a positive exception version");
  return Number(value);
}
function requiredPassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 1) throw new InputError("Current password is required");
  return value;
}
function methodNotAllowed() { return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405); }
class InputError extends Error {}
function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}
