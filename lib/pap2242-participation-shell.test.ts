import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source = readFileSync(new URL("../app/components/mytime-workshop/WorkshopParticipationTab.tsx", import.meta.url), "utf8");
test("PAP-2242 participation table and empty state", () => {
  for (const heading of ["Person", "Trạng thái", "Nhóm", "Lượt sử dụng", "Chưa có người tham gia"]) assert.ok(source.includes(heading));
  assert.ok(source.includes("rows.map(row"));
});
test("PAP-2242 create callback is host-gated without persistence", () => {
  assert.ok(source.includes("canCreate && onCreate"));
  assert.ok(source.includes("onClick={onCreate}"));
  assert.ok(!source.includes("fetch("));
});
