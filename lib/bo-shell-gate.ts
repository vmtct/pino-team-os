import { callBoAccessCoreWithStaffPassword, type BoAccessCoreBinding } from "./bo-core";
import { LocalStaffSessionError, staffPasswordSessionFromHeaders } from "./local-staff-session";

export interface BoShellGateEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
}

export interface BoShellContext {
  userId: string;
  email: string;
  staffMemberId: string | null;
  surface: "BO";
  entitled: true;
}

export class BoShellGateError extends Error {
  constructor(readonly status: number, message: string, readonly code: string | null = null) {
    super(message);
    this.name = "BoShellGateError";
  }
}

export async function authorizeBoShell(headers: Headers, env: BoShellGateEnv, _legacyKeyResolver?: unknown): Promise<BoShellContext> {
  let token: string;
  try { token = staffPasswordSessionFromHeaders(headers); }
  catch (error) {
    if (error instanceof LocalStaffSessionError) throw new BoShellGateError(401, error.message);
    throw error;
  }

  const contextResult = await corePasswordRead(env.PINO_BO_CORE, { method: "GET", path: "context" }, token);
  if (contextResult.status !== 200) {
    const code = (contextResult.body as { error?: { code?: unknown } } | null)?.error?.code;
    throw new BoShellGateError(contextResult.status, "Canonical BO authorization denied", typeof code === "string" ? code : null);
  }  const data = (contextResult.body as { data?: Partial<BoShellContext> } | null)?.data;
  if (!data || data.surface !== "BO" || data.entitled !== true || typeof data.userId !== "string" || !data.userId || typeof data.email !== "string") {
    throw new BoShellGateError(403, "Canonical BO context is invalid");
  }

  return {
    userId: data.userId,
    email: data.email,
    staffMemberId: typeof data.staffMemberId === "string" ? data.staffMemberId : null,
    surface: "BO",
    entitled: true,
  };
}

async function corePasswordRead(binding: BoAccessCoreBinding, request: { method: "GET"; path: string }, token: string) {
  try { return await callBoAccessCoreWithStaffPassword(binding, request, token); }
  catch { throw new BoShellGateError(503, "BO authorization service is unavailable"); }
}