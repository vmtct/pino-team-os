/** PAP-1875 / Epic PAP-1676 — NO RAW ID P0 on user-facing BO Mission Detail/Diary. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DetailFrame } from "../app/components/workspace-renderer/DetailFrame";
const source=(file:string)=>readFileSync(file,"utf8");
test("PAP-1875 typed Detail frame never projects internal record ID as header subtitle",()=>{
 const tdd=source("app/components/workspace-renderer/Record.tsx");
 assert.match(tdd,/<DetailFrame title=\{projection\?\.title \?\? "Chi tiết"\} mobileMenu/);
 assert.doesNotMatch(tdd,/subtitle=\{projection\?\.record\.id\}/);
 assert.match(tdd,/renderScope\(schema, props\.context, props\.record\.id\)/,"Keep internal identity for adapter navigation");
 assert.match(tdd,/subject\.id !== record\.id/,"Keep History ID proof");
 const frameProps = {
   title:"[QA TOS] Hoàn thiện A3",onBack:()=>{},
   tabs:[{id:"overview",label:"Tổng quan"},{id:"history",label:"Lịch sử"}],selected:"overview",
   children:createElement("p",null,"Nhiệm vụ"),
 } satisfies Parameters<typeof DetailFrame>[0];
 const html=renderToStaticMarkup(createElement(DetailFrame,{...frameProps}));
 assert.match(html,/\[QA TOS\] Hoàn thiện A3/);
 assert.doesNotMatch(html,/id="detail-subtitle"/);
 assert.match(html,/role="tablist"/);
});
test("PAP-1875 linked Diary UX never leaks Student, RunningClass or Diary machine IDs",()=>{
 const ui=source("app/bo/missions/BoMissionsTdd.tsx");
 assert.doesNotMatch(ui,/\["Học viên",\s*selectedDiary\.studentId\]/);
 assert.doesNotMatch(ui,/\["Lớp",\s*selectedDiary\.runningClassId/);
 assert.doesNotMatch(ui,/\["Bối cảnh dạy",\s*selectedDiary\.teachingContextKey/);
 assert.doesNotMatch(ui,/header:"Diary ID"/);
 assert.doesNotMatch(ui,/render:\(row:LinkedMissionDiary\)=>row\.diaryId/);
 assert.match(ui,/\["Ngày học",missionContextDay\(selectedDiary\.teachingContextKey\)\]/);
 assert.match(ui,/missionContextDay\(row\.teachingContextKey\)/);
 assert.match(ui,/new Date\(Date\.UTC\(year, month - 1, day\)\)/);
 assert.match(ui,/value\.getUTCDate\(\) !== day/);
 assert.match(ui,/rowKey=\{row=>row\.linkId\}/,"Keep internal linked Diary key");
 assert.match(ui,/readMissionLinkedDiaries\(fetch, centerId, record\.id, signal\)/,"Keep source/Center authorization");
});
