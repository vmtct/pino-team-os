import assert from "node:assert/strict";
import test from "node:test";
import { staffDirectoryHref, staffDirectoryReturnQuery, staffFullDetailHref } from "./bo-staff-detail-navigation";

test("PAP-781 detail URL round trips Staff grid search/filter/sort/page context", () => {
  const original = new URLSearchParams("q=H%C3%A2n&sort=staff&dir=desc&page=3&size=50&f_staffStatus=active&f_accessStatus=suspended&staff=staff-02");
  const route = staffFullDetailHref("staff-02", original);
  const parsed = new URL(route, "https://pino.test");
  assert.equal(parsed.pathname, "/bo/staff/staff-02");
  assert.equal(staffDirectoryHref(parsed.searchParams, true), "/bo/staff?q=H%C3%A2n&sort=staff&dir=desc&page=3&size=50&f_staffStatus=active&f_accessStatus=suspended");
});

test("PAP-781 strips private selection and arbitrary redirect-like query fields", () => {
  const query = "q=ok&staff=private&from=foo&next=https%3A%2F%2Fevil.test&token=secret&f_staffStatus=all";
  const list = staffDirectoryReturnQuery(query, false);
  assert.equal(list.get("staff"), null);
  assert.equal(list.get("from"), null);
  assert.equal(list.get("next"), null);
  assert.equal(list.get("token"), null);
  assert.equal(list.get("q"), "ok");
  assert.equal(list.get("f_staffStatus"), "all");
  assert.equal(staffDirectoryHref("?from=q%3Ddemo%26staff%3Dsecret%26token%3Dredacted", true), "/bo/staff?q=demo");
});

test("PAP-781 keeps encoded Staff IDs within local BO route and safe direct detail fallback", () => {
  const link = staffFullDetailHref("staff/a 1", "from=ignored&staff=other");
  assert.equal(link, "/bo/staff/staff%2Fa%201");
  assert.equal(staffDirectoryHref("", true), "/bo/staff");
});
