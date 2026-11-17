/** PAP-650 / PNR-TV · PAP-1646 — no auth claim based on HTTP status. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  policyViewerBlockedCopy,
  policyViewerBlockedReasonForHttpStatus,
} from "./pinoria-tv-viewer-admission";

for (const [status, reason] of [
  [401, "login_required"],
  [403, "access_denied"],
  [404, "not_found"],
  [503, "unavailable"],
  [500, "unavailable"],
  [429, "unavailable"],
  [200, "unavailable"],
  [204, "unavailable"],
  [0, "unavailable"],
] as const) {
  test(`PAP-1646 HTTP ${status} remains blocked as ${reason}`, () => {
    assert.equal(policyViewerBlockedReasonForHttpStatus(status), reason);
  });
}

test("PAP-1646 refuses to treat transport success as Policy authorization", () => {
  assert.notEqual(
    policyViewerBlockedReasonForHttpStatus(200), "access_denied",
    "200 still has no ready/render state; real Core authorization is separate",
  );
  assert.equal(policyViewerBlockedReasonForHttpStatus(200), "unavailable");
});

test("PAP-1646 status copy is bounded and never reveals private data", () => {
  for (const reason of ["login_required", "access_denied", "not_found", "unavailable"] as const) {
    const copy = policyViewerBlockedCopy(reason);
    assert.ok(copy.heading.length > 4);
    assert.ok(copy.description.length > 16);
    assert.ok(!copy.description.includes("token"));
    assert.ok(!copy.description.includes("Center ID"));
  }
});

test("PAP-1646 malformed reason fails closed with neutral copy", () => {
  assert.deepEqual(
    policyViewerBlockedCopy("unexpected" as "access_denied"),
    policyViewerBlockedCopy("unavailable"),
  );
});
