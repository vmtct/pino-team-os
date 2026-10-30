import test from "node:test";
import assert from "node:assert/strict";
import type { Assignment, TimekeepingSession } from "./workforce-api";
import type { WalkinLookup } from "./open-studio-walkin-tos-api";
import {
  currentReceptionSession, isConsumableWalkinLookup, defaultWalkinStudentSelection,
} from "./open-studio-walkin-tos-reception";

const CENTER = "019d1000-0001-7000-8000-000000000001";
const OTHER = "019d1000-0001-7000-8000-000000000002";
const DATE = "2026-10-30";
const assignment: Assignment = {
  id: "assignment-1", centerId: CENTER, workDate: DATE,
  shiftTemplateId: "template-1",timeBasis:"SHIFT_TEMPLATE",coverageMode:"FULL_SHIFT",
  effectiveStartLocal:null,effectiveEndLocal:null,termWeekId:null,
  status:"ACTIVE",shift:null,
  roleAssignments:[{roleType:"FRONT_DESK",targetType:"CENTER",targetId:CENTER}],
};
const session: TimekeepingSession = {
  id:"timekeeping-open",centerId:CENTER,assignmentId:assignment.id,
  workDate:DATE,status:"OPEN",checkInAt:"2026-10-30T08:00:00Z",checkOutAt:null,
};
const eligible: WalkinLookup = {
  pass:{id:"pass-1",code:"PINO-OS-001",status:"ASSIGNED",path_code:"AC",parent_user_id:"parent-1"},
  parentName:"Phụ huynh thử nghiệm",
  students:[{id:"student-1",name:"An Nhiên"},{id:"student-2",name:"Bình An"}],
};

test("reception may consume only with OWN OPEN timekeeping and today's CENTER FRONT_DESK assignment",()=>{
  assert.equal(currentReceptionSession([assignment],session,CENTER,DATE)?.id,session.id);
  assert.equal(currentReceptionSession([assignment],{...session,status:"CLOSED"},CENTER,DATE),null);
  assert.equal(currentReceptionSession([assignment],{...session,checkOutAt:"2026-10-30T09:00:00Z"},CENTER,DATE),null);
  assert.equal(currentReceptionSession([assignment],{...session,assignmentId:"another"},CENTER,DATE),null);
  assert.equal(currentReceptionSession([assignment],{...session,assignmentId:null},CENTER,DATE),null);
  assert.equal(currentReceptionSession([assignment],{...session,centerId:OTHER},CENTER,DATE),null);
  assert.equal(currentReceptionSession([assignment],session,OTHER,DATE),null);
  assert.equal(currentReceptionSession([assignment],session,CENTER,"2026-10-31"),null);
  assert.equal(currentReceptionSession([{...assignment,status:"VOIDED"}],session,CENTER,DATE),null);
  assert.equal(currentReceptionSession([{...assignment,roleAssignments:[{roleType:"TEACHER",targetType:"CENTER",targetId:CENTER}]}],session,CENTER,DATE),null);
});

test("only ASSIGNED Pass with Parent and valid Path enables TOS consume",()=>{
  assert.equal(isConsumableWalkinLookup(eligible),true);
  assert.equal(isConsumableWalkinLookup(null),false);
  assert.equal(isConsumableWalkinLookup({...eligible,pass:{...eligible.pass,status:"AVAILABLE"}}),false);
  assert.equal(isConsumableWalkinLookup({...eligible,pass:{...eligible.pass,status:"REVOKED"}}),false);
  assert.equal(isConsumableWalkinLookup({...eligible,pass:{...eligible.pass,status:"CONSUMED"}}),false);
  assert.equal(isConsumableWalkinLookup({...eligible,pass:{...eligible.pass,parent_user_id:null}}),false);
  assert.equal(isConsumableWalkinLookup({...eligible,pass:{...eligible.pass,path_code:null}}),false);
  for(const path of ["AC","LPP","LPA","PH"] as const)
    assert.equal(isConsumableWalkinLookup({...eligible,pass:{...eligible.pass,path_code:path}}),true);
});

test("default selected child is real authorized linked Student, not manual",()=>{
  assert.equal(defaultWalkinStudentSelection(eligible),"student-1");
  assert.equal(defaultWalkinStudentSelection({...eligible,students:[]}),"__manual__");
});
