import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { specialtyVisualPaths, validateSpecialtyDraft } from "../app/ho/learning/specialties/schema";

const ho = readFileSync(new URL("../app/ho/learning/specialties/HoSpecialties.tsx",import.meta.url),"utf8");

test("PAP-1495: create draft restricts known visual-only Path codes; no synthetic Catalog ID",()=>{
  assert.deepEqual(specialtyVisualPaths.map(path=>path.code),["artchitect","pianohouse","little-piner"]);
  assert.match(validateSpecialtyDraft({name:"",pathCode:"artchitect",description:""})??"",/Tên Chuyên đề/);
  assert.match(validateSpecialtyDraft({name:"Hình khối",pathCode:"forged",description:""})??"",/Path hợp lệ/);
  assert.match(validateSpecialtyDraft({name:"Hình khối",pathCode:"artchitect",description:"x".repeat(4001)})??"",/4.000/);
  assert.equal(validateSpecialtyDraft({name:"Hình khối",pathCode:"artchitect",description:"Mô tả"}),null);
});

test("PAP-1495: Create button and shared DrawerFrame keep fields without enabling unverified V2 write",()=>{
  for (const item of ['tableHeaderActions={<button className="primary-btn"','＋ Tạo Chuyên đề','<DrawerFrame title="Tạo Chuyên đề"','<span>Tên Chuyên đề *</span>','<span>Path *</span>','<span>Mô tả</span>','Chưa thể lưu Chuyên đề.','title="Chưa thể lưu Chuyên đề"'])
    assert.ok(ho.includes(item),item);
  assert.match(ho,/<button type="button" className="primary-btn" disabled aria-disabled="true"/);
  assert.doesNotMatch(ho,/api\/founder\/path-programs|fetch\(.*specialt|submitSpecialtyMutation/);
});
