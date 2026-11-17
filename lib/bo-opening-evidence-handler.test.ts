import test from "node:test";
import assert from "node:assert/strict";
import {handleBoOpeningEvidence,type BoOpeningEvidenceEnv} from "./bo-opening-evidence-handler";
import type {BoAccessRequest} from "./bo-core";
const id=(n:number)=>"00000000-0000-7000-8000-"+String(n).padStart(12,"0");
const center=id(1),receipt=id(2),asset=id(3);
const url="https://bo.staging.pinohouse.art/api/bo/opening-evidence";
const auth={cookie:"pino_staff_password_session=synthetic-session"};
function fixture(body:unknown,status=200){
 const calls:BoAccessRequest[]=[];
 const env:BoOpeningEvidenceEnv={PINO_BO_CORE:{executeWithStaffPassword(request,token){
   assert.equal(token,"synthetic-session");calls.push(request);
   return Promise.resolve({status,body,requestId:"trace"});
 }}};
 return {calls,env};
}
test("PAP-764 BO BFF denies invalid scopes, routes and unauthenticated reads without Core calls",async()=>{
 const {env,calls}=fixture({});
 for(const q of ["","?centerId=bad","?centerId="+center+"&centerId="+center,"?centerId="+center+"&role=Founder"]){
   assert.equal((await handleBoOpeningEvidence(new Request(url+q),env,[])).status,400);
 }
 assert.equal((await handleBoOpeningEvidence(new Request(url+"?centerId="+center),env,[])).status,401);
 assert.equal((await handleBoOpeningEvidence(new Request(url,{method:"DELETE",headers:auth}),env,["CLASS",receipt])).status,404);
 assert.equal(calls.length,0);
});
test("PAP-764 BO BFF forwards selected Center only to authorized Core, no public media link",async()=>{
 const {env,calls}=fixture({data:{mimeType:"image/png",base64:"AQID"}});
 const r=await handleBoOpeningEvidence(new Request(url+"?centerId="+center,{headers:auth}),env,["RECEPTION",receipt,"photo",asset]);
 assert.equal(r.status,200);assert.equal(r.headers.get("content-type"),"image/png");
 assert.equal(r.headers.get("cache-control"),"private, no-store");assert.equal(r.headers.get("x-content-type-options"),"nosniff");
 assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[1,2,3]);
 assert.deepEqual(calls[0],{method:"GET",path:"opening-evidence/RECEPTION/"+receipt+"/photo/"+asset,resource:{centerId:center}});
});
test("PAP-764 BO BFF forwards review CAS and relays denied Core response, not caller role",async()=>{
 const {env,calls}=fixture({error:{code:"DENIED"}},403);
 const body={centerId:center,expectedVersion:1,roundId:id(4),verdict:"REJECTED",reason:"Ảnh chưa đủ sáng",requestKey:id(5)};
 const post=(b:unknown)=>new Request(url,{method:"POST",headers:auth,body:JSON.stringify(b)});
 assert.equal((await handleBoOpeningEvidence(post({...body,actorStaffId:id(7)}),env,["CLASS",receipt,"review"])).status,400);
 assert.equal((await handleBoOpeningEvidence(post(body),env,["CLASS",receipt,"review"])).status,403);
 const {centerId:_,...expected}=body;
 assert.deepEqual(calls,[{method:"POST",path:"opening-evidence/CLASS/"+receipt+"/review",resource:{centerId:center},body:expected}]);
});
