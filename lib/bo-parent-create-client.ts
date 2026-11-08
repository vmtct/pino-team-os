import { BoApiError } from "./bo-api-error";
import { recoverInvalidStaffPasswordSession } from "./staff-session-recovery";

/** PAP-1550 / Epic PAP-1384: approved i5 Create Drawer has ONE contact input. */
export function inferParentContactType(value: string): "PHONE" | "EMAIL" | null {
  const contact = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return "EMAIL";
  if (/^[0-9+(). -]{9,18}$/.test(contact)) return "PHONE";
  return null;
}

export type BoParentStandaloneCreateInput = {
  displayName: string;
  contacts: Array<{ identifierType: "PHONE" | "EMAIL"; value: string; isPrimary: boolean }>;
};
export type BoParentStandaloneCreateResult = {
  parentUserId: string;
  version: 1;
  createdContactIdentifierIds: string[];
  directoryVisibility: "UNLINKED_NOT_LISTED";
};

const CANONICAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function createStandaloneParent(
  centerId: string, body: BoParentStandaloneCreateInput, idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<BoParentStandaloneCreateResult> {
  if (!CANONICAL_ID.test(centerId) || !idempotencyKey.trim()) {
    throw new BoApiError(400, "Center or request key is invalid.", null, true);
  }
  const response = await fetcher(
    "/api/bo/identity/parents?centerId=" + encodeURIComponent(centerId),
    { method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(body) },
  );
  const raw = await response.text();
  let envelope: {data?: unknown;error?: {message?: string;requestId?: string}};
  try { envelope = JSON.parse(raw) as typeof envelope; }
  catch { throw new BoApiError(response.status, "Back Office returned an invalid Parent response.", response.headers.get("x-request-id"), false); }
  if (!response.ok || envelope.data === undefined) {
    if (response.status === 401 && typeof window !== "undefined") void recoverInvalidStaffPasswordSession();
    const message = envelope.error?.message?.trim();
    throw new BoApiError(response.status, message || "Không thể tạo phụ huynh.",
      response.headers.get("x-request-id") ?? envelope.error?.requestId ?? null, Boolean(message));
  }
  const result = envelope.data as Partial<BoParentStandaloneCreateResult>;
  if (!result || !CANONICAL_ID.test(String(result.parentUserId)) || result.version !== 1 ||
      result.directoryVisibility !== "UNLINKED_NOT_LISTED" ||
      !Array.isArray(result.createdContactIdentifierIds) ||
      result.createdContactIdentifierIds.length !== body.contacts.length ||
      result.createdContactIdentifierIds.some(id => typeof id !== "string" || !CANONICAL_ID.test(id))) {
    throw new BoApiError(502, "Parent Create returned an invalid response.", response.headers.get("x-request-id"), false);
  }
  return result as BoParentStandaloneCreateResult;
}
