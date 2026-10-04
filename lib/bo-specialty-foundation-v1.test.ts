import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {boApi} from "./bo-api";
import {isOperationalReadPath} from "./bo-read-handler";
import {isAllowedPostPath} from "./bo-write-handler";
import {BO_HOSTNAME,decideHostBoundary} from "./host-boundary";

const id="01999999-9999-7999-8999-999999999999";

test("SPF-009 Specialty BO perimeter exposes only bounded canonical routes",()=>{
  for(const path of [
    "specialty/catalog",`specialty/students/${id}`,
    "policies/specialty/purchase.v1/stream","policies/specialty/reward.v1/effective",
  ])assert.equal(isOperationalReadPath(path),true,path);
  for(const path of [
    "catalog/specialty-families","catalog/specialty-modules","specialty/offers",
    `specialty/offers/${id}/configure`,"specialty/relics","specialty/rewards",
    "specialty/purchases/evaluate","specialty/purchases",
    `specialty/allocations/${id}/claims`,`specialty/allocations/${id}/complete`,
    `specialty/physical-rewards/${id}/fulfill`,
    "policies/specialty/purchase.v1/versions",`policies/specialty/purchase.v1/versions/${id}/publish`,
  ])assert.equal(isAllowedPostPath(path),true,path);
  for(const path of [
    "specialty/students/not-a-canonical-id","specialty/offers/delete",
    `specialty/allocations/${id}/refund`,`specialty/physical-rewards/${id}/delete`,
    "policies/specialty/unknown.v1/stream",
  ])assert.equal(isOperationalReadPath(path)||isAllowedPostPath(path),false,path);
});

test("SPF-009 host boundary admits Specialty routes and rejects malformed siblings",()=>{
  for(const path of [
    "/api/bo/specialty/catalog",`/api/bo/specialty/students/${id}`,
    "/api/bo/catalog/specialty-families","/api/bo/catalog/specialty-modules",
    "/api/bo/specialty/offers",`/api/bo/specialty/offers/${id}/configure`,
    "/api/bo/specialty/relics","/api/bo/specialty/rewards",
    "/api/bo/specialty/purchases/evaluate","/api/bo/specialty/purchases",
    `/api/bo/specialty/allocations/${id}/claims`,`/api/bo/specialty/allocations/${id}/complete`,
    `/api/bo/specialty/physical-rewards/${id}/fulfill`,
    "/api/bo/policies/specialty/purchase.v1/stream",
    `/api/bo/policies/specialty/purchase.v1/versions/${id}/publish`,
  ])assert.deepEqual(decideHostBoundary(BO_HOSTNAME,path),{action:"next"},path);
  for(const path of [
    "/api/bo/specialty/students/bad","/api/bo/specialty/offers/delete",
    `/api/bo/specialty/allocations/${id}/refund`,
    "/api/bo/policies/specialty/unknown.v1/stream",
  ])assert.deepEqual(decideHostBoundary(BO_HOSTNAME,path),{action:"not_found"},path);
});

test("SPF-009/010 Subscriptions workspace mounts policy-driven Specialty lifecycle",async()=>{
  const [view,workspace,api,model]=await Promise.all([
    readFile("app/bo/subscriptions/BoSubscriptionsView.tsx","utf8"),
    readFile("app/bo/subscriptions/SpecialtyWorkspace.tsx","utf8"),
    readFile("lib/bo-api.ts","utf8"),readFile("lib/bo-model.ts","utf8"),
  ]);
  assert.match(view,/import \{ SpecialtyWorkspace \}/);
  assert.match(view,/<SpecialtyWorkspace lifecycle=\{data\}/);
  assert.match(workspace,/paths\.filter\(item=>item\.status==="ACTIVE"\)\.map\(item=>boApi\.specialtyCatalog\(item\.id\)\)/);
  assert.doesNotMatch(workspace,/boApi\.specialtyCatalog\(\)/);
  assert.match(workspace,/boApi\.createSpecialtyFamily/);
  assert.match(workspace,/boApi\.createSpecialtyModule/);
  assert.match(workspace,/boApi\.createSpecialtyOffer/);
  assert.match(workspace,/boApi\.evaluateSpecialtyPurchase/);
  assert.match(workspace,/boApi\.createSpecialtyPurchase/);
  assert.match(workspace,/boApi\.claimSpecialtySession/);
  assert.match(workspace,/boApi\.completeSpecialtyAllocation/);
  assert.match(workspace,/boApi\.fulfillSpecialtyPhysicalReward/);
  assert.match(workspace,/Policy hiện tại/);
  assert.match(workspace,/Parent thanh toán/);
  assert.match(workspace,/purchaseSubscriptions/);
  assert.match(workspace,/sessionsForAllocation\(allocation\)/);
  assert.match(workspace,/await run\("purchase",async\(\)=>/);
  assert.doesNotMatch(workspace,/effectiveAvailableUnits\s*[<>]=?\s*8/);
  assert.match(api,/specialtyCatalog:/);
  assert.match(model,/export interface BoSpecialtyStudentSummary/);
});

test("SPF-010 Specialty purchase and claim carry exact idempotency headers",async()=>{
  const original=globalThis.fetch;
  const calls:Array<{path:string;key:string|null;body:unknown}>=[];
  globalThis.fetch=async(input,init)=>{
    calls.push({path:String(input),key:new Headers(init?.headers).get("idempotency-key"),body:init?.body?JSON.parse(String(init.body)):null});
    if(String(input).endsWith("/evaluate"))return Response.json({data:{allowed:true,reasons:[],offer:{},studentProfileId:"student",sourceSubscription:null,sourceAvailableUnits:null,policySource:"BUILTIN_PERMISSIVE_V1",policyVersionId:null,policy:{}}});
    return Response.json({data:{}});
  };
  try{
    await boApi.evaluateSpecialtyPurchase({studentProfileId:"student",offerId:"offer",effectiveAt:"2026-09-30T05:00:00.000Z"});
    await boApi.createSpecialtyPurchase({payerParentUserId:"parent",studentProfileId:"student",offerId:"offer",effectiveAt:"2026-09-30T05:00:00.000Z"},"purchase-key");
    await boApi.claimSpecialtySession(id,{sessionId:id,effectiveAt:"2026-09-30T05:00:00.000Z"},"claim-key");
    await boApi.completeSpecialtyAllocation(id,{effectiveAt:"2026-09-30T05:00:00.000Z"},"complete-key");
  }finally{globalThis.fetch=original;}
  assert.deepEqual(calls.map(item=>item.path),[
    "/api/bo/specialty/purchases/evaluate","/api/bo/specialty/purchases",
    `/api/bo/specialty/allocations/${id}/claims`,`/api/bo/specialty/allocations/${id}/complete`,
  ]);
  assert.ok(calls[0]!.key&&calls[0]!.key!.length>10);
  assert.equal(calls[1]!.key,"purchase-key");
  assert.equal(calls[2]!.key,"claim-key");
  assert.equal(calls[3]!.key,"complete-key");
});
