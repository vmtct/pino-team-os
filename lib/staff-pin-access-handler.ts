import type { StaffPinCoreBinding } from "./staff-pin-core";
import { LocalStaffSessionError, staffPasswordSession } from "./local-staff-session";

export type StaffPinAccessEnv = {
  PINO_STAFF_PIN_CORE: StaffPinCoreBinding;
};

export async function handleStaffPinStatus(request: Request, env: StaffPinAccessEnv): Promise<Response> {
  try {
    const token = staffPasswordSession(request);
    if (!env.PINO_STAFF_PIN_CORE.statusWithStaffPassword) throw new Error("STAFF_PIN_LOCAL_AUTH_UNAVAILABLE");
    return coreResponse(await env.PINO_STAFF_PIN_CORE.statusWithStaffPassword(token));
  } catch (error) { return authFailure(error); }
}

export async function handleStaffPinChange(request: Request, env: StaffPinAccessEnv): Promise<Response> {
  try {
    const token = staffPasswordSession(request);
    const input = await request.json() as { currentPin?: string; pin?: string };
    if ((input.currentPin ?? "").trim()) {
      if (!env.PINO_STAFF_PIN_CORE.rotateWithStaffPassword) throw new Error("STAFF_PIN_LOCAL_AUTH_UNAVAILABLE");
      return coreResponse(await env.PINO_STAFF_PIN_CORE.rotateWithStaffPassword(token, { currentPin: input.currentPin ?? "", pin: input.pin ?? "" }));
    }
    if (!env.PINO_STAFF_PIN_CORE.configureWithStaffPassword) throw new Error("STAFF_PIN_LOCAL_AUTH_UNAVAILABLE");
    return coreResponse(await env.PINO_STAFF_PIN_CORE.configureWithStaffPassword(token, { pin: input.pin ?? "" }));
  } catch (error) { return authFailure(error); }
}
function coreResponse(result: { status: number; body: unknown; requestId: string }): Response {
  return Response.json(result.body, { status: result.status, headers: { "cache-control": "no-store", "x-request-id": result.requestId } });
}

function authFailure(error: unknown): Response {
  if (error instanceof LocalStaffSessionError) {
    return Response.json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, { status: 401 });
  }
  return Response.json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "Không thể xác thực Staff PIN" } }, { status: 500 });
}