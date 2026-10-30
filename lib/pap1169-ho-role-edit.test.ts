import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideHostBoundary } from "./host-boundary";
import { parseHoRoleEdit, handleHoRoleEdit, type HoRoleEditEnv } from "./ho-role-edit-facade";
import { roleSchema, roleQuery, roleDefinition } from "../app/ho/system/roles/schema";
import { validateModule } from "./workspace-schema";

const id="00000000-0000-4000-8000-000000000025";
const route="/api/ho/system/roles/"+id+"/update";
const hostname="ho.staging.pinohouse.art";
const body={displayName:"  Giáo viên  ",description:"Role mẫu ",permissionKeys:["access.role.view","team.bo.access"],expectedUpdatedAt:"2026-10-29T08:00:00.000Z"};
const req=(b:unknown=body,host=hostname,origin="https://"+hostname)=>new Request("https://"+host+route,{
 method:"POST",headers:{host,origin,"content-type":"application/json","idempotency-key":"pap1169-negative-1"},
 body:JSON.stringify(b),
});
const env={APP_ENV:"staging"} as HoRoleEditEnv;
test("PAP-1169 strict Role command input and no implicit grants",()=>{
 assert.deepEqual(parseHoRoleEdit(body),{displayName:"Giáo viên",description:"Role mẫu",permissionKeys:["access.role.view","team.bo.access"],expectedUpdatedAt:body.expectedUpdatedAt});
 for(const bad of [
  null,{...body,userId:id},{...body,roleType:"system"},{...body,permissionKeys:["access.role.view","access.role.view"]},
  {...body,permissionKeys:["access.role.view","malicious permission"]},
  {...body,expectedUpdatedAt:"invalid"},{...body,displayName:" "},{...body,description:12},
  {...body,permissionKeys:"access.role.view"},{...body,permissionKeys:[null]},{...body,description:"a".repeat(501)},
 ])assert.equal(parseHoRoleEdit(bad),null);
});
test("PAP-1169 HO admission exact POST host+path only",()=>{
 assert.deepEqual(decideHostBoundary(hostname,route,"POST"),{action:"next"});
 for(const method of ["GET","PATCH","PUT","DELETE","HEAD"])
   assert.deepEqual(decideHostBoundary(hostname,route,method),{action:"not_found"});
 for(const host of ["bo.staging.pinohouse.art","bo.pinohouse.art","ho.pinohouse.art","tos.staging.pinohouse.art","localhost"])
   assert.deepEqual(decideHostBoundary(host,route,"POST"),{action:"not_found"});
 assert.deepEqual(decideHostBoundary(hostname,"/api/bo/access/roles/"+id+"/update","POST"),{action:"not_found"});
 assert.deepEqual(decideHostBoundary(hostname,route.replace(id,"not-uuid"),"POST"),{action:"not_found"});
});
test("PAP-1169 facade blocks before Core mutation on invalid host/payload/auth",async()=>{
 assert.equal((await handleHoRoleEdit(req(body,hostname,"https://evil.invalid"),env,id)).status,403);
 assert.equal((await handleHoRoleEdit(req({...body,roleKey:"founder"}),env,id)).status,400);
 assert.equal((await handleHoRoleEdit(req(body),{...env,APP_ENV:"production"},id)).status,404);
 assert.equal((await handleHoRoleEdit(req(body),env,"invalid-id")).status,404);
 assert.ok([401,403,503].includes((await handleHoRoleEdit(req(body),env,id)).status));
});
test("PAP-1169 roles use a registered canonical TDD + Shared DS (no new shell)",()=>{
 validateModule(roleSchema);
 assert.equal(roleSchema.surface,"HO");
 assert.equal(roleSchema.key,"roles");
 assert.deepEqual(roleQuery.visible,["name","roleType","status","permissionCount","assignmentCount"]);
 assert.equal(roleDefinition.detail.history.kind,"unavailable");
 const page=readFileSync("app/ho/system/roles/page.tsx","utf8");
 const ui=readFileSync("app/ho/system/roles/HoRolesTdd.tsx","utf8");
 const edit=readFileSync("app/ho/system/roles/HoRoleEditor.tsx","utf8");
 assert.match(page,/HoRolesTdd/);
 assert.match(ui,/@pino\/design-system\/components\.css/);
 assert.match(ui,/SurfaceWorkspace/);
 assert.match(ui,/detailApprovedExtension=/);
 assert.doesNotMatch(ui,/detailProperties=/);
 assert.equal(roleDefinition.detail.businessTabs.length,1);
 assert.deepEqual(roleDefinition.detail.businessTabs.map(tab=>[tab.id,tab.label,tab.kind]),[["permissions","Quyền","approved-extension"]]);
 assert.match(edit,/data-role-tab=\{activeTab\}/);
 assert.match(edit,/hidden=\{activeTab!=="permissions"\}/);
 assert.match(edit,/hidden=\{activeTab!=="overview"\}/);
 assert.doesNotMatch(edit,/ho-role-titlebar/);
 assert.match(edit, /from "@pino\/design-system\/react"/);
 assert.match(edit, /<PropertySections/);
 assert.match(edit, /<TosCard/);
 assert.match(edit, /<TosButton/);
 assert.match(edit,/expectedUpdatedAt:current\.updatedAt/);
 assert.match(ui,/access\.role\.edit/);
});

test("PAP-1187 Founder approval is scoped to the one Role permission extension",async()=>{
 const {TddRegistry}=await import("./workspace-schema");
 const {verifyRolePermissionTabApproval}=await import("../app/ho/system/roles/schema");
 const approved=roleDefinition.detail.businessTabs[0];
 assert.equal(approved.kind,"approved-extension");
 if(approved.kind!=="approved-extension")throw Error("invalid fixture");
 assert.equal(verifyRolePermissionTabApproval(approved.approval,{surface:"HO",key:"roles",extensionId:approved.extensionId}),true);
 assert.equal(verifyRolePermissionTabApproval(approved.approval,{surface:"BO",key:"roles",extensionId:approved.extensionId}),false);
 assert.equal(verifyRolePermissionTabApproval(approved.approval,{surface:"HO",key:"staffs",extensionId:approved.extensionId}),false);
 assert.equal(verifyRolePermissionTabApproval(approved.approval,{surface:"HO",key:"roles",extensionId:"unapproved-extension"}),false);
 assert.throws(()=>new TddRegistry().register({...roleDefinition,data:roleSchema.data}),/extension approval not verified/);
});
