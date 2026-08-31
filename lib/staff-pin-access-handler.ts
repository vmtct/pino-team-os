import type { JWTVerifyGetKey } from "jose";
import { authenticateBo, BoAuthError } from "./bo-auth";
import { stagingBoWorkforceIdentity, type BoWorkforceStagingAuthEnv } from "./bo-workforce-staging-auth";
import type { StaffPinCoreBinding } from "./staff-pin-core";
import { stagingWorkforceIdentity, type TosStagingAuthEnv } from "./tos-staging-auth";
import { authenticateWorkforce, WorkforceAuthError, type VerifiedWorkforceIdentity } from "./workforce-auth";

export type StaffPinAccessEnv = TosStagingAuthEnv & BoWorkforceStagingAuthEnv & {
  PINO_STAFF_PIN_CORE: StaffPinCoreBinding;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_TOS_AUD: string;
  CF_ACCESS_BO_AUD: string;
};

export async function handleStaffPinStatus(request: Request, env: StaffPinAccessEnv, keyResolver?: JWTVerifyGetKey): Promise<Response> {
  try {
    const identity = await authenticatedIdentity(request, env, keyResolver);
    const result = await env.PINO_STAFF_PIN_CORE.status(identity);
    return coreResponse(result);
  } catch (error) {
    return authFailure(error);
  }
}

export async function handleStaffPinChange(request: Request, env: StaffPinAccessEnv, keyResolver?: JWTVerifyGetKey): Promise<Response> {
  try {
    const identity = await authenticatedIdentity(request, env, keyResolver);
    const input = await request.json() as { currentPin?: string; pin?: string };
    const result = await env.PINO_STAFF_PIN_CORE.rotate(identity, { currentPin: input.currentPin ?? "", pin: input.pin ?? "" });
    return coreResponse(result);
  } catch (error) {
    return authFailure(error);
  }
}

async function authenticatedIdentity(request: Request, env: StaffPinAccessEnv, keyResolver?: JWTVerifyGetKey): Promise<VerifiedWorkforceIdentity> {
  const host = (request.headers.get("host") ?? new URL(request.url).hostname).split(":")[0]!.trim().toLowerCase();
  if (host === "bo.pinohouse.art") {
    return authenticateBo(request.headers, { teamDomain: env.CF_ACCESS_TEAM_DOMAIN, audience: env.CF_ACCESS_BO_AUD }, keyResolver);
  }
  const staged = stagingWorkforceIdentity(request, env);
  if (staged) return staged;
  if (host.endsWith(".workers.dev") && env.WORKFORCE_BO_STAGING_BYPASS === "enabled") {
    const stagedBo = stagingBoWorkforceIdentity(request, env);
    if (stagedBo) return stagedBo;
  }
  return authenticateWorkforce(request.headers, { teamDomain: env.CF_ACCESS_TEAM_DOMAIN, audience: env.CF_ACCESS_TOS_AUD }, keyResolver);
}

function coreResponse(result: { status: number; body: unknown; requestId: string }): Response {
  return Response.json(result.body, { status: result.status, headers: { "cache-control": "no-store", "x-request-id": result.requestId } });
}

function authFailure(error: unknown): Response {
  if (error instanceof WorkforceAuthError || error instanceof BoAuthError) {
    return Response.json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, { status: error.status });
  }
  return Response.json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "Kh?ng th? x?c th?c Staff PIN" } }, { status: 500 });
}
