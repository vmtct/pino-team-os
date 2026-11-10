// PAP-1801 · Epic PAP-1705 / PNR-AVATAR-CRUD — Avatar-only existing Table compatibility.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoDataTable } from "../app/bo/components/registration/BoDataTable";
import type { BoTableState } from "./bo-registration";
import type { BoModule, BoRecord } from "./bo-registration";

const moduleConfig: BoModule = {
  label: "Pinoria Avatar", group: "PINORIA",
  fields: [
    { key: "name", label: "Person / Avatar", type: "text", icon: "Aa", w: 240 },
    { key: "roles", label: "Vai trò", type: "text", icon: "Aa", w: 160 },
    { key: "avatarLabel", label: "Trạng thái Avatar", type: "text", icon: "Aa", w: 165 },
    { key: "ownedCount", label: "Tủ đồ", type: "number", icon: "▤", w: 100 },
    { key: "loadoutSummary", label: "Loadout", type: "text", icon: "▤", w: 120 },
  ],
};
const tableState: BoTableState = {
  search: "", rules: [], logic: "AND", sort: "", desc: false,
  order: moduleConfig.fields.map(field => field.key), visible: moduleConfig.fields.map(field => field.key),
  group: "", collapsed: [], hiddenGroups: [], hideEmpty: true,
  pageSize: 15, groupDesc: false, frozenThrough: null,
};
const rows: BoRecord[] = [
  { id: "person-1", name: "Lê Minh An", nickname: "Mây", roles: "LEARNER", avatarLabel: "Sẵn sàng", ownedCount: 4, loadoutSummary: "3/8" },
  { id: "person-2", name: "Phạm Gia Bảo", nickname: null, roles: "LEARNER", avatarLabel: "Chưa bắt đầu", ownedCount: 0, loadoutSummary: "0/8" },
];
function markup(avatarOpenColumn: boolean, loadState = "ready") {
  return renderToStaticMarkup(createElement(BoDataTable, {
    module: moduleConfig, rows, loadState, value: tableState,
    update: () => {}, page: 1, setPage: () => {}, onOpen: () => {},
    onSettings: () => {}, filterOpen: false, setFilterOpen: () => {},
    views: [], changeViews: () => {}, activeView: null, applyView: () => {},
    reset: () => {}, undo: () => {}, canUndo: false, showChrome: false,
    avatarOpenColumn,
  }));
}

test("PAP-1801 Avatar alone gets one dedicated opener before five typed data fields", () => {
  const html = markup(true);
  assert.match(html, /<th scope="col" class="quick-open-th">Mở<\/th>/);
  assert.equal((html.match(/data-avatar-open-cell=""/g) ?? []).length, 2);
  assert.match(html, /aria-label="Mở Quick View Lê Minh An"/);
  assert.ok(html.indexOf('class="quick-open-th"') < html.indexOf('data-column="name"'));
  assert.equal((html.match(/data-column="/g) ?? []).length, 5);
  assert.match(html, /data-avatar-person-primary="">Lê Minh An<\/span>/);
  assert.match(html, /Avatar: Mây/);
  assert.match(html, /Avatar: —/);
  assert.match(html, />4<\/button>/);
  assert.match(html, />0<\/button>/);
});

test("PAP-1437 generic table retains no opener even when rows are actionable", () => {
  const generic = markup(false);
  assert.doesNotMatch(generic, /quick-open-th|data-avatar-open-cell/);
  assert.doesNotMatch(generic, /avatar-person-lines/);
  const loading = markup(true,"loading");
  assert.match(loading, /colSpan="6"/);
});

test("PAP-1801 56px geometry and adapter switch do not revive a global TDD opener", () => {
  const css = readFileSync("app/components/workspace-renderer/tdd-table-geometry.css","utf8");
  const table = readFileSync("app/components/workspace-renderer/Table.tsx","utf8");
  const nav = readFileSync("lib/pino-nav-locale.ts","utf8");
  assert.match(css, /\[data-tdd-avatar-open\].*#typed-table[^\n]*quick-open-th/);
  assert.match(css, /width: 56px !important/);
  assert.match(css, /--tdd-identity-width: 208px/);
  assert.match(table, /avatarOpenColumn = schema.key === "pinoria-avatars"/);
  assert.match(nav, /\["Pinoria Avatar", "Pinoria Avatar"/);
});
