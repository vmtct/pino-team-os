import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoDataTable } from "../app/bo/components/registration/BoDataTable";
import { studentSubscriptionTableState } from "./bo-student-subscription-rows";
import type { BoModule, BoRecord } from "./bo-registration";

const moduleConfig: BoModule = {
  label: "Subscriptions",
  group: "SCHOOL",
  fields: [
    { key: "name", label: "Học viên", type: "text", icon: "Aa", w: 150 },
    { key: "id", label: "ID", type: "id", icon: "#", w: 120 },
    { key: "start", label: "Ngày bắt đầu", type: "date", icon: "▦", w: 140 },
    { key: "path", label: "Path", type: "text", icon: "Aa", w: 150 },
  ],
};
const rows: BoRecord[] = [
  { id: "old", name: "Student A", start: "2026-01-01", path: "ART" },
  { id: "new", name: "Student A", start: "2026-09-01", path: "PIANO" },
];
function render(showChrome: boolean, data = rows, loadState = "ready"): string {
  return renderToStaticMarkup(createElement(BoDataTable, {
    module: moduleConfig,
    rows: data,
    loadState,
    value: studentSubscriptionTableState(moduleConfig.fields),
    update: () => {},
    page: 1,
    setPage: () => {},
    onOpen: () => {},
    onSettings: () => {},
    filterOpen: false,
    setFilterOpen: () => {},
    views: [],
    changeViews: () => {},
    activeView: null,
    applyView: () => {},
    reset: () => {},
    undo: () => {},
    canUndo: false,
    showChrome,
  }));
}

test("embedded Subscription table omits view tabs, toolbar and filter chips in rendered DOM", () => {
  const html = render(false);
  assert.doesNotMatch(html, /class="view-tabs"/);
  assert.doesNotMatch(html, /class="toolbar"/);
  assert.doesNotMatch(html, /id="active-chips"/);
  assert.match(html, /class="table-scroll"/);
  assert.doesNotMatch(html, /data-column="name"/);
  assert.ok(html.indexOf('data-column="start"') < html.indexOf('data-column="id"'));
  assert.ok(html.indexOf('data-record="new"') < html.indexOf('data-record="old"'));
});

test("the independent Subscription table retains its existing controls", () => {
  const html = render(true);
  assert.match(html, /class="view-tabs"/);
  assert.match(html, /class="toolbar"/);
  assert.match(html, /id="active-chips"/);
});

test("native table status occupies only the measured scroll viewport; populated rows are unchanged", () => {
  const populated = render(true);
  assert.doesNotMatch(populated, /class="empty-table"/);
  for (const [state, role, text] of [["ready", "", "Không có bản ghi phù hợp"], ["loading", "status", "Đang tải dữ liệu"], ["Không tải được", "alert", "Không tải được"]]) {
    const html = render(true, [], state);
    const status = html.match(/<div class="empty-table"[^>]*>/)?.[0] ?? "";
    assert.match(status, /position:sticky;left:0;width:var\(--bo-native-status-width, 100%\);max-width:100%;box-sizing:border-box/);
    if (role) assert.ok(status.includes('role="' + role + '"'));
    assert.ok(html.includes(text));
  }
});
