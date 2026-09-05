import type { JWTVerifyGetKey } from "jose";
import type { StaffPinCoreBinding } from "./staff-pin-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";

export type StaffPinAccessEnv = TeamAccessEnv & {
  PINO_STAFF_PIN_CORE: StaffPinCoreBinding;
};

export async function handleStaffPinStatus(request: Request, env: StaffPinAccessEnv, keyResolver?: JWTVerifyGetKey): Promise<Response> {
  try {
    const credential = await teamCredential(request, env, surface(request), keyResolver);
    if (credential.kind === "password") return coreResponse(await env.PINO_STAFF_PIN_CORE.statusWithStaffPassword(credential.token));
    if (!env.PINO_STAFF_PIN_CORE.status) throw new Error("STAFF_PIN_CLOUDFLARE_COMPATIBILITY_UNAVAILABLE");
    return coreResponse(await env.PINO_STAFF_PIN_CORE.status(credential.identity));
  } catch (error) { return authFailure(error); }
}

export async function handleStaffPinChange(request: Request, env: StaffPinAccessEnv, keyResolver?: JWTVerifyGetKey): Promise<Response> {
  try {
    const credential = await teamCredential(request, env, surface(request), keyResolver);
    const input = await request.json() as { currentPin?: string; pin?: string };
    const currentPin=(input.currentPin??"").trim();
    if (credential.kind === "cloudflare") {
      if (!currentPin) return Response.json({error:{code:"ACCESS_STAFF_PASSWORD_TRANSITION_REQUIRED",message:"Thiết lập mật khẩu Staff trước khi cấu hình PIN mới."}},{status:409,headers:{"cache-control":"no-store"}});
      if (!env.PINO_STAFF_PIN_CORE.rotate) throw new Error("STAFF_PIN_CLOUDFLARE_COMPATIBILITY_UNAVAILABLE");
      return coreResponse(await env.PINO_STAFF_PIN_CORE.rotate(credential.identity,{currentPin,pin:input.pin ?? ""}));
    }
    if (currentPin) return coreResponse(await env.PINO_STAFF_PIN_CORE.rotateWithStaffPassword(credential.token, { currentPin, pin: input.pin ?? "" }));
    return coreResponse(await env.PINO_STAFF_PIN_CORE.configureWithStaffPassword(credential.token, { pin: input.pin ?? "" }));
  } catch (error) { return authFailure(error); }
}

function surface(request:Request):"BO"|"TOS"{const host=(request.headers.get("host")??new URL(request.url).hostname).split(":")[0]!.trim().toLowerCase();return host==="bo.pinohouse.art"?"BO":"TOS";}
function coreResponse(result: { status: number; body: unknown; requestId: string }): Response {
  return Response.json(result.body, { status: result.status, headers: { "cache-control": "no-store", "x-request-id": result.requestId } });
}

function authFailure(error: unknown): Response {
  if (error instanceof TeamAuthError) {
    return Response.json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, { status: error.status });
  }
  return Response.json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "Không thể xác thực Staff PIN" } }, { status: 500 });
}