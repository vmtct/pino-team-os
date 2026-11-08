/** PAP-650 / PNR-TV · PAP-1386 / PAP-1419 S3 regression evidence. */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TvPolicyDirectory } from "../app/ho/pinoria/tv-policies/TvPolicyDirectory";
import { BoDataTable } from "../app/bo/components/registration/BoDataTable";
import { defaultTable } from "./bo-registration";
import { isHoTvReadRequest } from "./ho-tv-read-contract";
import { readHoTvPolicyDirectory, tvPolicyModule } from "./ho-tv-policy-directory";

test("S3 projects exactly the Founder-approved 14 data fields, audit quartet visible", () => {
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

test("missing Core directory is unavailable with unknown total, never successful empty or inferred rows", () => {
  const read = readHoTvPolicyDirectory();
  assert.equal(read.status, "unavailable");
  assert.equal(read.reason, "CORE_POLICY_DIRECTORY_CONTRACT_MISSING");
  assert.equal(read.total, null);
  assert.deepEqual(read.rows, []);
  // A caller cannot turn local presentation state into a subsequent Core read.
  (read.rows as unknown[]).push({ id: "fabricated" });
  assert.deepEqual(readHoTvPolicyDirectory().rows, []);
});

test("no guessed Policy directory route is admitted by the private read allowlist", () => {
  for (const path of ["tv-policies", "tv-policy", "tv-config/policy/directory", "tv-health/policies"]) {
    for (const method of ["GET", "POST", "PATCH", "DELETE"])
      assert.equal(isHoTvReadRequest("/api/ho/pinoria/" + path, method), false);
  }
});

test("unavailable shared Table renders all headers and an alert without a false zero total or record actions", () => {
  const html = renderToStaticMarkup(createElement(TvPolicyDirectory));
  assert.equal((html.match(/<th /g) ?? []).length, 14);
  assert.match(html, /role="alert"/);
  assert.match(html, /số lượng chính sách chưa xác định/);
  assert.doesNotMatch(html, /id="result-count"|id="page-range"|data-record=|Mở Quick View|Tạo mới|Mở TV|Sao chép URL/);
});

test("shared Table keeps existing footer behavior unless totalKnown is explicitly false", () => {
  const noop = () => {};
  const props = {
    module: tvPolicyModule, rows: [], loadState: "ready", value: defaultTable(tvPolicyModule.fields),
    update: noop, page: 1, setPage: noop, onOpen: noop, onSettings: noop,
    filterOpen: false, setFilterOpen: noop, views: [], changeViews: noop,
    activeView: null, applyView: noop, reset: noop, undo: noop, canUndo: false,
  };
  assert.match(renderToStaticMarkup(createElement(BoDataTable, props)), /id="result-count"/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(BoDataTable, { ...props, totalKnown: false })), /id="result-count"/);
});
