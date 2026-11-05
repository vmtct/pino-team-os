import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";
import {test} from "node:test";

const component=readFileSync(
  new URL("../app/bo/workforce/compensation/StaffCompensationView.tsx",import.meta.url),"utf8"
);
test("PAP-996 BO private compensation has read-only surface and no rate-write action",()=>{
  assert.match(component,/boApi\.staffCompensation\(/);
  assert.match(component,/BoDataGridSidePeek/);
  assert.match(component,/onRowOpen=\{setSelectedRate\}/);
  assert.match(component,/read-only/);
  assert.doesNotMatch(component,/boApi\.(?:create|correct)StaffCompensation\(/);
  assert.doesNotMatch(component,/Thêm mốc lương|Hiệu chỉnh mốc lương|Lưu thay đổi|setEditor/);
});
test("PAP-996 private compensation remains reveal-gated and is purged on visibility loss",()=>{
  assert.match(component,/privateState\.status==="ready"/);
  assert.match(component,/document\.addEventListener\("visibilitychange"/);
  assert.match(component,/window\.addEventListener\("pagehide"/);
  assert.match(component,/setPrivateState\(\{status:"idle"\}\)/);
  assert.match(component,/setSelectedRate\(null\)/);
});
