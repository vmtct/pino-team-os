import type { VerifiedBoIdentity } from "./bo-auth";

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
  execute(request: BoAccessRequest, identity: VerifiedBoIdentity): Promise<BoAccessResponse>;
}

export function callBoAccessCore(
  binding: BoAccessCoreBinding,
  request: BoAccessRequest,
  identity: VerifiedBoIdentity,
): Promise<BoAccessResponse> {
  return binding.execute(request, identity);
}
