import test from "node:test";
import assert from "node:assert/strict";
import {canReviewRunningClass} from "./running-class-review-access";
const center="01a208c1-8909-7aee-891b-109558e986f9",foreign="01a208c1-8909-7aee-891b-109558e986f8";
const ctx=async()=>({surface:"BO",entitled:true,permissionKeys:["delivery.schedule.manage"]});
test("fixture access uses only exact authorized Center GET",async()=>{
 const calls:string[]=[];const fetcher:typeof fetch=async(input,init)=>{calls.push(String(input));assert.equal(init?.method,"GET");return Response.json({data:{centers:[{id:center}],runningClasses:[{centerId:center}]}});};
 assert.equal(await canReviewRunningClass(center,ctx,fetcher,new AbortController().signal),true);
 assert.deepEqual(calls,["/api/bo/delivery/bootstrap-state?centerId="+center]);
});
test("missing grant, wrong surface, denied scope and abort fail closed without fallback",async()=>{
 let count=0;const deny:typeof fetch=async()=>{count++;return new Response(null,{status:403});};const signal=new AbortController().signal;
 for(const context of [async()=>({surface:"TOS",entitled:true,permissionKeys:["delivery.schedule.manage"]}),async()=>({surface:"BO",entitled:false,permissionKeys:["delivery.schedule.manage"]}),async()=>({surface:"BO",entitled:true,permissionKeys:[]})])assert.equal(await canReviewRunningClass(center,context,deny,signal),false);
 assert.equal(count,0);assert.equal(await canReviewRunningClass(center,ctx,deny,signal),false);assert.equal(count,1);
 assert.equal(await canReviewRunningClass(center,ctx,async()=>Response.json({data:{centers:[{id:foreign}],runningClasses:[]}}),signal),false);
 const abort=new AbortController();abort.abort();assert.equal(await canReviewRunningClass(center,ctx,deny,abort.signal),false);assert.equal(count,1);
});
