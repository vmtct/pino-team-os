import assert from "node:assert/strict";
import test from "node:test";
import { roleM1, makePreviewRole, archivePreviewRole, eligiblePermissions, type PreviewRole } from "../app/ho/system/roles/role-m1-preview";
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
