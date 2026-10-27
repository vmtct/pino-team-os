import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {classroomFixture} from "./test-fixtures/classroom-v4";
import {renderClassroom,buttonTags} from "./test-support/classroom-v4-render";
test("PAP-945 complete V4 classroom screen tree renders without changing its read model",async()=>{
 const model=classroomFixture(),before=JSON.stringify(model),id=model.classes[0].id;
 const launcher=await renderClassroom(model);assert.match(launcher,/Mỹ thuật sáng tạo/);assert.match(launcher,/Mở lớp/);
 for(const tab of ["students","missions","diaries"] as const){const html=await renderClassroom(model,{classId:id,tab});assert.equal((html.match(/data-tos-vnext="classroom-detail-header"/g)||[]).length,1);assert.match(html,/Học viên/);assert.match(html,/Nhiệm vụ/);assert.match(html,/Nhật ký/)}
 const missions=await renderClassroom(model,{classId:id,tab:"missions"});assert.match(missions,/Giáo Án/);assert.match(missions,/\+ Thêm/);
 assert.equal(JSON.stringify(model),before,"rendering must not mutate business records");
});
test("PAP-945 long CLOSED Diary content retains intrinsic card height and original text",async()=>{
 const model=classroomFixture();const diary=model.data.diaries.find(x=>x.status==="CLOSED")!;diary.teachingContextKey=model.classes[0].id;diary.notes="Nhận xét rất dài. ".repeat(100);
 const html=await renderClassroom(model,{classId:model.classes[0].id,tab:"diaries"});assert.ok(html.includes(diary.notes));
 const css=readFileSync("app/components/tos-vnext/classroom.module.css","utf8");assert.match(css,/flex-shrink:0/);assert.match(css,/\.interestRadioList\s*\{[^}]*grid-template-columns:repeat\(2/);
});
test("PAP-945 opening and Diary submit controls are disabled even with complete fixtures",async()=>{
 const model=classroomFixture();const open=await renderClassroom(model,{openingClassId:model.classes[0].id});
 assert.equal(buttonTags(open,"Xác nhận mở lớp").length,1);assert.match(buttonTags(open,"Xác nhận mở lớp")[0],/disabled/);
 const d=model.data.diaries.find(x=>x.status==="REGISTERED")!;
 const html=await renderClassroom(model,{classId:d.teachingContextKey,studentId:d.studentId,overlay:"diary",diaryId:d.id});
 for(const text of ["Lưu nháp","Kết thúc Diary"])assert.match(buttonTags(html,text)[0],/disabled/);
 assert.equal((html.match(/type="radio"/g)||[]).length,4);
});
