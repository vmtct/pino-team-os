import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideHostBoundary } from "./host-boundary";
import { parseHoRoleEdit, handleHoRoleEdit, prepareHoRoleMetadataUpdate, type HoRoleEditEnv } from "./ho-role-edit-facade";
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
 assert.deepEqual(roleQuery.visible,["name","roleType","status","permissionCount","assignmentCount","createdAt","createdBy","updatedAt","updatedBy"]);
 assert.equal(roleDefinition.detail.history.kind,"unavailable");
 const page=readFileSync("app/ho/system/roles/page.tsx","utf8");
 const ui=readFileSync("app/ho/system/roles/HoRolesTdd.tsx","utf8");
 const edit=readFileSync("app/ho/system/roles/HoRoleEditor.tsx","utf8");
 assert.match(page,/HoRolesTdd/);
 assert.match(ui,/@pino\/design-system\/components\.css/);
 assert.match(ui,/SurfaceWorkspace/);
 assert.match(ui,/detailApprovedExtension=/);
 // PAP-2408: suppress only the redundant native Overview; the approved extension renders the identical shared TDD property grid.
 assert.match(ui,/detailProperties=\{nativeLifecycle\?\(\)=>null:undefined\}/);
 assert.match(ui,/nativeOverview=\{nativeLifecycle\?nativeRoleOverview\(/);
 assert.match(ui,/recordProjection\(schema,context,row\)/);
 assert.match(edit,/import \{PropertySections as NativePropertySections,type OverviewProperties\} from "@\/app\/components\/workspace-renderer\/Properties"/);
 assert.match(edit,/<NativePropertySections \{\.\.\.nativeOverview\} record=\{nativeRecord\} variant="detail"/);
 assert.doesNotMatch(ui,/<(?:DetailFrame|DrawerFrame|BoDataTable)\b/);
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
 const shell=readFileSync("app/components/workspace-adapters/SurfaceWorkspace.tsx","utf8");
 assert.match(shell,/detail\.retry\(\); list\.retry\(\);/); // Default shared TDD mutation contract remains.
 const extension = shell.split("renderApprovedExtension: detailApprovedExtension ?")[1]?.split(", businessForms:")[0] ?? "";
 assert.match(extension,/list\.retry\(\)/);
 assert.doesNotMatch(extension,/detail\.retry\(\)/); // Do not remount editor before save feedback.
 assert.match(ui,/onSaved=\{onSaved\}/);
 assert.match(edit,/onSaved\(\)/);
 assert.match(edit,/Đã lưu và xác minh Role trên Core/);
 assert.doesNotMatch(edit,/Tải lại bảng để cập nhật số quyền/);
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

test("PAP-1169 HO Role writes use the dedicated BO Access Core binding, not FounderControlPlane",()=>{
 const facade=readFileSync("lib/ho-role-edit-facade.ts","utf8");
 const config=JSON.parse(readFileSync("wrangler.ho-staging.json","utf8"));
 const access=config.services.find((service:{binding:string})=>service.binding==="PINO_BO_CORE");
 const founder=config.services.find((service:{binding:string})=>service.binding==="PINO_CORE");
 assert.equal(access?.entrypoint,"BoAccessControlPlane");
 assert.equal(founder?.entrypoint,"FounderControlPlane");
 assert.match(facade,/callBoAccessCoreWithStaffPassword\(env\.PINO_BO_CORE/);
 assert.doesNotMatch(facade,/callFounderCoreWithStaffPassword|env\.PINO_CORE/);
 assert.match(facade,/authorizeHoShell\(request\.headers, env\)/);
 assert.match(facade,/actor\.permissionKeys\.includes\("access\.role\.edit"\)/);
 assert.match(facade,/role\.manage|HO_ROLE_PERMISSION_ESCALATION|current\.roleType !== "custom"/);
});

test("PAP-2373 metadata-only command derives exact CAS without a permission rewrite",()=>{
 const metadataId="01a17d3f-8697-7080-bdf1-33e939758059";
 const expectedVersion="2026-11-25T04:00:00.000Z";
 const current={id:metadataId,roleType:"custom",roleKey:"role-example",status:"active",
   displayName:"Old",description:"Preserve",permissionKeys:["access.role.view"],permissionCount:1,assignmentCount:0,updatedAt:expectedVersion};
 const request={id:metadataId,expectedVersion,patch:{name:" New "}};
 const next=prepareHoRoleMetadataUpdate(request,current);
 assert.deepEqual(next?.body,{displayName:"New",description:"Preserve",expectedUpdatedAt:expectedVersion});
 assert.deepEqual(next?.reviewed.body.permissionKeys,["access.role.view"]);
 assert.equal(Object.hasOwn(next!.body,"permissionKeys"),false);
 for(const invalid of [{...current,id:"other"},{...current,roleType:"system"},{...current,roleKey:"founder"},
   {...current,status:"archived"},{...current,updatedAt:"2026-11-25T04:00:01.000Z"},{...current,permissionCount:2},
   {...current,permissionKeys:["access.role.view","access.role.view"],permissionCount:2}])
   assert.equal(prepareHoRoleMetadataUpdate(request,invalid),null);
 assert.equal(prepareHoRoleMetadataUpdate({...request,patch:{name:"Old"}},current),null);
});
test("PAP-2373 metadata-only request fails before Core on extra grants, mismatched identity or wrong environment",async()=>{
 const metadataId="01a17d3f-8697-7080-bdf1-33e939758059";
 const expectedVersion="2026-11-25T04:00:00.000Z";
 const payload={id:metadataId,expectedVersion,patch:{name:"New"}};
 const path="/api/ho/system/roles/"+metadataId+"/update";
 const request=(b:unknown=payload,hostname="ho.staging.pinohouse.art",suffix="")=>new Request("https://"+hostname+path+suffix,{
  method:"POST",headers:{host:hostname,origin:"https://"+hostname,"content-type":"application/json","idempotency-key":"pap2373-metadata-negative"},body:JSON.stringify(b),
 });
 for(const b of [{...payload,permissionKeys:[]},{...payload,patch:{name:"New",permissionKeys:[]}},{...payload,id:"01a17d3f-8697-7080-bdf1-33e939758060"}])
   assert.equal((await handleHoRoleEdit(request(b),env,metadataId)).status,400);
 assert.equal((await handleHoRoleEdit(request(payload,"ho.staging.pinohouse.art","?x=1"),env,metadataId)).status,400);
 assert.equal((await handleHoRoleEdit(request(),{...env,APP_ENV:"production"},metadataId)).status,404);
 assert.ok([401,403,503].includes((await handleHoRoleEdit(request(),env,metadataId)).status));
});

test("PAP-2373 typed metadata is limited to native Role detail and preserves generic read-only adapter",()=>{
 const ui=readFileSync("app/ho/system/roles/HoRolesTdd.tsx","utf8");
 const editor=readFileSync("app/ho/system/roles/HoRoleEditor.tsx","utf8");
 assert.match(ui,/metadataAuthorized=\{nativeLifecycle&&context\.authorize\("access\.role\.view"\)&&context\.authorize\("access\.role\.edit"\)\}/);
 assert.match(editor,/metadataAuthorized\?<PropertySections/);
 assert.match(editor,/onCommit=\{commitMetadata\} onSaved=\{\(\)=>onSaved\(\)\}/);
 assert.match(editor,/!dirty&&\(!busy\|\|metadataPending\)/);
 assert.match(editor,/if\(!canCommitMetadata\|\|lock\.current/);
 assert.match(editor,/setMetadataBlocked\(true\)/);
 assert.match(editor,/next!==null&&next\.role===result\.receipt/);
 assert.equal(roleDefinition.table.inlineEdit.enabled,false);
 assert.equal(roleDefinition.fields.every(field=>!field.capabilities.inlineEdit),true);
 assert.doesNotMatch(ui,/mutation:/);
});
