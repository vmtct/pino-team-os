import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {shiftWeek,shiftWeekOffset,activeScheduleAssignments} from "./tos-vnext-shift-view-model";
import type {Assignment} from "./workforce-api";

test("PAP-1131 navigates consecutive weeks using Center-local dates, including month and year boundaries",()=>{
 assert.equal(shiftWeekOffset("2026-10-28",1),"2026-11-04");
 assert.equal(shiftWeekOffset("2026-10-28",3),"2026-11-18");
 assert.equal(shiftWeek("2026-11-18")[1].date,"2026-11-17");
 assert.equal(shiftWeekOffset("2027-01-01",-1),"2026-12-25");
 assert.throws(()=>shiftWeekOffset("2026-02-30",1));
 assert.throws(()=>shiftWeekOffset("2026-10-28",0.5));
});

test("PAP-1131 operational calendar never shows cancelled role history as active",()=>{
 const rows=[
  {id:"cancelled",workDate:"2026-11-17",status:"CANCELLED",roleAssignments:[{roleType:"TEACHING_ASSISTANT",targetType:"RUNNING_CLASS",targetId:"class-a"}]},
  {id:"other-day",workDate:"2026-11-18",status:"ACTIVE"},
  {id:"assigned",workDate:"2026-11-17",status:"ACTIVE",roleAssignments:[{roleType:"TEACHING_ASSISTANT",targetType:"RUNNING_CLASS",targetId:"class-a"}]},
 ] as Assignment[];
 assert.deepEqual(activeScheduleAssignments(rows,"2026-11-17").map(x=>x.id),["assigned"]);
 assert.deepEqual(activeScheduleAssignments(rows,"2026-11-16"),[]);
});

test("PAP-1131 navigated weeks read only authenticated Core self schedule with Center and 7-day bounds",async()=>{
 const ui=await readFile("app/components/tos-vnext/TosVNextShift.tsx","utf8");
 const parent=await readFile("app/prototype/tos-vnext-integration/TosVNextIntegrationClient.tsx","utf8");
 assert.match(ui,/workforceApi\.schedule\(\{centerId,startDate:weekStart,endDate:weekEnd\}\)/);
 assert.match(ui,/weekResult\?\.centerId===centerId&&weekResult\.start===weekStart/);
 assert.match(ui,/aria-label="Tuần trước"/);
 assert.match(ui,/aria-label="Tuần sau"/);
 assert.match(ui,/moveWeek\(1\)/);
 assert.match(ui,/activeScheduleAssignments\(/);
 assert.match(ui,/weekFailed&&<p role="alert">/);
 assert.match(parent,/TosVNextShift data=\{data\.shift\} localDate=\{fromDate\} centerId=\{centerId\}/);
});
