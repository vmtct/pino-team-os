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
