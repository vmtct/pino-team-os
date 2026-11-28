import assert from "node:assert/strict";
import test from "node:test";
import {parseAssignmentStageReview,verifyAssignmentStageReview} from "../app/bo/missions/assignment-stage-admission";
const center="00000000-0000-4000-8000-000000000001";
const actor="review-actor";
const base="https://bo.staging.pinohouse.art/bo/missions?centerId="+center;
const grants=["team.bo.access","student.mission_assignment.view","student.mission_assignment.manage"];
test("PAP-2425 staging exact scoped synthetic route",()=>{
 assert.equal(parseAssignmentStageReview(new URL(base))?.kind,"table");
 assert.equal(parseAssignmentStageReview(new URL(base+"&record=ASSIGNMENT-MOCK-001"))?.kind,"drawer");
 assert.equal(parseAssignmentStageReview(new URL(base+"&record=ASSIGNMENT-MOCK-001&surface=detail&tab=history"))?.tab,"history");
 for(const url of [base+"&centerId="+center,base+"&record=real",base+"&surface=detail",base+"&tab=history",base+"&m1Preview=1",base+"#x",base.replace("bo.staging","bo"),base.replace("centerId="+center,"centerId=bad")]) assert.equal(parseAssignmentStageReview(new URL(url)),null,url);
});
function transport(opts:{keys?:string[];actor?:string;centers?:string[];status?:number;rows?:unknown[];changedActor?:boolean}={}){
 let contextCalls=0;
 const calls:string[]=[];
 const fetcher:typeof fetch=async (input,init)=>{
  const url=new URL(String(input));calls.push(url.pathname);assert.equal(init?.method,"GET");
  assert.equal(url.origin,"https://bo.staging.pinohouse.art");
  if(url.pathname==="/api/bo/context"){contextCalls++;return Response.json({data:{surface:"BO",entitled:true,userId:opts.changedActor&&contextCalls>1?"changed":opts.actor??actor,permissionKeys:opts.keys??grants}});}
  if(url.pathname==="/api/bo/centers")return Response.json({data:(opts.centers??[center]).map(id=>({id}))});
  assert.equal(url.pathname,"/api/bo/learning/mission-assignments");
  assert.equal(url.searchParams.get("centerId"),center);assert.equal(url.searchParams.get("limit"),"1");
  return Response.json({data:opts.rows??[]},{status:opts.status??200});
 };
 return {fetcher,calls};
}
const review=(fetcher:typeof fetch)=>verifyAssignmentStageReview({url:new URL(base),expectedActorId:actor,centerSource:"centers",signal:new AbortController().signal,fetcher});
test("PAP-2425 staging proof requires actor, Center, feature permissions and scoped GET",async()=>{
 const {fetcher,calls}=transport();
 assert.deepEqual(await review(fetcher),{actorId:actor,centerId:center,route:{centerId:center,recordId:null,kind:"table",tab:"overview"}});
 assert.deepEqual(calls,["/api/bo/context","/api/bo/centers","/api/bo/learning/mission-assignments","/api/bo/context","/api/bo/centers"]);
});
test("PAP-2425 staging deny on wrong actor, read-only, unassigned Center, scope denial or stale session",async()=>{
 for(const opts of [{actor:"foreign"},{keys:grants.slice(0,2)},{centers:[]},{status:403},{rows:[{centerId:"foreign"}]},{changedActor:true}]) {
  await assert.rejects(review(transport(opts).fetcher));
 }
});
