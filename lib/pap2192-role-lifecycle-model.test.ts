import assert from "node:assert/strict";
import test from "node:test";
import { canArchiveRole, roleCreateInput, validExpiryDraft, verifyCreatedRole, type RoleCandidate, type QaMinutes } from "../app/ho/system/roles/role-lifecycle-model";
const draft={roleKey:"qa-example",displayName:"Test role",description:""};
test("create identity only, explicitly no permissions",()=>{assert.deepEqual(roleCreateInput(draft),{roleKey:"qa-example",displayName:"Test role",description:null,permissionKeys:[]});});
test("create rejects protected role, empty name and malformed key",()=>{for(const change of [{roleKey:"Founder"},{displayName:" "},{roleKey:"?"}])assert.equal(roleCreateInput({...draft,...change}),null);});
test("unexpected permission payload never creates a grant",()=>{const unexpected={...draft,permissionKeys:["team.bo.access"]};assert.deepEqual(roleCreateInput(unexpected)?.permissionKeys,[]);});
const role:RoleCandidate={id:"test",roleKey:"qa-example",roleType:"custom",status:"active",assignmentCount:0,updatedAt:"2026-11-19T00:00:00Z"};
test("archive only active empty custom role with valid version",()=>{assert.equal(canArchiveRole(role),true);for(const change of [{roleType:"system" as const},{roleKey:"founder"},{status:"archived" as const},{assignmentCount:1},{updatedAt:"invalid"}])assert.equal(canArchiveRole({...role,...change}),false);});
test("assignment requires exact displayed role, center and bounded duration",()=>{const roles=[{id:"qa",label:"QA"}],centers=[{id:"center",label:"Center"}]; const input={roleId:"qa",centerId:"center",minutes:60 as const};assert.equal(validExpiryDraft(input,roles,centers),true);for(const change of [{roleId:"other"},{centerId:"other"},{minutes:0 as QaMinutes},{minutes:121 as QaMinutes}])assert.equal(validExpiryDraft({...input,...change},roles,centers),false);});



test("create verification requires exact persisted identity and zero grants",()=>{
 const input=roleCreateInput(draft)!;
 const receipt={...input,id:"fixture-4",roleType:"custom",status:"active",permissionCount:0,assignmentCount:0};
 assert.equal(verifyCreatedRole(input,receipt),true);
 for(const bad of [null,{}, {...receipt,roleKey:"other"}, {...receipt,roleType:"system"}, {...receipt,permissionCount:1}, {...receipt,permissionKeys:["team.bo.access"]}, {...receipt,assignmentCount:1}, {...receipt,status:"archived"}])assert.equal(verifyCreatedRole(input,bad),false);
});
