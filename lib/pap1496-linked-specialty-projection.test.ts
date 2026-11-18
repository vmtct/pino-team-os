import {test} from "node:test";
import assert from "node:assert/strict";
import {readLinkedSpecialtyProjection} from "./bo-linked-specialty-projection";
import {BoApiError} from "./bo-api-error";
const id=(n:number)=>"019a0f22-1111-7111-8111-"+String(n).padStart(12,"0");
const scope={subscriptionId:id(1),centerId:id(2),specialtyId:id(3),pathProgramId:id(4),pathLabel:"Artchitect"};
const detail={id:scope.specialtyId,pathProgramId:scope.pathProgramId,name:"Art",description:null,status:"ACTIVE",tags:[],version:2,
 missionCountDistinct:1,prerequisiteIds:[id(5)],levels:[{id:id(6),order:1,name:"Level",missionIds:[id(7)]}]};
const list={subject:{id:scope.subscriptionId,centerId:scope.centerId,pathProgramId:scope.pathProgramId},
 catalog:[{id:id(5),name:"Intro",pathProgramId:scope.pathProgramId}]};
function transport(record:unknown=detail,catalog:unknown=list){
 const calls:string[]=[];
 const fetcher:typeof fetch=async(input,init)=>{
  const url=String(input);calls.push(url);
  assert.equal(init?.method,"GET");assert.equal(init?.credentials,"same-origin");
  assert.ok(url.includes("?centerId="+scope.centerId));
  assert.ok(url.startsWith("/api/bo/subscriptions/"+scope.subscriptionId+"/specialties"));
  return Response.json({data:url.includes("/specialties/")?record:catalog});
 };
 return {calls,fetcher};
}
void test("PAP-1496 linked record projection reads canonical fields and same-path prerequisite names",async()=>{
 const {fetcher,calls}=transport();
 const record=await readLinkedSpecialtyProjection(scope,fetcher,new AbortController().signal);
 assert.equal(record.row.name,"Art");assert.equal(record.row.path,"Artchitect");assert.equal(record.row.levelCount,1);
 assert.deepEqual(record.row.prerequisiteView,["Intro"]);assert.equal(record.row.createdBy,"—");
 assert.equal(record.version,"2");assert.equal(record.centerId,scope.centerId);assert.equal(calls.length,2);
});
void test("PAP-1496 denies mismatched record/path and non-active projections",async()=>{
 for(const record of [{...detail,id:id(99)},{...detail,pathProgramId:id(99)},{...detail,status:"DRAFT"},{...detail,status:"ARCHIVED"}]){
  const {fetcher}=transport(record);
  await assert.rejects(readLinkedSpecialtyProjection(scope,fetcher,new AbortController().signal),(e:unknown)=>e instanceof BoApiError&&e.status===403);
 }
});
void test("PAP-1496 rejects foreign catalog subject and missing prerequisite names",async()=>{
 for(const catalog of [{...list,subject:{...list.subject,centerId:id(99)}},{...list,catalog:[]}]){
  const {fetcher}=transport(detail,catalog);
  await assert.rejects(readLinkedSpecialtyProjection(scope,fetcher,new AbortController().signal));
 }
 const ctl=new AbortController();ctl.abort();
 const {fetcher,calls}=transport();
 await assert.rejects(readLinkedSpecialtyProjection(scope,fetcher,ctl.signal));assert.equal(calls.length,0);
});
