import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SpecialtyCreateDrawer, specialtyVisualPaths, validateSpecialtyDraft } from "../app/ho/learning/specialties/SpecialtyCreateDrawer";

test("PAP-1495: create draft restricts known visual-only Path codes; no synthetic Catalog ID",()=>{
  assert.deepEqual(specialtyVisualPaths.map(path=>path.code),["artchitect","pianohouse","little-piner"]);
  assert.match(validateSpecialtyDraft({name:"",pathCode:"artchitect",description:""})??"",/Tên Chuyên đề/);
  assert.match(validateSpecialtyDraft({name:"Hình khối",pathCode:"forged",description:""})??"",/Path hợp lệ/);
  assert.match(validateSpecialtyDraft({name:"Hình khối",pathCode:"artchitect",description:"x".repeat(4001)})??"",/4.000/);
  assert.equal(validateSpecialtyDraft({name:"Hình khối",pathCode:"artchitect",description:"Mô tả"}),null);
});

test("PAP-1495: shared DrawerFrame has real form choices but no unverified V2 write",()=>{
  const html=renderToStaticMarkup(createElement(SpecialtyCreateDrawer,{onClose:()=>{}}));
  assert.match(html,/role="dialog"/);
  assert.match(html,/data-tdd-shell="drawer"/);
  assert.match(html,/Tạo Chuyên đề/);
  assert.match(html,/Tên Chuyên đề/);
  assert.match(html,/Chọn Path/);
  assert.match(html,/Artchitect/);
  assert.match(html,/PianoHouse/);
  assert.match(html,/Little Piner/);
  assert.match(html,/Mô tả/);
  assert.match(html,/Chưa thể lưu Chuyên đề/);
  assert.match(html,/<button[^>]*disabled=""[^>]*>Tạo Chuyên đề<\/button>/);
  assert.doesNotMatch(html,/Hoặc tạo dữ liệu mẫu|API giả|fixture|Jira/i);
});
