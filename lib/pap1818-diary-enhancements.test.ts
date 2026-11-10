import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseLinkedMissionDiaryPage } from "./bo-mission-assignments";
import { formatMissionAuditTime } from "./bo-mission-audit-projection";
// PAP-1818 / Epic PAP-1676: real Diary source, not matching Mission text.
const center="01900000-0000-7000-8000-000000000001";
const assignment="01900000-0000-7000-8000-000000000002";
const diaryId="01900000-0000-7000-8000-000000000003";
const linkId="01900000-0000-7000-8000-000000000004";
const sample={linkId,diaryId,linkedAt:"2026-11-10T08:10:00.000Z",
 diary:{id:diaryId,centerId:center,studentId:assignment,
  teachingContextKey:"class:2026-11-10",runningClassId:null,
  registeredAt:"2026-11-10T08:10:00.000Z",
  registeredByUserId:assignment,updatedAt:"2026-11-10T08:10:00.000Z",
  notes:"Dòng một\nDòng hai",teacherLegalFullName:"Nguyễn Thị Trang",status:"REGISTERED"}};
const page=(diaries:unknown[])=>({assignmentId:assignment,diaries,limit:100,offset:0,hasMore:false});

test("PAP-1818 source Diary notes and reviewed CCCD full name round-trip",()=>{
 const item=parseLinkedMissionDiaryPage(page([sample]),center,assignment).diaries[0]!;
 assert.equal(item.notes,"Dòng một\nDòng hai");
 assert.equal(item.teacherLegalFullName,"Nguyễn Thị Trang");
 assert.equal(item.updatedAt,"2026-11-10T08:10:00.000Z");
 assert.equal(formatMissionAuditTime(item.registeredAt),"10/11/2026 · 15:10");
});
test("PAP-1818 invalid unverified name or oversize notes fail closed",()=>{
 for(const x of [{teacherLegalFullName:" "},{notes:"x".repeat(5001)},{updatedAt:"bad"}]){
  assert.throws(()=>parseLinkedMissionDiaryPage(page([{...sample,diary:{...sample.diary,...x}}]),center,assignment));
 }
 const legacy=parseLinkedMissionDiaryPage(page([{...sample,diary:{...sample.diary,notes:null,teacherLegalFullName:null}}]),center,assignment).diaries[0]!;
 assert.equal(legacy.notes,null);assert.equal(legacy.teacherLegalFullName,null);
});
test("PAP-1818 scoped PINO DataGrid opens shared Drawer; History and reason use PINO DS",()=>{
 const ui=readFileSync("app/bo/missions/BoMissionsTdd.tsx","utf8");
 const history=readFileSync("app/bo/missions/BoMissionHistory.tsx","utf8");
 const css=readFileSync("app/bo/missions/MissionDetailEnhancements.module.css","utf8");
 assert.match(ui,/onRowOpen=\{onRowOpen\}/);
 assert.match(ui,/\<DrawerFrame/);
 assert.match(ui,/formatMissionAuditTime\(row.registeredAt\)/);
 assert.match(ui,/teacherLegalFullName/);
 assert.match(ui,/styles.reopenReason/);
 assert.match(ui,/styles.missionHistory/);
 assert.match(css,/\.missionHistory/);assert.match(css,/\.reopenReason/);
 assert.match(ui,/className="v25-form-field"/);
});
