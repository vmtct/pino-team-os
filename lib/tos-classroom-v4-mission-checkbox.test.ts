import test from "node:test";
import assert from "node:assert/strict";
import {classroomFixture} from "./test-fixtures/classroom-v4";
import {renderClassroom} from "./test-support/classroom-v4-render";
import {validateClassroomDraft} from "./tos-classroom-v4-view-model";

test("PAP-945 requires a selected Mission, not a completion result for every Mission",()=>{
 const input={missionIds:["mission-1","mission-2"],results:{"mission-1":true,"mission-2":null},
  interest:3,notes:"Quan sát tiến bộ",difficulty:"",hasImage:true,uploading:false};
 assert.deepEqual(validateClassroomDraft(input),[]);
 assert.deepEqual(validateClassroomDraft({...input,results:{}}),[]);
 assert.ok(validateClassroomDraft({...input,missionIds:[]}).some(error=>error.includes("Cần chọn ít nhất một Nhiệm vụ")));
 assert.ok(validateClassroomDraft({...input,missionIds:[" "]}).some(error=>error.includes("Cần chọn ít nhất một Nhiệm vụ")));
 assert.ok(validateClassroomDraft({...input,interest:null}).some(error=>error.includes("mức hứng thú")));
});
test("PAP-945 canonical V18b Diary displays one checkbox for each Mission, no yes/no outcomes",async()=>{
 const model=classroomFixture();
 const diary=model.data.diaries.find(row=>row.status==="REGISTERED")!;
 const html=await renderClassroom(model,{classId:diary.teachingContextKey,studentId:diary.studentId,
  diaryId:diary.id,overlay:"diary"});
 for(const mission of diary.missions){
  const section=html.split('data-diary-mission-result="'+mission.id+'"')[1]?.split("</section>")[0]??"";
  assert.match(section,/type="checkbox"/);
  assert.match(section,/Nhiệm vụ hoàn tất/);
  assert.doesNotMatch(section,/✓ Hoàn thành<\/button>|○ Chưa hoàn thành<\/button>/);
 }
 assert.match(html,/Kết thúc Diary không bắt buộc mọi Nhiệm vụ hoàn tất/);
 assert.match(html,/type="radio"/);
});
