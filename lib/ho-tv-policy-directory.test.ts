/** PAP-650 / PNR-TV · PAP-1386 / PAP-1419: HO S3 exact Core read contracts. */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TvPolicyDirectory } from "../app/ho/pinoria/tv-policies/TvPolicyDirectory";
import { BoDataTable } from "../app/bo/components/registration/BoDataTable";
import { defaultTable } from "./bo-registration";
import { isHoTvReadRequest, parseHoTvRead, InvalidTvReadQuery } from "./ho-tv-read-contract";
import { HO_STAGING_HOSTNAME, BO_STAGING_HOSTNAME, decideHostBoundary } from "./host-boundary";
import { loadHoTvPolicyDirectory, readHoTvPolicyDirectory, tvPolicyModule } from "./ho-tv-policy-directory";

const c1 = "019b1126-0001-7000-8000-000000000001";
const defaultRow = {
  id: "tvp1-default", centerId: null, name: "Ambient Welcome · Mặc định",
  typeName: "Ambient Welcome", scope: "DEFAULT", center: null,
  resolution: "UNCONFIGURED", inherited: null, active: null, latest: null,
  displaysCount: null, aspectRatio: "16:9",
  createdAt: null, createdByUser: null, updatedAt: null, updatedByUser: null,
};
const centerRow = {
  ...defaultRow, id: "tvp1-center-" + c1, centerId: c1, scope: "CENTER",
  name: "Ambient Welcome · Cần Thơ", center: "Cần Thơ",
  resolution: "INHERITED", inherited: "DEFAULT", active: 1, latest: null,
};
const answer = (data: unknown, status = 200) =>
  new Response(JSON.stringify({data}), {status, headers: {"content-type": "application/json"}});
const reply = (data: unknown, status = 200): typeof fetch =>
  (async () => answer(data, status)) as typeof fetch;

test("S3 projects exactly 14 approved read-only data fields and audit quartet", () => {
  assert.deepEqual(tvPolicyModule.fields.map(f => f.label), [
    "Policy", "Loại TV", "Scope", "Center", "Effective State", "Inherited From",
    "Active Revision", "Head Revision", "Displays", "Frame", "Created Time",
    "Created by (User)", "Last Modified Time", "Last Modified by (User)",
  ]);
  const state = defaultTable(tvPolicyModule.fields);
  assert.equal(state.visible.length, 14);
  assert.deepEqual(state.visible, state.order);
  assert.ok(tvPolicyModule.fields.every(f => f.readonly));
});

test("private HO Directory is exact GET with bounded unique query; other hosts and writes denied", () => {
  const path = "/api/ho/pinoria/tv-policies/directory";
  const parse = (suffix = "") => parseHoTvRead(new URL("https://" + HO_STAGING_HOSTNAME + path + suffix));
  assert.equal(isHoTvReadRequest(path, "GET"), true);
  assert.deepEqual(parse(), {path: "pinoria/tv-policies/directory", body: {limit: 25, offset: 0}});
  assert.deepEqual(parse("?limit=50&offset=0"), {path: "pinoria/tv-policies/directory", body: {limit: 50, offset: 0}});
  for (const suffix of ["?debug=true", "?limit=51", "?limit=0", "?limit=02", "?offset=-1",
    "?offset=10001", "?limit=25&limit=25"]) assert.throws(() => parse(suffix), InvalidTvReadQuery);
  for (const method of ["POST", "PATCH", "PUT", "DELETE"])
    assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME, path, method).action, "not_found");
  assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME, path, "GET").action, "next");
  assert.equal(decideHostBoundary(BO_STAGING_HOSTNAME, path, "GET").action, "not_found");
  for (const wrong of ["tv-policies", "tv-policy", "tv-policies/directory/extra",
    "tv-config/policy/directory", "tv-health/policies"])
    assert.equal(isHoTvReadRequest("/api/ho/pinoria/" + wrong, "GET"), false);
});

test("unverified initial Core Directory and SSR Table never fabricate rows or zero count", () => {
  const read = readHoTvPolicyDirectory();
  assert.equal(read.status, "unavailable");
  assert.equal(read.total, null);
  assert.deepEqual(read.rows, []);
  const html = renderToStaticMarkup(createElement(TvPolicyDirectory));
  assert.equal((html.match(/<th /g) ?? []).length, 14);
  assert.match(html, /role="status"/);
  assert.match(html, /Đang tải dữ liệu/);
  assert.doesNotMatch(html, /id="result-count"|id="page-range"|data-record=|Mở Quick View|Tạo mới|Mở TV|Sao chép URL/);
});

