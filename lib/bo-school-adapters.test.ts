import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {boSkeletonRoute,BO_SKELETON_HOST} from "./bo-skeleton-routing";
const {modules,load}=createRequire(import.meta.url)("../public/bo-authority-source/school-adapters.js");
const id=(n:number)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const ok=(data:unknown)=>new Response(JSON.stringify({data}),{headers:{"content-type":"application/json"}});
test("exactly ten retained read-only modules including Parent; Enrollment is a subscription-class link, no Path module",()=>{
 assert.deepEqual(Object.keys(modules),["students","parents","classes","subscriptions","enrollments","visits","staffs","timekeeping","salaryPeriods","audits"]);
 assert.ok(Object.values(modules).every((m:unknown)=>(m as {fields:{readonly:boolean}[]}).fields.every(f=>f.readonly)));
 assert.ok(modules.enrollments.fields.some((f:{key:string})=>f.key==="subscriptionId"));assert.ok(modules.enrollments.fields.some((f:{key:string})=>f.key==="runningClassId"));
});
test("canonical /bo rewrite and legacy redirect are confined to exact staging host",()=>{
 assert.equal(boSkeletonRoute(BO_SKELETON_HOST,"/bo"),"runtime");assert.equal(boSkeletonRoute("bo.staging.pinohouse.art","/bo"),"runtime");assert.equal(boSkeletonRoute(BO_SKELETON_HOST,"/bo-skeleton/playground.html"),"redirect");
 for(const host of ["bo.pinohouse.art","tos.pinohouse.art","localhost"])assert.equal(boSkeletonRoute(host,"/bo"),null);
});
test("Classes uses current bootstrap read and maps actual labels/status without legacy fallback",async()=>{
 const calls:string[]=[];const rows=await load("classes",async(url:string,init:RequestInit)=>{calls.push(url);assert.equal(init.method,"GET");return ok({paths:[{id:id(1),displayName:"Art"}],centers:[{id:id(2),displayName:"Test Center"}],runningClasses:[{id:id(3),pathProgramId:id(1),centerId:id(2),operationalName:"Class",weekdayIso:1,windowStartsLocal:"18:00",windowEndsLocal:"19:30",optimalConcurrentCapacity:3,deliveryTopology:"FIXED_COHORT",status:"ARCHIVED"}]});});
 assert.deepEqual(calls,["/api/bo/delivery/bootstrap-state"]);assert.equal(rows[0].status,"ARCHIVED");assert.equal(rows[0].path,"Art");
});
test("Subscription cursor pagination and Enrollment IDs remain canonical; no mutation calls",async()=>{
 let count=0;const rows=await load("subscriptions",async(url:string,init:RequestInit)=>{assert.equal(init.method,"GET");count++;if(count===2)assert.match(url,/beforeSubscriptionId=/);return ok({items:[{id:id(count),studentDisplayName:"Student",pathDisplayName:"Art",lifecycle:"ACTIVE"}],nextCursor:count===1?{createdAt:"2026-10-25T00:00:00Z",id:id(1)}:null});});assert.equal(rows.length,2);
 const e=await load("enrollments",async(url:string)=>{assert.match(url,/\/school\/enrollments/);return ok({items:[{id:id(3),subscriptionId:id(1),runningClassId:id(2),studentDisplayName:"Student",runningClassName:"Class",pathDisplayName:"Art"}],nextCursor:null});});assert.equal(e[0].subscriptionId,id(1));
});
test("all modules fail closed on403/409 and reject mock/unknown modules before fetching",async()=>{
 for(const key of Object.keys(modules))for(const status of [403,409])await assert.rejects(load(key,async()=>new Response(null,{status})),status===403?/quyền/:/thay đổi/);
 await assert.rejects(load("registration",async()=>{throw Error("must not fetch");}),/chưa được kết nối/);
});
