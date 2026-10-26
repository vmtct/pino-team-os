import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = readFileSync(new URL("../app/components/tos-vnext/TosVNextClassroom.tsx", import.meta.url), "utf8");

test("PAP-945 V18b tabs map to labelled panels without duplicate IDs", () => {
 for (const tab of ["students", "missions", "diary"]) {
  const id = `tos-classroom-panel-${tab}`;
  const label = `tos-classroom-tab-${tab}`;
  assert.equal(source.split(`id="${id}"`).length - 1, 1, `${id} must be unique`);
  assert.equal(source.split(`aria-labelledby="${label}"`).length - 1, 1, `${label} must label exactly one panel`);
 }
 assert.match(source, /tabPanelPrefix="tos-classroom"/);
});

test("PAP-945 never enables Mission or Diary writes while Core truth is unavailable", () => {
 assert.match(source, /<TosVNextButton disabled>Đọc giáo án · chờ Core<\/TosVNextButton>/);
 assert.match(source, /<TosVNextButton disabled>Ghi \/ đóng nhật ký · chờ Core<\/TosVNextButton>/);
 assert.match(source, /selected\.roster\.some\(student=>student\.status==="CONFLICT"\)/);
});