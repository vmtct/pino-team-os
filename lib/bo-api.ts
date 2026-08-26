import type {
  BoAccessRole,
  BoAccessUser,
  BoCenter,
  BoPathProgram,
  BoRegistration,
  BoRunningClass,
  BoSession,
  BoStaffOnboardingCommand,
  BoStaffOnboardingResult,
  BoStaffRecord,
  BoSyllabus,
} from "./bo-model";

export class BoApiError extends Error {
  constructor(readonly status: number, message: string, readonly requestId: string | null) {
    super(message);
    this.name = "BoApiError";
  }
}

async function read<T>(path: string): Promise<T[]> {
  const response = await fetch(`/api/bo/${path}`, { cache: "no-store" });
  const body = await response.json() as { data?: T[]; error?: { message?: string; requestId?: string } };
  if (!response.ok || !body.data) throw apiError(response, body, "Back Office data could not be loaded.");
  return body.data;
}

async function write<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
  const response = await fetch(`/api/bo/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as { data?: T; error?: { message?: string; requestId?: string } };
  if (!response.ok || payload.data === undefined) throw apiError(response, payload, "Back Office command could not be completed.");
  return payload.data;
}

function apiError(response: Response, body: { error?: { message?: string; requestId?: string } }, fallback: string) {
  return new BoApiError(response.status, body.error?.message ?? fallback, response.headers.get("x-request-id") ?? body.error?.requestId ?? null);
}

export const boApi = {
  centers: () => read<BoCenter>("centers"),
  pathPrograms: () => read<BoPathProgram>("path-programs"),
  runningClasses: () => read<BoRunningClass>("running-classes"),
  syllabi: () => read<BoSyllabus>("syllabi"),
  sessions: () => read<BoSession>("sessions"),
  registrations: (sessionId: string) => read<BoRegistration>(`sessions/${encodeURIComponent(sessionId)}/registrations`),
  accessRoles: () => read<BoAccessRole>("access/roles"),
  accessUsers: () => read<BoAccessUser>("access/users"),
  staffRecords: () => read<BoStaffRecord>("workforce/staff-records"),
  onboardStaff: (command: BoStaffOnboardingCommand, idempotencyKey: string) => write<BoStaffOnboardingResult>("workforce/staff-onboarding", command, idempotencyKey),
};
