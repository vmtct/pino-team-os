import test from "node:test";
import assert from "node:assert/strict";
import { safeBoTableReturn, detailHref, detailTabHref } from "./bo-full-detail-navigation";

test("preserves table search, view and pagination in returnTo", () => {
  const table = "/bo/learners?view=active&search=Mai&page=3";
  const href = detailHref("/bo/learners/profile", table, "training");
  const parsed = new URL(href, "https://bo.invalid");
  assert.equal(parsed.searchParams.get("returnTo"), table);
  assert.equal(parsed.searchParams.get("tab"), "training");
  assert.equal(safeBoTableReturn(parsed.searchParams.get("returnTo")), table);
});
test("cannot turn returnTo into external redirect or dangerous protocol", () => {
  for (const input of ["https://evil.invalid", "//evil.invalid", "javascript:alert(1)", "/admin", "/bo/../admin", "/bo/learners#fragment", "/bo/learners\\evil"]) {
    assert.equal(safeBoTableReturn(input), "/bo");
  }
});
test("tab switching preserves encoded return context", () => {
  const initial = detailHref("/bo/learners/profile", "/bo/learners?view=foo", "history");
  const next = new URL(detailTabHref(initial, "notes"), "https://bo.invalid");
  assert.equal(next.searchParams.get("tab"), "notes");
  assert.equal(next.searchParams.get("returnTo"), "/bo/learners?view=foo");
  assert.throws(() => detailTabHref(initial, "../auth"));
});
