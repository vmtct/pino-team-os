import assert from "node:assert/strict";
import test from "node:test";
import {
  boDataGridRange,
  createBoDataGridUrlStateBuffer,
  parseBoDataGridUrlState,
  withBoDataGridFilter,
  withBoDataGridPatch,
  writeBoDataGridUrlState,
} from "./bo-data-grid-state";

test("BO data grid URL state parses bounded defaults and typed filters", () => {
  assert.deepEqual(parseBoDataGridUrlState("?q=Minh&sort=status&dir=desc&page=3&size=50&f_status=ACTIVE&f_center=ct01"), {
    search: "Minh",
    sortKey: "status",
    sortDirection: "desc",
    page: 3,
    pageSize: 50,
    filters: { status: "ACTIVE", center: "ct01" },
  });
});

test("BO data grid URL state rejects invalid page and size values", () => {
  assert.deepEqual(parseBoDataGridUrlState("?page=-4&size=999&dir=nope"), {
    search: "",
    sortKey: null,
    sortDirection: "asc",
    page: 1,
    pageSize: 25,
    filters: {},
  });
});

test("BO data grid URL writes only non-default state and preserves unrelated params", () => {
  const state = parseBoDataGridUrlState("?studentId=s1");
  const next = withBoDataGridFilter(withBoDataGridPatch(state, { search: "piano", sortKey: "name", sortDirection: "asc", pageSize: 50 }), "status", "ACTIVE");
  const params = writeBoDataGridUrlState("?studentId=s1&legacy=keep", { ...next, page: 2 });
  assert.equal(params.get("studentId"), "s1");
  assert.equal(params.get("legacy"), "keep");
  assert.equal(params.get("q"), "piano");
  assert.equal(params.get("sort"), "name");
  assert.equal(params.get("dir"), "asc");
  assert.equal(params.get("page"), "2");
  assert.equal(params.get("size"), "50");
  assert.equal(params.get("f_status"), "ACTIVE");
});

test("BO data grid interaction patches reset pagination unless page is explicit", () => {
  const state = parseBoDataGridUrlState("?page=7&size=25");
  assert.equal(withBoDataGridPatch(state, { search: "new" }).page, 1);
  assert.equal(withBoDataGridPatch(state, { page: 4 }).page, 4);
  assert.equal(withBoDataGridFilter({ ...state, page: 7 }, "status", "ACTIVE").page, 1);
});

test("BO data grid optimistic URL buffer preserves rapid controlled search input", () => {
  const buffer = createBoDataGridUrlStateBuffer(parseBoDataGridUrlState(""));
  const first = withBoDataGridPatch(buffer.current(), { search: "a" });
  buffer.apply(first, "q=a");
  const second = withBoDataGridPatch(buffer.current(), { search: "ab" });
  buffer.apply(second, "q=ab");

  assert.equal(buffer.current().search, "ab");
  assert.equal(buffer.reconcile(parseBoDataGridUrlState("?q=a"), "q=a", true), false);
  assert.equal(buffer.current().search, "ab");

  const third = withBoDataGridPatch(buffer.current(), { search: "abc" });
  buffer.apply(third, "q=abc");
  assert.equal(buffer.current().search, "abc");
  assert.equal(buffer.reconcile(parseBoDataGridUrlState("?q=abc"), "q=abc", false), false);
  assert.equal(buffer.current().search, "abc");
  assert.equal(buffer.requestedQuery(), null);
});

test("BO data grid optimistic URL buffer preserves normalized multiword search drafts", () => {
  const buffer = createBoDataGridUrlStateBuffer(parseBoDataGridUrlState("?q=Alice"));
  const draft = withBoDataGridPatch(buffer.current(), { search: "Alice " });
  buffer.apply(draft, "q=Alice");

  assert.equal(buffer.current().search, "Alice ");
  assert.equal(buffer.reconcile(parseBoDataGridUrlState("?q=Alice"), "q=Alice", true), false);
  assert.equal(buffer.current().search, "Alice ");
  assert.equal(buffer.requestedQuery(), "q=Alice");
  assert.equal(buffer.reconcile(parseBoDataGridUrlState("?q=Alice"), "q=Alice", false), false);
  assert.equal(buffer.current().search, "Alice ");
  assert.equal(buffer.requestedQuery(), null);

  const continued = withBoDataGridPatch(buffer.current(), { search: "Alice B" });
  buffer.apply(continued, "q=Alice+B");
  assert.equal(buffer.current().search, "Alice B");
});

test("BO data grid optimistic URL buffer reconciles when navigation settles elsewhere", () => {
  const buffer = createBoDataGridUrlStateBuffer(parseBoDataGridUrlState(""));
  buffer.apply(withBoDataGridPatch(buffer.current(), { search: "draft" }), "q=draft");
  assert.equal(buffer.reconcile(parseBoDataGridUrlState("?q=external"), "q=external", false), true);
  assert.equal(buffer.current().search, "external");
  assert.equal(buffer.requestedQuery(), null);
});

test("BO data grid range clamps pages and handles an empty result", () => {
  assert.deepEqual(boDataGridRange(2, 10, 36), { from: 11, to: 20, total: 36, pageCount: 4, page: 2 });
  assert.deepEqual(boDataGridRange(99, 10, 36), { from: 31, to: 36, total: 36, pageCount: 4, page: 4 });
  assert.deepEqual(boDataGridRange(1, 10, 0), { from: 0, to: 0, total: 0, pageCount: 0, page: 1 });
});
