import type { JWTVerifyGetKey } from "jose";
import { authenticateBo, type VerifiedBoIdentity } from "./bo-auth";
import { callBoAccessCore, type BoAccessCoreBinding } from "./bo-core";

export interface BoShellGateEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_BO_AUD: string;
}

export interface BoShellContext {
  userId: string;
  email: string;
  staffMemberId: string | null;
  surface: "BO";
  entitled: true;
}

export class BoShellGateError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "BoShellGateError";
  }
}
export async function authorizeBoShell(
  headers: Headers,
  env: BoShellGateEnv,
  keyResolver?: JWTVerifyGetKey,
): Promise<BoShellContext> {
  let identity: VerifiedBoIdentity;
  try {
    identity = await authenticateBo(headers, { teamDomain: env.CF_ACCESS_TEAM_DOMAIN, audience: env.CF_ACCESS_BO_AUD }, keyResolver);
  } catch (error) {
    throw new BoShellGateError(error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 401, "BO identity was not authenticated");
  }

  const contextResult = await coreRead(env.PINO_BO_CORE, { method: "GET", path: "context" }, identity);
  if (contextResult.status !== 200) throw new BoShellGateError(contextResult.status, "Canonical BO authorization denied");
  const data = (contextResult.body as { data?: Partial<BoShellContext> } | null)?.data;
  if (!data || data.surface !== "BO" || data.entitled !== true || typeof data.userId !== "string" || !data.userId || typeof data.email !== "string" || data.email.trim().toLowerCase() !== identity.email) {
    throw new BoShellGateError(403, "Canonical BO context is invalid");
  }

  return { userId: data.userId, email: data.email, staffMemberId: typeof data.staffMemberId === "string" ? data.staffMemberId : null, surface: "BO", entitled: true };
}
async function coreRead(binding: BoAccessCoreBinding, request: { method: "GET"; path: string }, identity: VerifiedBoIdentity) {
  try {
    return await callBoAccessCore(binding, request, identity);
  } catch {
    throw new BoShellGateError(503, "BO authorization service is unavailable");
  }
}
