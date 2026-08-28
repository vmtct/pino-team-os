export const TOPPI_STAGING_CENTER_ID = "00000000-0000-7000-8000-000000000001";

export type CoreProgram = "CONFIDENT_COMMUNICATION" | "LANGUAGE_FOUNDATION";
export type CoreLifecycle = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type CorePackageStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "SUPERSEDED";

export type ToppiLearner = {
  student: { id: string; displayName: string; birthYear: number | null; birthMonth: number | null; birthPrecision: string; status: string };
  activeGuardianCount: number;
  primaryGuardianDisplayName: string | null;
  eligible: boolean;
};

export type ToppiDeliverySlot = {
  id: string;
  centerId: string;
  displayName: string;
  weekdayIso: number;
  startsLocal: string;
  endsLocal: string;
  capacity: number;
  status: string;
  occupied: number;
  available: number;
  revision: number;
};

export type ToppiEnrollment = {
  id: string;
  student: { id: string; displayName: string; guardianSummary: { activeCount: number; primaryDisplayName: string | null } };
  centerId: string;
  program: CoreProgram;
  stage: string;
  instructionalBand: string;
  level: number;
  lifecycle: CoreLifecycle;
  serviceStartsOnLocalDate: string | null;
  revision: number;
  package: { id: string; status: CorePackageStatus; standardUnits: 12; purchasedUnits: number; consumedUnits: number; remainingUnits: number; unitProgress: number; revision: number };
  currentPlacement: null | { id: string; slot: ToppiDeliverySlot; effectiveFromLocalDate: string; effectiveUntilExclusiveLocalDate: string | null; revision: number };
  predecessorEnrollmentId: string | null;
  successorEnrollmentId: string | null;
  nextEligibleLevel: number | null;
  renewalState: string;
  projectedCompletionLocalDate: string | null;
  createdAt: string;
};
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/toppi-staging/${path}`, { cache: "no-store", ...init });
  const body = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok || body.data === undefined) throw new Error(body.error?.message ?? "Toppi staging request failed");
  return body.data;
}

export const toppiStagingApi = {
  students: (query = "") => request<ToppiLearner[]>(`students?centerId=${TOPPI_STAGING_CENTER_ID}${query.trim() ? `&query=${encodeURIComponent(query.trim())}` : ""}`),
  slots: () => request<ToppiDeliverySlot[]>(`delivery-slots?centerId=${TOPPI_STAGING_CENTER_ID}`),
  enrollments: () => request<ToppiEnrollment[]>(`enrollments?centerId=${TOPPI_STAGING_CENTER_ID}`),
  renewals: () => request<ToppiEnrollment[]>(`renewals?centerId=${TOPPI_STAGING_CENTER_ID}`),
  createEnrollment: (input: { studentProfileId: string; program: CoreProgram; level: number; deliverySlotId: string; effectiveFromLocalDate: string }) =>
    request<ToppiEnrollment>("enrollments", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ ...input, centerId: TOPPI_STAGING_CENTER_ID }),
    }),
  createSlot: (input: { displayName: string; weekdayIso: number; startsLocal: string; endsLocal: string; capacity: number }) =>
    request<ToppiDeliverySlot>("delivery-slots", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ ...input, centerId: TOPPI_STAGING_CENTER_ID }),
    }),
};
