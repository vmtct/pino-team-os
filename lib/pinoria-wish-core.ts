export interface TosLearningRequest {
  method: string;
  path: string;
  body?: unknown;
  idempotencyKey?: string;
}

export interface TosLearningResponse {
  status: number;
  body: unknown;
  requestId: string;
}

export interface PinoTosCoreBinding {
  executeWithStaffPin(request: TosLearningRequest, token: string): Promise<TosLearningResponse>;
}

export interface StaffPinResponse {
  status: number;
  body: unknown;
  requestId: string;
}

export interface PinoStaffPinCoreBinding {
  login(input: { loginIdentifier: string; pin: string }): Promise<StaffPinResponse>;
  logout(token: string): Promise<StaffPinResponse>;
}

export interface CanonicalPinoriaPresence {
  centerId: string;
  cursor: number;
  learners: Array<{
    studentProfileId: string;
    displayName: string;
    visit: { id: string; checkedInAt: string; version: number };
    character: { id: string; config: Record<string, string> };
  }>;
}

export interface PinoTvCoreBinding {
  snapshot(centerId: string): Promise<CanonicalPinoriaPresence>;
  claimWishReveal(centerId: string): Promise<{ reveal: unknown; claimedAt: string } | null>;
  completeWishReveal(centerId: string, revealId: string): Promise<{ revealId: string; completedAt: string }>;
}

export type PinoriaWishCoreEnv = {
  PINO_TOS_CORE: PinoTosCoreBinding;
  PINO_STAFF_PIN_CORE: PinoStaffPinCoreBinding;
  PINO_TV_CORE: PinoTvCoreBinding;
  PINORIA_CENTER_ID: string;
};