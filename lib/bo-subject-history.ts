/** PAP-979: validated, redacted Core BO subject audit contract. Never use Access-admin audit. */
export type BoAuditSubjectType = "student_profile" | "running_class";
export type BoSubjectAuditEvent = {
  id: string;
  subject_type: BoAuditSubjectType;
  subject_id: string;
  occurred_at: string;
  actor_id: null;
  actor_label: string;
  action: string;
  outcome: "succeeded" | "failed" | "denied";
  field: null;
  before: null;
  after: null;
  description: null;
  redacted: true;
};
export type BoSubjectAuditPage = { events: BoSubjectAuditEvent[]; nextCursor: string | null };
export type BoSubjectAuditQuery = { subject_type: BoAuditSubjectType; subject_id: string; query?: string; cursor?: string | null; limit?: number };

export function auditQueryString(input: BoSubjectAuditQuery): string {
  const url = new URLSearchParams({
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    query: input.query ?? "",
    limit: String(input.limit ?? 50),
  });
  if (input.cursor) url.set("cursor", input.cursor);
  return url.toString();
}

/** Reject the complete response rather than silently filtering cross-entity or sensitive events. */
export function validateSubjectAuditPage(
  page: BoSubjectAuditPage, subject: BoSubjectAuditQuery,
  previous: readonly BoSubjectAuditEvent[] = [], priorCursor?: string | null,
): BoSubjectAuditPage {
  if (!page || !Array.isArray(page.events) || page.events.length > 50 ||
      !(page.nextCursor === null || (typeof page.nextCursor === "string" && page.nextCursor.length > 0 && page.nextCursor.length <= 2048)) ||
      (priorCursor && page.nextCursor === priorCursor)) throw Error("Phản hồi lịch sử không hợp lệ.");
  const seen = new Set(previous.map(event => event.id));
  let previousAt = previous.at(-1)?.occurred_at;
  let previousId = previous.at(-1)?.id;
  const allowed = new Set(["id", "subject_type", "subject_id", "occurred_at", "actor_id", "actor_label", "action", "outcome", "field", "before", "after", "description", "redacted"]);
  for (const event of page.events) {
    if (!event || Object.keys(event).some(key => !allowed.has(key)) || event.subject_type !== subject.subject_type || event.subject_id !== subject.subject_id ||
        typeof event.id !== "string" || seen.has(event.id) ||
        typeof event.occurred_at !== "string" || !Number.isFinite(Date.parse(event.occurred_at)) ||
        !["succeeded", "failed", "denied"].includes(event.outcome) ||
        typeof event.actor_label !== "string" || typeof event.action !== "string" ||
        event.actor_id !== null || event.field !== null || event.before !== null ||
        event.after !== null || event.description !== null || event.redacted !== true) {
      throw Error("Không xác nhận được phạm vi lịch sử.");
    }
    if (previousAt && (Date.parse(event.occurred_at) > Date.parse(previousAt) ||
      (event.occurred_at === previousAt && event.id >= (previousId ?? "")))) {
      throw Error("Thứ tự lịch sử không hợp lệ.");
    }
    seen.add(event.id);
    previousAt = event.occurred_at;
    previousId = event.id;
  }
  return page;
}