test("private Core 200 projects only validated source rows with truthful nulls", async () => {
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return answer({policies: [defaultRow, centerRow], total: 2, limit: 50, offset: 0, nextOffset: null});
  }) as typeof fetch;
  const read = await loadHoTvPolicyDirectory(fetcher);
  assert.equal(read.status, "ready");
  assert.equal(read.total, 2);
  assert.equal(read.rows[0]?.createdByUser, null);
  assert.equal(read.rows[1]?.displaysCount, null);
  assert.equal(read.rows[1]?.inherited, "DEFAULT");
  assert.deepEqual(calls, ["/api/ho/pinoria/tv-policies/directory?limit=50&offset=0"]);
});

test("unverified Core payload, fabricated revisions, duplicates and partial pagination fail closed", async () => {
  for (const policies of [
    [{...defaultRow, createdByUser: "unverified"}],
    [{...defaultRow, displaysCount: 0}],
    [{...defaultRow, active: 3}],
    [{...defaultRow, id: "unsafe"}],
    [defaultRow, defaultRow],
  ]) {
    const read = await loadHoTvPolicyDirectory(reply({policies, total: policies.length, limit: 50, offset: 0, nextOffset: null}));
    assert.equal(read.status, "unavailable");
    assert.equal(read.total, null);
    assert.deepEqual(read.rows, []);
  }
  const partial = await loadHoTvPolicyDirectory(reply({policies: [defaultRow], total: 2, limit: 50, offset: 0, nextOffset: null}));
  assert.equal(partial.status, "unavailable");
  assert.deepEqual(partial.rows, []);
});

test("401/403 deny and failed Core read cannot display Policy count or records", async () => {
  for (const status of [401, 403]) {
    const result = await loadHoTvPolicyDirectory(reply(null, status));
    assert.equal(result.status, "denied");
    assert.equal(result.total, null);
    assert.deepEqual(result.rows, []);
  }
  const bad = await loadHoTvPolicyDirectory((async () => new Response("gateway", {status: 503})) as typeof fetch);
  assert.equal(bad.status, "unavailable");
  assert.deepEqual(bad.rows, []);
});

test("shared Table retains original footer behavior unless totalKnown=false", () => {
  const noop = () => {};
  const props = {
    module: tvPolicyModule, rows: [], loadState: "ready", value: defaultTable(tvPolicyModule.fields),
    update: noop, page: 1, setPage: noop, onOpen: noop, onSettings: noop,
    filterOpen: false, setFilterOpen: noop, views: [], changeViews: noop,
    activeView: null, applyView: noop, reset: noop, undo: noop, canUndo: false,
  };
  assert.match(renderToStaticMarkup(createElement(BoDataTable, props)), /id="result-count"/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(BoDataTable, {...props, totalKnown: false})), /id="result-count"/);
});

test("loaded S3 rows are readable but cannot advertise an unimplemented S4 Quick View", () => {
  const noop = () => {};
  const row = {
    id: "tvp1-default", name: "Ambient Welcome", scope: "DEFAULT",
    typeName: "Ambient Welcome", center: null, resolution: "UNCONFIGURED",
    inherited: null, active: null, latest: null, displaysCount: null, aspectRatio: "16:9",
    createdAt: null, createdByUser: null, updatedAt: null, updatedByUser: null,
  };
  const html = renderToStaticMarkup(createElement(BoDataTable, {
    module: tvPolicyModule, rows: [row], loadState: "ready",
    value: defaultTable(tvPolicyModule.fields), update: noop, page: 1, setPage: noop,
    onOpen: noop, onSettings: noop, filterOpen: false, setFilterOpen: noop, views: [],
    changeViews: noop, activeView: null, applyView: noop, reset: noop,
    undo: noop, canUndo: false, openEnabled: false, showChrome: false,
  }));
  assert.match(html, /data-record="tvp1-default"/);
  assert.match(html, /disabled=""/);
  assert.doesNotMatch(html, /Mở Quick View|data-open="tvp1-default"/);
});
