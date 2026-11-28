import test from "node:test";import assert from "node:assert/strict";
import {TddRegistry,authorizedTabs} from "@/lib/workspace-schema";
import {staffAccessApproval,staffAccessSlot,verifyStaffAccessApproval,localStaffAccessDefinition,localStaffReviewDefinition,verifyLocalStaffPreviewApproval,staffRateSampleApproval} from "./staff-access-admission";
const scope={surface:"HO" as const,key:"staffs",extensionId:"ho.staff.access"};
test("PAP-1247 exact Staff presentation extension only",()=>{
 assert.equal(verifyStaffAccessApproval(staffAccessApproval,scope),true);
 for(const s of [{...scope,surface:"BO" as const},{...scope,key:"roles"},{...scope,extensionId:"*"}])assert.equal(verifyStaffAccessApproval(staffAccessApproval,s),false);
 for(const a of [{...staffAccessApproval,jira:"PAP-1187"},{...staffAccessApproval,files:[...staffAccessApproval.files,"other.ts"]},{...staffAccessApproval,tests:[]},{...staffAccessApproval,reviewBy:"other"}])assert.equal(verifyStaffAccessApproval(a,scope),false);
});
test("PAP-784 registry defaults deny; exact admission retains Rate and normal read authorization",()=>{
 const definition={...localStaffAccessDefinition,data:{id:"isolated-staff-admission-test",list:async()=>({rows:[],total:0}),detail:async()=>null}};
 assert.throws(()=>new TddRegistry().register(definition),/extension approval not verified/);
 const registered=new TddRegistry(verifyStaffAccessApproval).register(definition);
 assert.deepEqual(registered.detail.businessTabs.map(s=>s.id),["access","staff-rate"]);
 assert.equal(registered.detail.businessTabs[0]?.source.permission,staffAccessSlot.source.permission);
 assert.deepEqual(authorizedTabs(registered,{surface:"HO",authorize:()=>false}),[]);
 assert.deepEqual(authorizedTabs(registered,{surface:"HO",authorize:p=>p==="team.bo.access"}).map(t=>t.id),["overview","access","staff-rate","history"]);
});
test("PAP-2347 local sample Rate extension is exact and live Staff form remains native",()=>{
 const definition={...localStaffReviewDefinition,data:{id:"isolated-staff-review-test",list:async()=>({rows:[],total:0}),detail:async()=>null}};
 assert.throws(()=>new TddRegistry(verifyStaffAccessApproval).register(definition),/extension approval not verified/);
 const registered=new TddRegistry(verifyLocalStaffPreviewApproval).register(definition);
 assert.deepEqual(registered.detail.businessTabs.map(s=>s.id),["access","staff-rate"]);
 assert.equal(localStaffAccessDefinition.detail.businessTabs[1].kind,"form");
 assert.equal(registered.detail.businessTabs[1]?.kind,"approved-extension");
 assert.equal(verifyLocalStaffPreviewApproval(staffRateSampleApproval,{surface:"HO",key:"staffs",extensionId:"ho.staff.rate.sample"}),true);
 assert.equal(verifyLocalStaffPreviewApproval(staffRateSampleApproval,{surface:"BO",key:"staffs",extensionId:"ho.staff.rate.sample"}),false);
});
