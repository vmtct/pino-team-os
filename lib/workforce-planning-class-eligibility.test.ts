import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { eligibleShiftRunningClasses, buildIndependentRoleCommands } from "./workforce-planning-class-eligibility";
import type { BoRunningClass } from "./bo-model";
test("PAP-1113 class eligibility excludes wrong Center, weekday, time and inactive", () => {
  const x:BoRunningClass={id:"x",centerId:"a",name:"Class",pathProgramId:"p",timezone:"Asia/Ho_Chi_Minh",recurrenceWeekdays:[2],startLocalTime:"18:00",endLocalTime:"19:30",defaultCapacity:12,deliveryTopology:"FIXED_COHORT",defaultParticipationMinutes:90,status:"ACTIVE"};
  const inputs=[x,{...x,id:"other-center",centerId:"b"},{...x,id:"other-day",recurrenceWeekdays:[4]},{...x,id:"inactive",status:"INACTIVE"},{...x,id:"after-shift",endLocalTime:"22:00"}];
  assert.deepEqual(eligibleShiftRunningClasses(inputs,{centerId:"a",workDate:"2026-11-17",startLocalTime:"17:30",endLocalTime:"21:00"}).map((item)=>item.id),["x"]);
});
test("PAP-1113 explicit four role toggles and separated RunningClass picks, independent from Session count",async()=>{
  const s=await readFile("app/bo/workforce/WorkforcePlanningView.tsx","utf8");
  for(const role of ["frontDesk","shiftLeader","teacherSelected","assistantSelected"])assert.ok(s.includes("checked={"+role+"}"),role);
  assert.match(s,/boApi\.calendarScope\(\)/);
  assert.match(s,/eligibleShiftRunningClasses/);
  assert.match(s,/role === "TEACHER"/);
  assert.doesNotMatch(s,/eligibleSessions\.map/);
});


test("PAP-1113 all 15 nonempty role subsets and separate Teacher/TA classes",()=>{
  const types=["FRONT_DESK","SHIFT_LEADER","TEACHER","TEACHING_ASSISTANT"];
  for(let mask=1;mask<16;mask++){
    const roles=buildIndependentRoleCommands({
      frontDesk:!!(mask&1),shiftLeader:!!(mask&2),teacherSelected:!!(mask&4),assistantSelected:!!(mask&8),
      teacherRunningClassIds:["T1","T2","T2"],assistantRunningClassIds:["A1"],
    });
    assert.deepEqual(new Set(roles.map((role)=>role.roleType)),new Set(types.filter((_,index)=>(mask&(1<<index))!==0)));
    assert.equal(roles.filter((role)=>role.roleType==="TEACHER").length,(mask&4)?2:0);
    assert.equal(roles.filter((role)=>role.roleType==="TEACHING_ASSISTANT").length,(mask&8)?1:0);
    assert.ok(roles.every((role)=>!("sessionId" in role)), "no SessionLearningOwner writer");
  }
});
