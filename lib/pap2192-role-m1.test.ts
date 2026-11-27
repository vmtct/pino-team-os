import assert from "node:assert/strict";
import test from "node:test";
import { roleM1, makePreviewRole, archivePreviewRole, eligiblePermissions, rolePreviewCatalog, roleReviewRoute, canEditPreviewRole, previewRoleVersion, editPreviewRole, type PreviewRole } from "../app/ho/system/roles/role-m1-preview";
import { createPreviewState, reducePreview } from "./m1-preview/state";
const draft={roleKey:"demo-operator",displayName:"Demo operator",description:"Preview"};
const catalog=[
 {key:"a",applicablePlatforms:["BO"],surfaceApplicability:"BO",allowedScopes:["CENTER"]},
 {key:"b",applicablePlatforms:["BO","TOS"],surfaceApplicability:"BOTH",allowedScopes:["CENTER"]},
 {key:"c",applicablePlatforms:["TOS"],surfaceApplicability:"TOS",allowedScopes:["RUNNING_CLASS"]},
 {key:"d",applicablePlatforms:["HO"],surfaceApplicability:"BO",allowedScopes:["GLOBAL"]},
 {key:"e",applicablePlatforms:["BO"],surfaceApplicability:"BO",allowedScopes:["GLOBAL"]},
 {key:"f",surfaceApplicability:"BO",allowedScopes:["CENTER"]},
];
test("one isolated seed; create and archive preserve synthetic identity and null audit",()=>{
 const seed=createPreviewState(roleM1,"founder-review");
 assert.equal(seed.records.length,1);
 const record=makePreviewRole(draft,["a","a","b"],catalog)!;
 assert.deepEqual(record.permissionKeys,["a","b"]);
 const created=reducePreview<PreviewRole>(seed,{type:"create",record});
 const row=created.records[1];
 assert.equal(row.id,"ROLE-MOCK-002");
 assert.equal(row.createdAt,null);
 const archived=reducePreview(created,{type:"replace",id:row.id,record:archivePreviewRole(row)!});
 assert.equal(archived.records[1].status,"archived");
 assert.equal(archived.records[1].updatedAt,null);
 assert.equal(archivePreviewRole(archived.records[1]),null);
 assert.equal(seed.records.length,1);
});
test("reject unknown permission, protected key, assigned role and nonfixture id",()=>{
 assert.equal(makePreviewRole(draft,["unknown"],catalog),null);
 assert.equal(makePreviewRole({...draft,roleKey:"founder"},[],catalog),null);
 assert.equal(archivePreviewRole({...roleM1.seed,assignmentCount:1}),null);
 assert.equal(archivePreviewRole({...roleM1.seed,id:"live"}),null);
});
test("unified BO/TOS permission selection without a role target attribute",()=>{
 assert.deepEqual(eligiblePermissions(catalog).map(p=>p.key),["a","b","c"]);
 const row=makePreviewRole(draft,["a","c"],catalog);
 assert.deepEqual(row?.permissionKeys,["a","c"]);
 assert.equal(Object.hasOwn(row!,"target"),false);
 assert.equal(Object.hasOwn(roleM1.seed,"target"),false);
 for(const key of ["d","e","f"])assert.equal(makePreviewRole(draft,[key],catalog),null);
});
test("same eight isolated permission examples for both review hosts",()=>{
 assert.equal(rolePreviewCatalog.length,8);
 assert.equal(eligiblePermissions(rolePreviewCatalog).length,8);
 assert.equal(new Set(rolePreviewCatalog.map(p=>p.key)).size,8);
 assert.ok(rolePreviewCatalog.every(p=>p.key.startsWith("fixture.")));
 assert.deepEqual(makePreviewRole(draft,["fixture.student.view","fixture.class.view"],rolePreviewCatalog)?.permissionKeys,["fixture.class.view","fixture.student.view"]);
 assert.equal(makePreviewRole(draft,["student.view"],rolePreviewCatalog),null);
});
test("canonical Roles route selects isolated review and preserves real details",()=>{
 const id="01a17d3f-8697-7080-bdf1-33e939758059";
 assert.equal(roleReviewRoute({}),"preview");
 assert.equal(roleReviewRoute({m1Preview:"1"}),"preview");
 assert.equal(roleReviewRoute({record:"ROLE-MOCK-001"}),"preview");
 assert.equal(roleReviewRoute({record:id}),"live");
 assert.equal(roleReviewRoute({record:id,m1Preview:"1"}),"invalid");
 assert.equal(roleReviewRoute({m1Preview:["1","1"]}),"invalid");
 assert.equal(roleReviewRoute({record:["ROLE-MOCK-001","ROLE-MOCK-002"]}),"invalid");
 assert.equal(roleReviewRoute({m1Preview:"0"}),"invalid");
 assert.equal(roleReviewRoute({record:"STAFF-MOCK-001"}),"invalid");
});
test("mock inline edit preserves identity, keys, permissions and audit; rejects invalid or protected fields",()=>{
 const role={...roleM1.seed,permissionKeys:["fixture.student.view"]};
 const edited=editPreviewRole(role,{name:"  New name  ",description:"Updated"})!;
 assert.equal(edited.name,"New name");
 assert.equal(edited.description,"Updated");
 assert.deepEqual(edited,{...role,name:"New name",description:"Updated"});
 assert.notEqual(previewRoleVersion(role),previewRoleVersion(edited));
 assert.equal(editPreviewRole(edited,{description:""})?.description,"");
 for(const patch of [{name:" "},{name:"x".repeat(121)},{description:"x".repeat(501)},{roleKey:"other"},{permissionKeys:[]},{updatedAt:"now"},{name:3},{}])assert.equal(editPreviewRole(role,patch),null);
 for(const locked of [{...role,status:"archived" as const},{...role,roleKey:"founder"},{...role,id:"real"}]){
   assert.equal(canEditPreviewRole(locked),false);
   assert.equal(editPreviewRole(locked,{name:"changed"}),null);
 }
 const state=createPreviewState(roleM1,"founder");
 const next=reducePreview(state,{type:"replace",id:role.id,record:edited});
 assert.equal(next.records[0].name,"New name");
 assert.equal(state.records[0].name,"Vai trò mẫu");
});
