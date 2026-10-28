import test from "node:test";
import assert from "node:assert/strict";
import { auditQueryString, validateSubjectAuditPage, type BoSubjectAuditEvent } from "./bo-subject-history";

const id = "019a1234-5678-7000-8000-123456789abc";
const item = (changes: Partial<BoSubjectAuditEvent> = {}): BoSubjectAuditEvent => ({
  id: "019a1234-5678-7000-8000-123456789abd",
  subject_type: "student_profile",
  subject_id: id,
  occurred_at: "2026-10-24T08:00:00.000Z",
  actor_id: null,
  actor_label: "Nhân viên",
  action: "Cập nhật",
  outcome: "succeeded",
  field: null,
  before: null,
  after: null,
  description: null,
  redacted: true,
  ...changes,
});
const subject = { subject_type: "student_profile" as const, subject_id: id };
test("React /bo history uses only exact subject BFF query", () => {
  const query = new URLSearchParams(auditQueryString({ ...subject, query: "x", limit: 50, cursor: "encrypted" }));
  assert.equal(query.get("subject_type"), "student_profile");
  assert.equal(query.get("subject_id"), id);
  assert.equal(query.get("cursor"), "encrypted");
  assert.equal(query.get("centerId"), null);
});
test("PAP-1102 Subscription audit is exact subject-only, redacted, and preserves Core action labels", () => {
  const query = new URLSearchParams(auditQueryString({subject_type:"subscription",subject_id:id,limit:20}));
  assert.equal(query.get("subject_type"),"subscription");
  assert.equal(query.get("centerId"),null);
  const subscription = {subject_type:"subscription" as const,subject_id:id};
  const valid = item({subject_type:"subscription",action:"Tạo Subscription"});
  assert.deepEqual(validateSubjectAuditPage({events:[valid],nextCursor:null},subscription).events,[valid]);
  assert.throws(()=>validateSubjectAuditPage({events:[item()],nextCursor:null},subscription));
  assert.throws(()=>validateSubjectAuditPage({events:[item({subject_type:"subscription",before:"private"} as Partial<BoSubjectAuditEvent>)],nextCursor:null},subscription));
});
test("rejects cross-entity and cross-subject histories without filtering", () => {
  for (const change of [{ subject_id: "019a1234-5678-7000-8000-123456789abe" }, { subject_type: "running_class" as const }]) {
    assert.throws(() => validateSubjectAuditPage({ events: [item(), item(change)], nextCursor: null }, subject));
  }
});
test("rejects unredacted or malformed data, never exposes fake before/after", () => {
  for (const change of [{ before: "secret" }, { after: "secret" }, { actor_id: id }, { redacted: false }, { description: "private" }, { payload_json: "private" }]) {
    assert.throws(() => validateSubjectAuditPage({ events: [item(change as Partial<BoSubjectAuditEvent>)], nextCursor: null }, subject));
  }
});
test("rejects duplicate records and new-to-old ordering failures", () => {
  assert.throws(() => validateSubjectAuditPage({ events: [item(), item()], nextCursor: null }, subject));
  assert.throws(() => validateSubjectAuditPage({ events: [item(), item({ id: "second", occurred_at: "2026-10-25T08:00:00.000Z" })], nextCursor: null }, subject));
});
test("accepts paginated decreasing timestamp and rejects repeat cursor", () => {
  const prior = item();
  const later = item({ id: "019a1234-5678-7000-8000-123456789abf", occurred_at: "2026-10-23T08:00:00.000Z" });
  assert.deepEqual(validateSubjectAuditPage({ events: [later], nextCursor: null }, subject, [prior], "old").events, [later]);
  assert.throws(() => validateSubjectAuditPage({ events: [], nextCursor: "old" }, subject, [prior], "old"));
});
