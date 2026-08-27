import { BoApiError } from "./bo-api";

export interface ReviewedEnrollmentActivationResult {
  effectiveFromLocalDate: string;
  placedSubscriptions: number;
  enrollments: number;
  created: number;
  reused: number;
  unresolvedSubscriptions: number;
}

export async function activateReviewedEnrollments(centerId: string): Promise<ReviewedEnrollmentActivationResult> {
  const response = await fetch("/api/bo/delivery/enrollment-activation", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `reviewed-enrollment-activation-v1:${centerId}`,
    },
    body: JSON.stringify({ centerId }),
  });
  const payload = await response.json() as { data?: ReviewedEnrollmentActivationResult; error?: { message?: string; requestId?: string } };
  if (!response.ok || payload.data === undefined) {
    throw new BoApiError(response.status, payload.error?.message ?? "Reviewed Enrollment activation could not be completed.", response.headers.get("x-request-id") ?? payload.error?.requestId ?? null);
  }
  return payload.data;
}
