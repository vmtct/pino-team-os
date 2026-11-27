/** PAP-1239 / PAP-650 CP1 — authenticated TOS Front Desk House commands.
 * Only the canonical Core PinoriaHouseService writes StudentVisit + Self + Presence.
 */
export type ReceptionOpenVisit = { id: string; checkedInAt: string; version: number };
export type ReceptionLearner = {
  studentProfileId: string;
  displayName: string;
  hasCharacter: boolean;
  openVisit: ReceptionOpenVisit | null;
};
export type ReceptionHouseCheckOutInput = {
  centerId: string;
  studentProfileId: string;
  expectedVersion: number;
  checkedOutAt: string;
  reason: string;
};
export type ReceptionHouseCheckOut = {
  visit: ReceptionOpenVisit & { studentProfileId: string; centerId: string; checkedOutAt: string };
  character: { id: string } | null;
};
export type ReceptionHouseCheckIn = {
  visit: ReceptionOpenVisit & { studentProfileId: string; centerId: string };
  character: { id: string } | null;
};
type Envelope<T> = { data?: T; error?: { code?: string; message?: string } };

export class ReceptionHouseError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ReceptionHouseError";
  }
}
async function fromCore<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...options.headers },
  });
  let envelope: Envelope<T> = {};
  try { envelope = await response.json() as Envelope<T>; }
  catch { /* Preserve HTTP status rather than claiming an unsuccessful write succeeded. */ }
  if (!response.ok || envelope.data === undefined) {
    throw new ReceptionHouseError(response.status, envelope.error?.code ?? "UNKNOWN",
      envelope.error?.message ?? "Không xác minh được kết quả từ Core.");
  }
  return envelope.data;
}

export const tosReceptionHouseApi = {
  /** PAP-2138: same authenticated Center boundary as name search, no local history fallback. */
  recent: (centerId: string, signal?: AbortSignal): Promise<ReceptionLearner[]> => {
    if (!centerId) throw new ReceptionHouseError(400, "INVALID_CENTER", "Thiếu cơ sở.");
    return fromCore<ReceptionLearner[]>(`/api/tos-learning/pinoria/learners/recent?centerId=${encodeURIComponent(centerId)}`, { signal });
  },
  search: (centerId: string, query: string, signal?: AbortSignal): Promise<ReceptionLearner[]> => {
    const term = query.trim();
    if (!centerId || term.length < 2 || term.length > 120) {
      throw new ReceptionHouseError(400, "INVALID_SEARCH", "Nhập ít nhất 2 ký tự tên học viên.");
    }
    return fromCore<ReceptionLearner[]>(
      `/api/tos-learning/pinoria/learners/search?centerId=${encodeURIComponent(centerId)}&query=${encodeURIComponent(term)}`,
      { signal },
    );
  },
  // PAP-2431: transport only. The calling UI must first establish authorized pickup.
  checkOut: (input: ReceptionHouseCheckOutInput, idempotencyKey: string) => {
    if (!input.centerId || !input.studentProfileId || !idempotencyKey.trim() ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 ||
      !input.reason.trim() || !Number.isFinite(Date.parse(input.checkedOutAt))) {
      throw new ReceptionHouseError(400, "INVALID_INPUT", "Invalid checkout scope or evidence.");
    }
    return fromCore<ReceptionHouseCheckOut>("/api/tos-learning/pinoria/house/check-out", {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    }).then(result => {
      const visit = result?.visit;
      if (!visit || visit.studentProfileId !== input.studentProfileId ||
          visit.centerId !== input.centerId || !visit.id ||
          !Number.isSafeInteger(visit.version) || visit.version <= input.expectedVersion ||
          !Number.isFinite(Date.parse(visit.checkedOutAt))) {
        throw new ReceptionHouseError(502, "UNVERIFIED_CHECKOUT", "Checkout result could not be verified.");
      }
      return result;
    });
  },
  checkIn: (input: { centerId: string; studentProfileId: string; checkedInAt: string }, idempotencyKey: string) => {
    if (!input.centerId || !input.studentProfileId || !idempotencyKey) {
      throw new ReceptionHouseError(400, "INVALID_INPUT", "Thiếu thông tin xác nhận học viên.");
    }
    return fromCore<ReceptionHouseCheckIn>("/api/tos-learning/pinoria/house/check-in", {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    });
  },
};
