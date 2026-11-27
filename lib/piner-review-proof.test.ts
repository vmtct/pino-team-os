import assert from "node:assert/strict";
import test from "node:test";
import { decidePinerSyntheticReviewer } from "./m1-preview/piner-review-proof.server";
const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const now = Date.parse("2026-11-25T00:00:00Z");
const session = { id: other, issuedAt: "2026-11-24T00:00:00Z", expiresAt: "2026-12-01T00:00:00Z" };
const reply = { data: { principalType: "PARENT_USER", parent: { id, displayName: "Synthetic test" }, session } };
const allowlist = (programs: string[]) => JSON.stringify([{ parentUserId: id, programs }]);
const valid = { environment: "staging", enabled: "true", reviewerAllowlist: allowlist(["house", "mytime"]),
  privateSessionReply: reply, now, program: "house" as const };
const deny = { allowed: false };
test("only exact server-configured reviewer and program are admitted; no identity emitted", () => {
  assert.deepEqual(decidePinerSyntheticReviewer(valid), { allowed: true, program: "house" });
  assert.deepEqual(decidePinerSyntheticReviewer({ ...valid, program: "mytime" }), { allowed: true, program: "mytime" });
  assert.deepEqual(decidePinerSyntheticReviewer({ ...valid, program: "mytime", reviewerAllowlist: allowlist(["house"]) }), deny);
  assert.deepEqual(decidePinerSyntheticReviewer({ ...valid, reviewerAllowlist: JSON.stringify([{ parentUserId: other, programs: ["house"] }]) }), deny);
});
test("default off, no production, immediate config revocation", () => {
  for (const change of [{ environment: "production" }, { environment: "development" }, { enabled: "false" }, { enabled: "" },
    { reviewerAllowlist: "" }, { reviewerAllowlist: "[]" }, { reviewerAllowlist: "not-json" }]) {
    assert.deepEqual(decidePinerSyntheticReviewer({ ...valid, ...change }), deny);
  }
  const { enabled: _enabled, ...missing } = valid;
  assert.deepEqual(decidePinerSyntheticReviewer(missing), deny);
});
test("reject browser session DTO, absent/invalid principal and expired or misclassified session", () => {
  const malformed = [null, { data: { authenticated: true, expiresAt: session.expiresAt } }, { data: { ...reply.data, principalType: "STAFF" } },
    { data: { ...reply.data, parent: { id: "synthetic" } } }, { data: { ...reply.data, parent: null } },
    { data: { ...reply.data, session: { ...session, id: "" } } },
    { data: { ...reply.data, session: { ...session, expiresAt: "2026-11-25T00:00:00Z" } } },
    { data: { ...reply.data, session: { ...session, issuedAt: "2026-11-26T00:00:00Z" } } },
    { data: { ...reply.data, session: { ...session, expiresAt: "2027-02-01T00:00:00Z" } } },
    { data: { ...reply.data, session: { ...session, expiresAt: "invalid" } } }];
  for (const privateSessionReply of malformed) assert.deepEqual(decidePinerSyntheticReviewer({ ...valid, privateSessionReply }), deny);
  assert.deepEqual(decidePinerSyntheticReviewer({ ...valid, now: NaN }), deny);
});
test("fail closed for ambiguous or malformed server configuration, even after a matching entry", () => {
  const good = { parentUserId: id, programs: ["house"] };
  for (const v of [[good, good], [good, { parentUserId: other, programs: ["all"] }],
    [good, { parentUserId: other, programs: ["house", "house"] }], [good, { parentUserId: other, programs: [] }],
    [{ ...good, extra: true }], { [id]: ["house"] }, [null]]) {
    assert.deepEqual(decidePinerSyntheticReviewer({ ...valid, reviewerAllowlist: JSON.stringify(v) }), deny);
  }
});
