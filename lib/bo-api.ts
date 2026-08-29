import type {
  BoAccessRole,
  BoAccessUser,
  BoCenter,
  BoPathProgram,
  BoRegistration,
  BoSessionLearningOwner,
  BoSessionLearningOwnerCommand,
  BoSessionLearningOwnerProjection,
  BoRunningClass,
  BoSession,
  BoStaffOnboardingCommand,
  BoStaffOnboardingResult,
  BoStaffProfile,
  BoStaffProfilePatch,
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

async function readOne<T>(path: string): Promise<T> {
  const response = await fetch(`/api/bo/${path}`, { cache: "no-store" });
  const body = await response.json() as { data?: T; error?: { message?: string; requestId?: string } };
  if (!response.ok || body.data === undefined) throw apiError(response, body, "Back Office data could not be loaded.");
  return body.data;
}

async function write<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
  const response = await fetch(`/api/bo/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload: { data?: T; error?: { message?: string; requestId?: string } };
  try { payload = JSON.parse(text) as typeof payload; }
  catch { throw new BoApiError(response.status, text.trim() || "Back Office command returned an invalid response.", response.headers.get("x-request-id")); }
  if (!response.ok || payload.data === undefined) throw apiError(response, payload, "Back Office command could not be completed.");
  return payload.data;
}

function apiError(response: Response, body: { error?: { message?: string; requestId?: string } }, fallback: string) {
  return new BoApiError(response.status, body.error?.message ?? fallback, response.headers.get("x-request-id") ?? body.error?.requestId ?? null);
}

type BoScopeBootstrap = {
  centers: Array<{ id: string; centerKey: string; displayName: string; timeZone: string; status: string }>;
  paths: Array<{ id: string; code: string; displayName: string; status: string }>;
  runningClasses: Array<{ id: string; pathProgramId: string; operationalName: string; weekdayIso: number; windowStartsLocal: string; windowEndsLocal: string; optimalConcurrentCapacity: number; status: string }>;
};

export const boApi = {
  scopeCatalog: async () => {
    const state = await readOne<BoScopeBootstrap>("delivery/bootstrap-state");
    return {
      centers: state.centers.map((item): BoCenter => ({ id: item.id, key: item.centerKey, displayName: item.displayName, timeZone: item.timeZone, status: item.status })),
      paths: state.paths.map((item): BoPathProgram => ({ id: item.id, code: item.code, displayName: item.displayName, status: item.status })),
      classes: state.runningClasses.map((item): BoRunningClass => ({ id: item.id, name: item.operationalName, pathProgramId: item.pathProgramId, timezone: "Asia/Ho_Chi_Minh", recurrenceWeekdays: [item.weekdayIso], startLocalTime: item.windowStartsLocal, endLocalTime: item.windowEndsLocal, defaultCapacity: item.optimalConcurrentCapacity, status: item.status })),
    };
  },
  centers: () => read<BoCenter>("centers"),
  pathPrograms: () => read<BoPathProgram>("path-programs"),
  runningClasses: () => read<BoRunningClass>("running-classes"),
  syllabi: () => read<BoSyllabus>("syllabi"),
  sessions: () => read<BoSession>("sessions"),
  registrations: (sessionId: string) => read<BoRegistration>(`sessions/${encodeURIComponent(sessionId)}/registrations`),
  learningOwner: (sessionId: string) => readOne<BoSessionLearningOwnerProjection>(`sessions/${encodeURIComponent(sessionId)}/learning-owner`),
  assignLearningOwner: (sessionId: string, command: BoSessionLearningOwnerCommand, idempotencyKey: string) => write<BoSessionLearningOwner>(`sessions/${encodeURIComponent(sessionId)}/learning-owner`, command, idempotencyKey),
  accessRoles: () => read<BoAccessRole>("access/roles"),
  accessUsers: () => read<BoAccessUser>("access/users"),
  staffRecords: () => read<BoStaffRecord>("workforce/staff-records"),
  staffRecord: (staffMemberId: string) => readOne<BoStaffProfile>(`workforce/staff-records/${encodeURIComponent(staffMemberId)}`),
  updateStaff: (staffMemberId: string, patch: BoStaffProfilePatch) => write<BoStaffProfile>(`workforce/staff-records/${encodeURIComponent(staffMemberId)}`, patch, crypto.randomUUID()),
  setStaffStatus: (staffMemberId: string, status: "active" | "inactive") => write<{ status: string }>(`workforce/staff-records/${encodeURIComponent(staffMemberId)}/status`, { status }, crypto.randomUUID()),
  assignAccessRole: (body: { userId: string; roleId: string; scopeType: "GLOBAL" | "CENTER" | "PATH" | "RUNNING_CLASS"; scopeId: string | null }) => write<{ id: string }>("access/assignments", body, crypto.randomUUID()),
  removeAccessAssignment: (assignmentId: string) => write<{ assignmentId: string; status: string }>("access/assignments/remove", { assignmentId }, crypto.randomUUID()),
  setAccessUserStatus: (userId: string, status: "active" | "suspended", reason?: string) => write<{ status: string }>("access/users/status", { userId, status, ...(reason ? { reason } : {}) }, crypto.randomUUID()),
  reconcileTosAccess: () => write<{ state: string; emailCount: number; policyId: string | null }>("access/perimeter-reconcile", {}, crypto.randomUUID()),
  onboardStaff: (command: BoStaffOnboardingCommand, idempotencyKey: string) => write<BoStaffOnboardingResult>("workforce/staff-onboarding", command, idempotencyKey),
};
