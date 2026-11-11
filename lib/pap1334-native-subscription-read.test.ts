/** PAP-1334 / PAP-1491 — Center-immutable read-only PINO Subscription DSA adapter. */
import assert from "node:assert/strict";
import {test} from "node:test";
import type {BoLearnerSubscription} from "./bo-model";
import {
  assertCenterDetail,centerDirectoryUrl,loadCenterSubscriptionDirectory,
  nativeSubscriptionModule,subscriptionRecord,
  type OwnedSubscriptionItem,type OwnedSubscriptionPage,
} from "./pap1334-native-subscription-read";
const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const wrongCenter="0199f001-0000-7000-8000-000000000001";
const sub="01a1d9ae-9940-7b00-8b80-000000014981";
const student="01a1a61c-ab78-7ade-8a26-37c0aaef0332";
const pathId="01a03c6e-cc58-7d81-ac8e-aa15cdc52a9c";
const row:OwnedSubscriptionItem={
 id:sub,centerId:center,studentProfileId:student,pathProgramId:pathId,
 studentDisplayName:"Học viên thử nghiệm",pathDisplayName:"Little Piner Art",
 lifecycle:"ACTIVE",serviceStartsOn:"2026-11-10",contractualEndsOn:"2026-12-08",
 weeklyCommitment:2,termWeeks:4,commercialReference:"QA TEST",productPlanId:null,
 listPriceMinor:null,itemDiscountMinor:0,billDiscountMinor:0,finalAmountMinor:null,
 historicalBalance:0,effectiveAvailableUnits:4,
 createdAt:"2026-11-11T01:00:00.000Z",updatedAt:"2026-11-11T01:00:00.000Z",version:1,
};
const page=(items:OwnedSubscriptionItem[],total=items.length,nextCursor:OwnedSubscriptionPage["nextCursor"]=null):OwnedSubscriptionPage=>({
 items,total,limit:50,nextCursor,
});
const response=(data:OwnedSubscriptionPage)=>new Response(JSON.stringify({data}),{status:200,headers:{"content-type":"application/json"}});

test("PAP-1334 uses only immutable Owner Directory URL, never legacy affiliation directory",()=>{
 assert.equal(centerDirectoryUrl(center),"/api/bo/subscriptions/center-directory?centerId="+center+"&limit=50");
 const cursor={createdAt:"2026-11-11T01:00:00.000Z",id:sub};
 assert.equal(centerDirectoryUrl(center,cursor),"/api/bo/subscriptions/center-directory?centerId="+center+
 "&limit=50&beforeCreatedAt=2026-11-11T01%3A00%3A00.000Z&beforeSubscriptionId="+sub);
 assert.throws(()=>centerDirectoryUrl("bad"),RangeError);
});

test("PAP-1334 Center Directory does not display technical IDs, emits real names and audit time fallbacks",()=>{
 const shown=nativeSubscriptionModule.fields.map(f=>f.key);
 for(const key of ["id","centerId","studentProfileId","pathProgramId"])
  assert.equal(shown.includes(key),false,key);
 const record=subscriptionRecord(row);
 assert.equal(record.name,row.studentDisplayName);
 assert.equal(record.path,row.pathDisplayName);
 assert.equal(record.createdBy,"—");
 assert.equal(record.updatedBy,"—");
 assert.throws(()=>subscriptionRecord({...row,studentDisplayName:" "}));
 assert.throws(()=>subscriptionRecord({...row,centerId:"bad"}));
});

test("PAP-1334 Owner Directory: correct Center returns one authenticated row",async()=>{
 const urls:string[]=[];
 const transport:typeof fetch=async (input,init)=>{
  urls.push(String(input));
  assert.equal(init?.method,"GET");
  assert.equal(init?.cache,"no-store");
  assert.equal(init?.signal?.aborted,false);
  return response(page([row]));
 };
 const data=await loadCenterSubscriptionDirectory(center,new AbortController().signal,transport);
 assert.deepEqual(data,[row]);
 assert.deepEqual(urls,[centerDirectoryUrl(center)]);
});

test("PAP-1334 reject wrong Center rows BEFORE any Table rendering",async()=>{
 for(const bad of [{...row,centerId:wrongCenter},{...row,centerId:""},{...row,studentDisplayName:""}]){
  const transport:typeof fetch=async()=>response(page([bad]));
  await assert.rejects(loadCenterSubscriptionDirectory(center,new AbortController().signal,transport));
 }
});
test("PAP-1334 incomplete, duplicated or inconsistent paging is rejected",async()=>{
 for(const invalid of [page([row],2,null),page([row,row]),page([],0,{createdAt:row.createdAt,id:sub})]){
  const transport:typeof fetch=async()=>response(invalid);
  await assert.rejects(loadCenterSubscriptionDirectory(center,new AbortController().signal,transport));
 }
});
test("PAP-1334 async Center change cancels and rejects obsolete read",async()=>{
 const ctrl=new AbortController();
 const transport:typeof fetch=async (_input,init)=>{
  assert.equal(init?.signal,ctrl.signal);
  ctrl.abort();
  return response(page([row]));
 };
 await assert.rejects(loadCenterSubscriptionDirectory(center,ctrl.signal,transport));
});
test("PAP-1334 Drawer/Detail opens ONLY after canonical immutable owner attestation",()=>{
 const canonical={...row} as unknown as BoLearnerSubscription;
 assert.equal(assertCenterDetail(canonical,sub,center,row).centerId,center);
 for(const altered of [
  {...row,centerId:wrongCenter},{...row,id:wrongCenter},
  {...row,studentProfileId:wrongCenter},{...row,pathProgramId:wrongCenter},
 ]){
  assert.throws(()=>assertCenterDetail(altered as unknown as BoLearnerSubscription,sub,center,row));
 }
 assert.throws(()=>assertCenterDetail(canonical,sub,center,{...row,centerId:wrongCenter}));
});
