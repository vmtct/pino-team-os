import test from "node:test";
import assert from "node:assert/strict";
import {handleBoPlsWishEvent,type BoPlsWishEnv} from "./bo-pls-wish-handler";
import {boPlsWishHostDecision} from "./bo-pls-wish-host-contract";
import type {BoAccessRequest} from "./bo-core";
const id=(n:number)=>"00000000-0000-7000-8000-"+String(n).padStart(12,"0");
const root="/api/bo/pinoria/pls-wish/events",url="https://bo.staging.pinohouse.art"+root,center=id(1),event=id(2);
const auth={cookie:"pino_staff_password_session=synthetic-session"};
function fixture(status=200){const calls:BoAccessRequest[]=[];const env:BoPlsWishEnv={APP_ENV:"staging",PINO_BO_CORE:{executeWithStaffPassword(r,t){assert.equal(t,"synthetic-session");calls.push(r);if(r.path==="context")return Promise.resolve({status:200,body:{data:{userId:id(3),surface:"BO",entitled:true,permissionKeys:["pinoria.wish_event.view","pinoria.wish_event.invalidate"]}},requestId:"trace"});return Promise.resolve({status,body:{data:[]},requestId:"trace"});}}};return{env,calls};}
test("BO Wish exact host and verb, selected Center and query allowlist",async()=>{
 const {env,calls}=fixture();
 for(const host of ["ho.staging.pinohouse.art","tos.staging.pinohouse.art","bo.pinohouse.art"])assert.equal(boPlsWishHostDecision(host,root,"GET"),"not_found");
 assert.equal(boPlsWishHostDecision("bo.staging.pinohouse.art","/api/bo/pinoria/wish/events","GET"),null);
 for(const q of ["","?centerId=bad","?centerId="+center+"&centerId="+center,"?centerId="+center+"&actorUserId="+event,"?centerId="+center+"&beforeEventId="+event,"?centerId="+center+"&limit=101"])assert.equal((await handleBoPlsWishEvent(new Request(url+q,{headers:auth}),env)).status,400);
 assert.equal((await handleBoPlsWishEvent(new Request(url+"?centerId="+center),env)).status,401);
 assert.equal((await handleBoPlsWishEvent(new Request(url+"?centerId="+center,{headers:auth}),{...env,APP_ENV:"production"})).status,404);
 assert.equal((await handleBoPlsWishEvent(new Request(url+"/"+event+"?centerId="+center,{method:"DELETE",headers:auth}),env)).status,404);
 assert.equal(calls.length,0);
});
test("BO Wish cursor, detail and exact invalidation preserve Core response and idempotency",async()=>{
 const {env,calls}=fixture(403),q="?centerId="+center,at="2026-11-18T00:00:00.000Z";
 const r=await handleBoPlsWishEvent(new Request(url+q+"&limit=10&beforeCreatedAt="+encodeURIComponent(at)+"&beforeEventId="+event,{headers:auth}),env);assert.equal(r.status,403);assert.equal(r.headers.get("cache-control"),"private, no-store");
 await handleBoPlsWishEvent(new Request(url+"/"+event+q,{headers:auth}),env);
 const post=(b:unknown,key?:string,actor=id(3))=>new Request(url+"/"+event+"/invalidate"+q,{method:"POST",headers:{...auth,"content-type":"application/json","x-pino-expected-actor":actor,...(key?{"idempotency-key":key}:{})},body:JSON.stringify(b)});
 assert.equal((await handleBoPlsWishEvent(post({reason:"test",actorUserId:event},"key"),env)).status,400);
 assert.equal((await handleBoPlsWishEvent(post({reason:"test"}),env)).status,400);
 assert.equal((await handleBoPlsWishEvent(post({reason:"  QA reason  "},"same-key"),env)).status,403);
 assert.equal((await handleBoPlsWishEvent(post({reason:"QA reason"},"same-key",id(99)),env)).status,403);
 assert.deepEqual(calls,[{method:"GET",path:"pinoria/pls-wish/events",resource:{centerId:center},body:{limit:10,before:{createdAt:at,eventId:event}}},{method:"GET",path:"pinoria/pls-wish/events/"+event,resource:{centerId:center}},{method:"GET",path:"context",resource:{centerId:center}},{method:"POST",path:"pinoria/pls-wish/events/"+event+"/invalidate",resource:{centerId:center},idempotencyKey:"same-key",body:{reason:"QA reason"}},{method:"GET",path:"context",resource:{centerId:center}}]);
});

test("BO reward media is GET-only, actor fenced, event and ordinal scoped",async()=>{
 const {env,calls}=fixture(),path=url+"/"+event+"/reward-media/1?centerId="+center,headers={...auth,"x-pino-expected-actor":id(3)};
 assert.equal((await handleBoPlsWishEvent(new Request(path,{headers}),env)).status,200);
 assert.deepEqual(calls,[{method:"GET",path:"context",resource:{centerId:center}},{method:"GET",path:"pinoria/pls-wish/events/"+event+"/reward-media/1",resource:{centerId:center}}]);calls.length=0;
 for(const bad of [path.replace("/1?","/0?"),path.replace("/1?","/11?"),path.replace("/1?","/01?"),path.replace("bo.staging","ho.staging")])assert.equal((await handleBoPlsWishEvent(new Request(bad,{headers}),env)).status,404);
 assert.equal((await handleBoPlsWishEvent(new Request(path,{method:"POST",headers}),env)).status,404);
 assert.equal((await handleBoPlsWishEvent(new Request(path,{headers:auth}),env)).status,400);
 assert.equal((await handleBoPlsWishEvent(new Request(path+"&itemId="+event,{headers}),env)).status,400);
 assert.equal((await handleBoPlsWishEvent(new Request(path,{headers:{...headers,"x-pino-expected-actor":id(99)}}),env)).status,403);
 assert.deepEqual(calls,[{method:"GET",path:"context",resource:{centerId:center}}]);
});
