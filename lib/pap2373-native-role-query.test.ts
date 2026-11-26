import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNativeRoleQuery } from "../app/ho/system/roles/native-role-query";

const id = "01a17d3f-8697-7080-bdf1-33e939758059";
const parse = (query: string) => parseNativeRoleQuery(new URLSearchParams(query));

test("PAP-2373 native list and canonical real record preserve the existing HO navigation contract", () => {
  assert.deepEqual(parse(""), {});
  assert.deepEqual(parse("record=" + id), { record: id });
  assert.deepEqual(parse("record=" + id.toUpperCase()), { record: id.toUpperCase() });
  assert.deepEqual(parse("record=" + id + "&utm_source=test"), { record: id });
  assert.deepEqual(parse("utm_medium=campaign"), {});
});

test("PAP-2373 retired fixture selectors cannot become native records", () => {
  for (const query of ["m1Preview=1", "m1Preview=0", "record=ROLE-MOCK-001",
    "m1Preview=1&record=ROLE-MOCK-001", "m1Preview=1&record=" + id,
    "record=STAFF-MOCK-001", "record=undefined", "record="]) {
    assert.equal(parse(query), null, query);
  }
});

test("PAP-2373 ambiguous, malformed and non-owned query state fail closed", () => {
  for (const query of ["record=" + id + "&record=" + id,
    "record=" + id + "&tab=permissions", "record=" + id + "&centerId=" + id,
    "returnTo=%2F%2Fevil.example", "record=" + id + "%0A",
    "record=" + id + "%20", "record=not-a-uuid", "Record=" + id]) {
    assert.equal(parse(query), null, query);
  }
});
