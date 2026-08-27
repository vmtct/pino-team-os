import { BoApiError } from "./bo-api";

export type DeliveryTopology = "FIXED_COHORT" | "OVERLAPPING_COHORT" | "FLEXIBLE_STUDIO";
export type DeliveryStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface F3Center { id: string; centerKey: string; displayName: string; timeZone: string; status: string }
export interface F3Path { id: string; code: string; displayName: string; status: string; version: number }
export interface F3LearningSpace { id: string; centerId: string; code: string; displayName: string; optimalConcurrentCapacity: number; hardConcurrentCapacity: number | null; status: DeliveryStatus; version: number }
export interface F3RunningClass { id: string; centerId: string; pathProgramId: string; learningSpaceId: string; operationalName: string; weekdayIso: number; windowStartsLocal: string; windowEndsLocal: string; deliveryTopology: DeliveryTopology; defaultParticipationMinutes: number | null; optimalConcurrentCapacity: number; hardConcurrentCapacity: number | null; status: DeliveryStatus; version: number }
export interface F3RunningClassBlock { id: string; runningClassId: string; blockKind: "LEARNING" | "BRIDGE" | "TRANSITION"; startsOffsetMinutes: number; endsOffsetMinutes: number; sharedBlockKey: string | null; label: string | null }
export interface F3Term { id: string; centerId: string; code: string; displayName: string; startDate: string; endDate: string; weekCount: number }
export interface F3TermWeek { id: string; termId: string; code: string; ordinal: number; startDate: string; endDate: string; rhythmKey: string }
export interface F3Session { id: string; centerId: string; pathProgramId: string; learningSpaceId: string | null; runningClassId: string | null; localDate: string; startsLocal: string; endsLocal: string; startsAt: string; endsAt: string; timeZone: string; status: string }
export interface F3PolicyStream { streamId: string; targetType: "CENTER" | "GLOBAL"; targetId: string | null; revision: number; draftVersionId: string | null; draftVersion: number | null; draftValue: { horizonDays: number } | null; publishedVersionId: string | null; publishedVersion: number | null; effectiveFrom: string | null; effectiveUntil: string | null; publishedValue: { horizonDays: number } | null }

export interface F3BootstrapState {
  asOf: string;
  centers: F3Center[];
  paths: F3Path[];
  learningSpaces: F3LearningSpace[];
  runningClasses: F3RunningClass[];
  runningClassBlocks: F3RunningClassBlock[];
  terms: F3Term[];
  termWeeks: F3TermWeek[];
  upcomingSessions: F3Session[];
  materializationPolicyStreams: F3PolicyStream[];
}

export const f3DeliveryApi = {
  bootstrap: () => readOne<F3BootstrapState>("delivery/bootstrap-state"),
  createLearningSpace: (body: unknown) => writeOne<F3LearningSpace>("delivery/learning-spaces", body),
  createRunningClass: (body: unknown) => writeOne<F3RunningClass>("delivery/running-classes", body),
  createRunningClassBlock: (body: unknown) => writeOne<F3RunningClassBlock>("delivery/running-class-blocks", body),
  createMaterializationPolicyDraft: (body: unknown) => writeOne<{ streamId: string; versionId: string; version: number; revision: number }>("policies/delivery/materialization.v1/versions", body),
  publishMaterializationPolicy: (versionId: string, body: unknown) => writeOne<{ published: boolean }>(`policies/delivery/materialization.v1/versions/${encodeURIComponent(versionId)}/publish`, body),
  materialize: (body: unknown) => writeOne<{ policy: { horizonDays: number }; attempted: number; materialized: number; existing: number; excluded: number; noOccurrence: number }>("delivery/materializations", body),
};

async function readOne<T>(path: string): Promise<T> {
  const response = await fetch(`/api/bo/${path}`, { cache: "no-store" });
  return parse<T>(response, "Back Office delivery state could not be loaded.");
}

async function writeOne<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/bo/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return parse<T>(response, "Back Office delivery command could not be completed.");
}

async function parse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json() as { data?: T; error?: { message?: string; requestId?: string } };
  if (!response.ok || payload.data === undefined) {
    throw new BoApiError(response.status, payload.error?.message ?? fallback, response.headers.get("x-request-id") ?? payload.error?.requestId ?? null);
  }
  return payload.data;
}
