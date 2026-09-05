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
  executeWithStaffPassword(request: BoAccessRequest, token: string): Promise<BoAccessResponse>;
}

export function callBoAccessCoreWithStaffPassword(
  binding: BoAccessCoreBinding,
  request: BoAccessRequest,
  token: string,
): Promise<BoAccessResponse> {
  return binding.executeWithStaffPassword(request, token);
}
