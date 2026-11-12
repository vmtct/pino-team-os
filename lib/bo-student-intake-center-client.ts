// PAP-1908 / SCH-STUDENT-MGMT — Center-bound Student Intake, isolated from shared TDD BO API.
import { BoApiError } from "./bo-api-error";
import { recoverInvalidStaffPasswordSession } from "./staff-session-recovery";
import type { BoParentSearchResult } from "./bo-model";
import type { BoStudentIntakeCreateInput } from "./bo-api";

const centerIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const canonicalIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type IntakeResult = {
  studentProfileId: string;
  parentUserId: string;
  guardianRelationshipId: string;
  parentReused: boolean;
};
type BffEnvelope<T> = { data?: T; error?: { message?: string; requestId?: string } };

function apiFailure(response: Response, body: BffEnvelope<unknown>, fallback: string): BoApiError {
  if (response.status === 401 && typeof window !== "undefined") void recoverInvalidStaffPasswordSession();
  const message = typeof body.error?.message === "string" && body.error.message.trim()
    ? body.error.message : null;
  return new BoApiError(response.status, message ?? fallback,
    response.headers.get("x-request-id") ?? body.error?.requestId ?? null, message !== null);
}

async function readEnvelope<T>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();
  let envelope: BffEnvelope<T>;
  try { envelope = JSON.parse(text) as BffEnvelope<T>; }
  catch {
    if (response.status === 401 && typeof window !== "undefined") void recoverInvalidStaffPasswordSession();
    throw new BoApiError(response.status, fallback, response.headers.get("x-request-id"), false);
  }
  if (!response.ok || envelope.data === undefined)
    throw apiFailure(response, envelope, fallback);
  return envelope.data;
}

/** A selected Center is only a hint; the Core BFF remains responsible for effective ACL. */
export const studentIntakeCenterApi = {
  parentsInCenter(centerId: string, query = "", limit = 20): Promise<BoParentSearchResult[]> {
    if (!centerIdPattern.test(centerId) || !Number.isSafeInteger(limit) || limit < 1 || limit > 25 ||
        typeof query !== "string" || query.length > 160)
      throw new BoApiError(400, "Chọn một cơ sở hợp lệ để tìm phụ huynh.", null, true);
    const path = `identity/parents/center-search?centerId=${encodeURIComponent(centerId)}&limit=${limit}&query=${encodeURIComponent(query)}`;
    return fetch(`/api/bo/${path}`, { cache: "no-store" })
      .then(response => readEnvelope<BoParentSearchResult[]>(response, "Không thể tìm phụ huynh trong cơ sở."));
  },

  async createStudentIntakeInCenter(centerId: string, body: BoStudentIntakeCreateInput, idempotencyKey: string): Promise<IntakeResult> {
    if (!centerIdPattern.test(centerId) || typeof idempotencyKey !== "string" || !idempotencyKey.trim())
      throw new BoApiError(400, "Chọn cơ sở được cấp quyền và khóa yêu cầu hợp lệ.", null, true);
    const response = await fetch(`/api/bo/student-intakes/center?centerId=${encodeURIComponent(centerId)}`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(body),
    });
    const result = await readEnvelope<IntakeResult>(response, "Không thể tạo học viên trong cơ sở.");
    const canonicalId = (value: unknown): value is string =>
      typeof value === "string" && canonicalIdPattern.test(value);
    if (!result || !canonicalId(result.studentProfileId) ||
        !canonicalId(result.parentUserId) || !canonicalId(result.guardianRelationshipId) ||
        typeof result.parentReused !== "boolean") {
      throw new BoApiError(502, "Student Center intake returned an invalid response.", null, false);
    }
    return result;
  },
};
