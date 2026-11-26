import test from "node:test";
import assert from "node:assert/strict";
import {createProductPlanClient,decodePlan,encodePlanPatch,CatalogOutcomeUnknown,CatalogRequestError,catalogPath,type CatalogPort} from "./product-plan-native-contract";
const id="01a210a4-673a-7f5c-ba37-45d83d58012a",other="01a210a4-673a-7f5c-ba37-45d83d58012b",at="2026-11-26T00:00:00.000Z";
const dto={id,displayName:"Gói học",cadence:2,termWeeks:12,purchasedUnits:24,listPriceMinor:100,enabled:true,badge:"ENTRY",currency:"VND",createdAt:at,updatedAt:at,createdByUserId:null,updatedByUserId:other,version:1};
const signal=new AbortController().signal;
test("projects real canonical rows without inventing names or accepting mock/invalid economics",()=>{
 assert.equal(decodePlan(dto).updatedBy,"—");assert.equal(decodePlan(dto).price,100);
 for(const bad of [{...dto,id:"PRODUCT-PLAN-MOCK-001"},{...dto,purchasedUnits:25},{...dto,currency:"USD"},{...dto,version:0}])assert.throws(()=>decodePlan(bad));
});
test("strict six-field patch map and immutable/invalid rejection",()=>{
 assert.deepEqual(encodePlanPatch({name:"  New ",cadence:3,termWeeks:24,price:0,badge:"HERO",enabled:false},"1")?.body,{expectedVersion:1,displayName:"New",cadence:3,termWeeks:24,listPriceMinor:0,badge:"HERO",enabled:false});
 for(const p of [{id},{version:1},{termWeeks:13},{cadence:2.5},{price:-1},{name:" "},{enabled:1},{badge:"x"},{}])assert.equal(encodePlanPatch(p,"1"),null);
 assert.equal(encodePlanPatch({price:0},"01"),null);
});
test("exact single PATCH then authoritative GET; no optimistic or fixture result",async()=>{
 const calls:string[]=[];const next={...dto,listPriceMinor:200,version:2};
 const client=createProductPlanClient(async(path,init)=>{calls.push(init.method+" "+path);if(init.method==="PATCH")assert.deepEqual(init.body,{expectedVersion:1,listPriceMinor:200});return {status:200,data:next};});
 assert.equal((await client.update(id,{price:200},"1",signal)).price,200);
 assert.deepEqual(calls,["PATCH "+catalogPath+"/"+id,"GET "+catalogPath+"/"+id]);
});
test("lost response, wrong receipt or readback cannot be treated as saved; no resend",async()=>{
 for(const mode of ["lost","wrong","readback"]){
 let writes=0;const client=createProductPlanClient(async(_path,init)=>{if(init.method==="PATCH"){writes++;if(mode==="lost")throw Error();return {status:200,data:{...dto,id:mode==="wrong"?other:id,listPriceMinor:200,version:2}};}return {status:200,data:dto};});
 await assert.rejects(client.update(id,{price:200},"1",signal),CatalogOutcomeUnknown);assert.equal(writes,1);
 }
});
test("CAS and permissions fail explicitly, concurrent mutations never dispatch twice",async()=>{
 let writes=0;let release!:()=>void;const wait=new Promise<void>(r=>release=r);
 const client=createProductPlanClient(async()=>{writes++;await wait;return {status:409,data:null};});
 const first=client.update(id,{price:200},"1",signal);await assert.rejects(client.update(id,{price:300},"1",signal),(e:unknown)=>e instanceof CatalogRequestError&&e.status===409);
 release();await assert.rejects(first,(e:unknown)=>e instanceof CatalogRequestError&&e.status===409);assert.equal(writes,1);
});
test("catalog list rejects duplicate IDs and detail rejects foreign identity",async()=>{
 const client=createProductPlanClient(async(path)=>({status:200,data:path===catalogPath?[dto,dto]:{...dto,id:other}}));
 await assert.rejects(client.list(signal));await assert.rejects(client.detail(id,signal));
});
test("bounded related pages, null audit attribution and redacted history",async()=>{
 const sub={id:other,studentProfileId:id,studentDisplayName:"Student",centerId:null,centerDisplayName:null,lifecycle:"ACTIVE",contractualStartsOn:"2026-11-26",contractualEndsOn:null,createdAt:at,updatedAt:at,createdByUserId:null,updatedByUserId:null};
 const port:CatalogPort=async(path)=>({status:200,data:{items:path.includes("/history?")?[{id:other,occurredAt:at,actorId:null,action:"billing.product_plan_updated",previous:{listPriceMinor:100},next:{listPriceMinor:200}}]:[sub],nextAfter:null}});
 const client=createProductPlanClient(port);
 assert.equal((await client.subscriptions(id,signal)).items[0].center,"—");
 assert.equal((await client.history(id,signal)).items[0].actor,"—");
 await assert.rejects(client.subscriptions(id,signal,null,101));
 await assert.rejects(client.subscriptions(id,signal,other));
});

import {createCatalogJournal} from "./product-plan-pending-journal";
test("unknown response remains fenced across client remount, recovery is read-only",async()=>{
 let raw:string|null=null,writes=0,version=1;
 const journal=()=>createCatalogJournal({getItem:()=>raw,setItem:(_key,v)=>{raw=v;},removeItem:()=>{raw=null;}},"scope");
 const port:CatalogPort=async(_path,init)=>{if(init.method==="PATCH"){writes++;throw Error("lost");}return {status:200,data:{...dto,version}};};
 const first=createProductPlanClient(port,journal());
 await assert.rejects(first.update(id,{price:500},"1",signal),CatalogOutcomeUnknown);
 assert.deepEqual(JSON.parse(raw!),{planId:id,expectedVersion:"1"});
 const next=createProductPlanClient(port,journal());
 await assert.rejects(next.update(id,{price:100},"1",signal),CatalogOutcomeUnknown);
 assert.equal((await next.recover(signal)).status,"pending");
 assert.equal(writes,1);
 version=2;
 const result=await next.recover(signal);
 assert.equal(result.status,"version-advanced");
 assert.equal(raw,null);assert.equal(writes,1);
});
test("definitive rejection clears fence; invalid storage prevents dispatch",async()=>{
 let raw:string|null=null,writes=0;
 const j=createCatalogJournal({getItem:()=>raw,setItem:(_k,v)=>{raw=v;},removeItem:()=>{raw=null;}},"scope");
 const client=createProductPlanClient(async()=>{writes++;return {status:409,data:null};},j);
 await assert.rejects(client.update(id,{price:5},"1",signal),CatalogRequestError);assert.equal(raw,null);
 raw="corrupt";await assert.rejects(client.update(id,{price:7},"1",signal));assert.equal(writes,1);
});
