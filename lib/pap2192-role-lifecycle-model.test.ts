import assert from "node:assert/strict";
import test from "node:test";
import { canArchiveRole, matchesArchiveConfirmation, verifyArchivedRole, matchesExpiryConfirmation, verifyTemporaryAssignment, roleCreateInput, validExpiryDraft, verifyCreatedRole, type RoleCandidate, type QaMinutes } from "../app/ho/system/roles/role-lifecycle-model";
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

test("archive confirmation is bound to the reviewed id, key and version",()=>{
 assert.equal(matchesArchiveConfirmation(role,{...role}),true);
 for(const change of [{id:"other"},{roleKey:"other"},{updatedAt:"2026-11-19T00:00:01Z"},{assignmentCount:1},{status:"archived" as const},{roleType:"system" as const}]) assert.equal(matchesArchiveConfirmation(role,{...role,...change}),false);
});
test("archive requires exact persisted archived receipt with newer version and zero active assignments",()=>{
 const receipt={...role,status:"archived",updatedAt:"2026-11-19T00:00:01Z"};
 assert.equal(verifyArchivedRole(role,receipt),true);
 for(const bad of [null,undefined,{}, {...receipt,id:"other"}, {...receipt,roleKey:"other"}, {...receipt,roleType:"system"}, {...receipt,status:"active"}, {...receipt,updatedAt:role.updatedAt}, {...receipt,updatedAt:"invalid"}, {...receipt,assignmentCount:1}, {...receipt,assignmentCount:undefined}]) assert.equal(verifyArchivedRole(role,bad),false);
 assert.equal(verifyArchivedRole({...role,assignmentCount:1},receipt),false);
});

test("finite assignment confirms exact staff, role, center and duration and rejects missing choices",()=>{
 const review={staffId:"staff",roleId:"qa",centerId:"c",minutes:30 as const};
 const roles=[{id:"qa",label:"QA"}],centers=[{id:"c",label:"Center"}];
 assert.equal(matchesExpiryConfirmation(review,{...review},roles,centers),true);
 for(const change of [{staffId:"other"},{roleId:"other"},{centerId:"other"},{minutes:60 as const}]) assert.equal(matchesExpiryConfirmation(review,{...review,...change},roles,centers),false);
 assert.equal(matchesExpiryConfirmation(review,review,[],centers),false);
 assert.equal(matchesExpiryConfirmation(review,review,roles,[]),false);
});
test("finite assignment requires an exact finite readback, not callback completion",()=>{
 const review={staffId:"staff",roleId:"qa",centerId:"c",minutes:30 as const};
 const receipt={assignmentId:"a1",staffId:"staff",roleId:"qa",scopeType:"CENTER",scopeId:"c",status:"active",effectiveFrom:"2026-11-19T00:00:00Z",effectiveUntil:"2026-11-19T00:30:00Z"};
 assert.equal(verifyTemporaryAssignment(review,receipt),true);
 for(const bad of [undefined,null,{}, {...receipt,assignmentId:""}, {...receipt,staffId:"other"}, {...receipt,roleId:"other"}, {...receipt,scopeId:"other"}, {...receipt,scopeType:"GLOBAL"}, {...receipt,status:"removed"}, {...receipt,effectiveUntil:null}, {...receipt,effectiveUntil:"invalid"}, {...receipt,effectiveUntil:"2026-11-19T01:00:00Z"}]) assert.equal(verifyTemporaryAssignment(review,bad),false);
});

test("native Roles TDD admits static actions only with explicit handler and authorized context",async()=>{
 const {roleDefinition,roleProvider,roleSchema}=await import("../app/ho/system/roles/schema");
 const {authorizedHostActions}=await import("./workspace-schema/registry");
 const {hasActionOnlyCapability}=await import("./workspace-adapters/adapter");
 assert.deepEqual(roleDefinition.capabilities,{read:"access.role.view",create:"access.role.create"});
 assert.equal(hasActionOnlyCapability(roleDefinition,roleProvider,"create"),true);
 assert.equal(roleProvider.mutation,undefined);
 assert.deepEqual(roleDefinition.actions.map(a=>[a.id,a.slot]),[["createRole","table.header"],["cancelCreate","drawer.footer"],["saveCreate","drawer.footer"]]);
 const allowed={surface:"HO" as const,authorize:(key:string)=>["access.role.view","access.role.create"].includes(key)};
 const denied={surface:"HO" as const,authorize:(key:string)=>key==="access.role.view"};
 const bindings={openCreate:{kind:"navigation" as const,run:()=>{}}};
 assert.deepEqual(authorizedHostActions(roleSchema,allowed,"table.header",{}),[]);
 assert.deepEqual(authorizedHostActions(roleSchema,denied,"table.header",bindings),[]);
 assert.deepEqual(authorizedHostActions(roleSchema,allowed,"table.header",bindings).map(a=>a.id),["createRole"]);
});
