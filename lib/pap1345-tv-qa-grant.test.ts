import test from "node:test";
import assert from "node:assert/strict";
import type { BoAccessSystemUser } from "./bo-access-model";
import type { BoAccessRole } from "./bo-model";
import {
  planTvQaGrant, verifyTvQaReadback, writeTvQaStaffCommand, TV_QA_ROLE_KEY,
  TV_QA_USER_ID, TV_QA_STAFF_ID, TV_QA_CENTER_ID,
} from "./ho-staff-role-editor";

const now = Date.parse("2026-11-02T07:00:00.000Z");
const role = { id: "role-qa", roleKey: TV_QA_ROLE_KEY, status: "active", roleType: "custom", permissionCount: 1 } as BoAccessRole;
const other = { assignmentId: "other-staff-role", roleId: "role-staff", roleKey: "staff", roleName: "Staff",
  scopeType: "CENTER", scopeId: TV_QA_CENTER_ID, effectiveFrom: "2026-10-01T00:00:00Z", effectiveUntil: null } as const;
const expired = { assignmentId: "old-qa-role", roleId: role.id, roleKey: TV_QA_ROLE_KEY, roleName: "TV QA",
  scopeType: "CENTER", scopeId: TV_QA_CENTER_ID, effectiveFrom: "2026-11-02T03:00:00Z",
  effectiveUntil: "2026-11-02T04:00:00Z" } as const;
const user = (assignments: BoAccessSystemUser["assignments"]):BoAccessSystemUser =>
  ({ id:TV_QA_USER_ID, staffMemberId:TV_QA_STAFF_ID, status:"active", email:null, assignments });

test("PAP-1345 preserves unrelated Staff roles when replacing expired QA duplicate",()=>{
  const plan=planTvQaGrant(user([other,expired]),[role],now);
  assert.deepEqual(plan,{kind:"ready",roleId:role.id,expiredAssignmentId:expired.assignmentId,otherAssignmentIds:[other.assignmentId]});
  assert.equal(verifyTvQaReadback(user([other]),[other.assignmentId],role.id,now),false);
  const active={...expired,assignmentId:"new-qa-role",effectiveFrom:"2026-11-02T06:59:00Z",effectiveUntil:null};
  assert.equal(verifyTvQaReadback(user([other,active]),[other.assignmentId],role.id,now),true);
  assert.equal(verifyTvQaReadback(user([active]),[other.assignmentId],role.id,now),false);
});

test("PAP-1345 does not renew an already effective grant or wrong target/Center",()=>{
  const active={...expired,effectiveUntil:null};
  assert.deepEqual(planTvQaGrant(user([active]),[role],now),{kind:"already",roleId:role.id,assignmentId:expired.assignmentId,otherAssignmentIds:[]});
  assert.equal(planTvQaGrant({...user([expired]),id:"other"},[role],now).kind,"denied");
  assert.equal(planTvQaGrant({...user([expired]),staffMemberId:"other"},[role],now).kind,"denied");
  assert.equal(planTvQaGrant({...user([expired]),status:"suspended"},[role],now).kind,"denied");
  assert.equal(planTvQaGrant(user([expired]),[{...role,permissionCount:2}],now).kind,"denied");
  assert.equal(planTvQaGrant(user([expired,expired]),[role],now).kind,"denied");
});

test("PAP-1345 confines command writes to existing HO Founder API and exact QA Center",async()=>{
  const seen:Array<{path:string,init:RequestInit}>=[];
  const mock=((path:string,init:RequestInit)=>{seen.push({path,init});return Promise.resolve(new Response("{}",{status:200}));}) as unknown as typeof fetch;
  await writeTvQaStaffCommand(TV_QA_STAFF_ID,{action:"assign",roleId:role.id,scopeType:"CENTER",scopeId:TV_QA_CENTER_ID},mock);
  assert.equal(seen.length,1);
  assert.equal(seen[0]!.path,"/api/ho/staff/"+TV_QA_STAFF_ID+"/role");
  assert.equal(seen[0]!.init.credentials,"same-origin");
  assert.equal(JSON.parse(String(seen[0]!.init.body)).scopeId,TV_QA_CENTER_ID);
  assert.equal(JSON.parse(String(seen[0]!.init.body)).effectiveUntil,undefined);
  await assert.rejects(writeTvQaStaffCommand(TV_QA_STAFF_ID,{action:"assign",roleId:role.id,scopeType:"CENTER",scopeId:"another"},mock));
  await assert.rejects(writeTvQaStaffCommand("someone-else",{action:"remove",assignmentId:"x"},mock));
  assert.equal(seen.length,1);
});
