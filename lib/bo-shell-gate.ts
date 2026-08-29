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

type FounderAssignment = { roleKey?: unknown; scopeType?: unknown; scopeId?: unknown; effectiveFrom?: unknown; effectiveUntil?: unknown };
type AccessUserProjection = { id?: unknown; status?: unknown; email?: unknown; assignments?: unknown };

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

  const usersResult = await coreRead(env.PINO_BO_CORE, { method: "GET", path: "access/users" }, identity);
  if (usersResult.status !== 200) throw new BoShellGateError(usersResult.status, "Canonical Founder proof was denied");
  const users = (usersResult.body as { data?: unknown } | null)?.data;
  if (!Array.isArray(users) || !isActiveFounder(users, data.userId, identity.email)) throw new BoShellGateError(403, "Canonical Founder role is required");

  return { userId: data.userId, email: data.email, staffMemberId: typeof data.staffMemberId === "string" ? data.staffMemberId : null, surface: "BO", entitled: true };
}
async function coreRead(binding: BoAccessCoreBinding, request: { method: "GET"; path: string }, identity: VerifiedBoIdentity) {
  try {
    return await callBoAccessCore(binding, request, identity);
  } catch {
    throw new BoShellGateError(503, "BO authorization service is unavailable");
  }
}

function isActiveFounder(users: unknown[], userId: string, email: string): boolean {
  const now = new Date().toISOString();
  const user = users.find((value): value is AccessUserProjection => isRecord(value) && value.id === userId);
  if (!user || user.status !== "active" || typeof user.email !== "string" || user.email.trim().toLowerCase() !== email || !Array.isArray(user.assignments)) return false;
  return user.assignments.some((value) => {
    if (!isRecord(value)) return false;
    const assignment = value as FounderAssignment;
    return assignment.roleKey === "founder" && assignment.scopeType === "GLOBAL" && assignment.scopeId === null
      && typeof assignment.effectiveFrom === "string" && assignment.effectiveFrom <= now
      && (assignment.effectiveUntil === null || (typeof assignment.effectiveUntil === "string" && assignment.effectiveUntil > now));
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
