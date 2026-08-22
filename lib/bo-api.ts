import type { BoPathProgram, BoRegistration, BoRunningClass, BoSession, BoSyllabus } from "./bo-model";

export class BoApiError extends Error {
  constructor(readonly status: number, message: string, readonly requestId: string | null) {
    super(message);
    this.name = "BoApiError";
  }
}

async function read<T>(path: string): Promise<T[]> {
  const response = await fetch(`/api/bo/${path}`, { cache: "no-store" });
  const body = await response.json() as { data?: T[]; error?: { message?: string; requestId?: string } };
  if (!response.ok || !body.data) {
    throw new BoApiError(response.status, body.error?.message ?? "Back Office data could not be loaded.", response.headers.get("x-request-id") ?? body.error?.requestId ?? null);
  }
  return body.data;
}

export const boApi = {
  pathPrograms: () => read<BoPathProgram>("path-programs"),
  runningClasses: () => read<BoRunningClass>("running-classes"),
  syllabi: () => read<BoSyllabus>("syllabi"),
  sessions: () => read<BoSession>("sessions"),
  registrations: (sessionId: string) => read<BoRegistration>(`sessions/${encodeURIComponent(sessionId)}/registrations`),
};
