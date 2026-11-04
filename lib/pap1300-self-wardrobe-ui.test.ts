import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composeTabs } from "./workspace-schema/registry";
import { selfSchema, verifySelfWardrobeApproval } from "../app/bo/pinoria-avatars/schema";

const view = readFileSync(new URL("../app/bo/pinoria-avatars/SelfDirectoryTdd.tsx", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/bo/pinoria-avatars/SelfWardrobeDetail.tsx", import.meta.url), "utf8");
const admission = JSON.parse(readFileSync(new URL("../config/tdd-admission.json", import.meta.url), "utf8"));
const route = readFileSync(new URL("../app/api/bo/[...path]/route.ts", import.meta.url), "utf8");

test("PAP-1300 + PAP-1356 TDD composes Tổng quan → Tủ đồ → Loadout → Lịch sử", () => {
  assert.deepEqual(composeTabs(selfSchema).map(tab => [tab.id, tab.label]), [
    ["overview", "Tổng quan"], ["wardrobe", "Tủ đồ"], ["loadout", "Loadout"], ["history", "Lịch sử"],
  ]);
  const approved = selfSchema.detail.businessTabs[0];
  assert.equal(approved?.kind, "approved-extension");
  if (approved?.kind !== "approved-extension") return;
  assert.equal(approved.source.permission, "pinoria.self.item.view");
  assert.equal(approved.approval.jira, "PAP-1296");
  assert.equal(verifySelfWardrobeApproval(approved.approval, {surface:"BO", key:"pinoria-avatars", extensionId:approved.extensionId}), true);
  assert.equal(verifySelfWardrobeApproval(approved.approval, {surface:"HO", key:"pinoria-avatars", extensionId:approved.extensionId}), false);
});
test("PAP-1300 BO TDD mounts scoped approved extension inside engine shell", () => {
  assert.match(view, /new TddRegistry\(verifySelfWardrobeApproval\)/);
  assert.match(view, /<SurfaceWorkspace adapter=/);
  assert.match(view, /detailApprovedExtension=/);
  assert.match(view, /context\.authorize\("pinoria\.self\.item\.view"\)/);
  assert.match(view, /context\.authorize\("pinoria\.self\.item\.manage"\)/);
  assert.match(view, /centerId=\{selected\}/);
});
test("PAP-1300 runtime has Owned/Catalog label, Core source, explicit reason and no mock records", () => {
  for (const expected of ["Thư Viện Đồ Pinoria", "Đã sở hữu (", "Tìm Item", "Lọc loại Item", "Lý do *", "expectedSelfVersion", "idempotency-key", "Cấp Item", "Thu hồi"]) {
    assert.equal(ui.includes(expected), true, expected);
  }
  assert.match(ui, /credentials: "include", cache: "no-store"/);
  assert.match(ui, /selfId \+ "\/items\/"/);
  assert.match(ui, /if \(!canView\)/);
  assert.match(ui, /!canManage/);
  assert.match(ui, /Core sẽ tháo trang bị và thu hồi đồng thời/);
  assert.doesNotMatch(ui, /Tủ đồ của Lê Minh An|Danh mục Item|6 Item đang sở hữu/);
});
test("PAP-1300 admitted TDD_DEFAULT and using only existing BO DS classes", () => {
  assert.equal((route.match(/if \(isBoSelfItemPath\(joined\)\)/g) ?? []).length, 5);
  const m=admission.modules.find((x: {key:string})=>x.key==="pinoria-avatars");
  assert.ok(m.files.includes("app/bo/pinoria-avatars/SelfWardrobeDetail.tsx"));
  assert.ok(m.tests.includes("lib/pap1300-self-wardrobe-ui.test.ts"));
  assert.match(ui, /className="view-tabs"/);
  assert.match(ui, /className="secondary-btn"/);
  assert.match(ui, /<DrawerFrame title=/);
  assert.doesNotMatch(ui, /<dialog|role="dialog"|style=\{\{/);
  assert.doesNotMatch(ui, /SelfWardrobeDetail\.module\.css|styles\./);
});
