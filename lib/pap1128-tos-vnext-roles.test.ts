import test from "node:test";
import assert from "node:assert/strict";
import {shiftRoleLabel} from "./tos-vnext-shift-view-model";
import type {Assignment} from "./workforce-api";
test("PAP-1128 TOS V4 renders RunningClass Teacher and TA once per role",()=>{
 const facts=[{roleType:"TEACHER",targetType:"RUNNING_CLASS",targetId:"class-a"},{roleType:"TEACHING_ASSISTANT",targetType:"RUNNING_CLASS",targetId:"class-b"},{roleType:"TEACHER",targetType:"RUNNING_CLASS",targetId:"class-c"}];
 assert.equal(shiftRoleLabel({roleAssignments:facts} as Assignment),"Giáo viên · Trợ giảng");
});
