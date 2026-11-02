import test from "node:test";
import assert from "node:assert/strict";
import {classroomFixture} from "./test-fixtures/classroom-v4";
import {renderClassroom} from "./test-support/classroom-v4-render";
test("PAP-945 V4 tabs have unique IDs and correctly linked selected panels",async()=>{
 const model=classroomFixture();
 for(const tab of ["students","missions","diaries"] as const){
  const html=await renderClassroom(model,{classId:model.classes[0].id,tab});
  assert.equal((html.match(/role="tabpanel"/g)||[]).length,1);
  assert.ok(html.includes(`id="tos-classroom-panel-${tab}"`));assert.ok(html.includes(`aria-labelledby="tos-classroom-tab-${tab}"`));
  for(const id of ["students","missions","diaries"])assert.equal(html.split(`id="tos-classroom-tab-${id}"`).length-1,1);
  assert.match(html,new RegExp(`role="tab" id="tos-classroom-tab-${tab}"[^>]*aria-selected="true"`));
 }
});
test("PAP-945 every V4 detail sheet retains a named modal boundary",async()=>{
 const model=classroomFixture(),diary=model.data.diaries.find(x=>x.status==="REGISTERED")!;
 for(const overlay of ["student","historyDetail","add","assign","guide","diary"] as const){
  const html=await renderClassroom(model,{classId:diary.teachingContextKey,studentId:diary.studentId,diaryId:diary.id,missionId:diary.missions[0].id,overlay});
  assert.match(html,/role="dialog" aria-modal="true" aria-label="Chi tiết lớp học"/);assert.match(html,/data-tos-shared="modal-root"/);
 }
});
