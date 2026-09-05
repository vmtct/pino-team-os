export interface BoAccessRequest {
  method: string;
  path: string;
  resource?: {
    centerId?: string;
    pathId?: string;
    runningClassId?: string;
  };
  body?: unknown;
  idempotencyKey?: string;
}

export interface BoAccessResponse {
  status: number;
  body: unknown;
  requestId: string;
}

export interface BoAccessCoreBinding {
  execute?(request: BoAccessRequest, identity: import("./team-auth").VerifiedTeamIdentity): Promise<BoAccessResponse>;
  executeWithStaffPassword(request: BoAccessRequest, token: string): Promise<BoAccessResponse>;
}

export function callBoAccessCoreWithStaffPassword(
  binding: BoAccessCoreBinding,
  request: BoAccessRequest,
  token: string,
): Promise<BoAccessResponse> {
  return binding.executeWithStaffPassword(request, token);
}

export function callBoAccessCoreWithCredential(binding: BoAccessCoreBinding, request: BoAccessRequest, credential: import("./team-auth").TeamCredential): Promise<BoAccessResponse> {
  if (credential.kind === "password") return binding.executeWithStaffPassword(request, credential.token);
  if (!binding.execute) throw new Error("BO_CLOUDFLARE_COMPATIBILITY_UNAVAILABLE");
  return binding.execute(request, credential.identity);
}
