import test from "node:test";
import assert from "node:assert/strict";
import {createMissionInlineFlow,createMissionInlineFence} from "../app/ho/learning/missions/mission-inline-flow";
import type {MissionEditLoad} from "../app/ho/learning/missions/read-edit";
import type {MissionPathChoice} from "../app/ho/learning/missions/mission-path-options";
const id="01900000-0000-7000-8000-000000002394";
const paths:readonly MissionPathChoice[]=[
 {id:"01900000-0000-7000-8000-000000000011",code:"artchitect",label:"Artchitect"},
 {id:"01900000-0000-7000-8000-000000000012",code:"pianohouse",label:"PianoHouse"},
 {id:"01900000-0000-7000-8000-000000000013",code:"little-piner-art",label:"Little Piner Art"},
 {id:"01900000-0000-7000-8000-000000000014",code:"little-piner-piano",label:"Little Piner Piano"}
];
const source:Extract<MissionEditLoad,{state:"ready"}>={state:"ready",id,version:5,data:{category:null,supplementalUrl:"https://example.test/guide",name:"Historical",code:"HIST-1",level:2,status:"ACTIVE",plsValue:30,paperSize:"A4",description:null,guideline:"Guide",pathProgramId:paths[0]!.id,pathKeySnapshot:paths[0]!.code,prerequisiteMissionId:null,prerequisiteCodeSnapshot:"OLD"}};
type Ports=Parameters<typeof createMissionInlineFlow>[0];
const request={id,expectedVersion:"5",patch:{category:"Staff Training"}};
const signal=()=>new AbortController().signal;
const setup=(override:Partial<Ports>={})=>{
 let current=source,writes=0,reads=0;
 const ports:Ports={read:async()=>{reads++;return current;},paths:async()=>paths,canEdit:()=>true,key:()=>"mission-test-key",
 submit:async command=>{writes++;assert.equal(command.kind,"update");if(command.kind!=="update")throw Error("wrong kind");assert.equal(command.expectedVersion,current.version);current={...current,version:current.version+1,data:command.data};return {state:"verified",record:{id,code:command.data.code,status:"ACTIVE",version:current.version}};},...override};
 return {ports,flow:createMissionInlineFlow(ports),counts:()=>({reads,writes}),current:()=>current,setVersion:(version:number)=>{current={...current,version}}};
};
test("PAP-2412 inline command preserves source metadata and uses exact CAS",async()=>{
 const x=setup();assert.deepEqual(await x.flow(request,signal()),{status:"saved",version:"6"});
 assert.deepEqual(x.current().data,{...source.data,category:"Staff Training"});
 assert.deepEqual(await x.flow(request,signal()),{status:"conflict"});
 assert.deepEqual(x.counts(),{reads:2,writes:1});
});
test("PAP-2412 denies invalid, stale, archived, missing rights and changed selection without write",async()=>{
 const x=setup();
 for(const patch of [{status:"INACTIVE"},{category:null},{name:"",code:"X"},{supplementalUrl:"javascript:alert(1)"}])assert.deepEqual(await x.flow({...request,patch},signal()),{status:"invalid"});
 assert.deepEqual(await x.flow({...request,expectedVersion:"4"},signal()),{status:"conflict"});
 assert.deepEqual(await x.flow({...request,id:"bad"},signal()),{status:"invalid"});
 assert.equal(x.counts().writes,0);
 const denied=setup({canEdit:()=>false});assert.deepEqual(await denied.flow(request,signal()),{status:"denied"});assert.equal(denied.counts().reads,0);
 const archived=setup({read:async()=>({...source,data:{...source.data,status:"INACTIVE"}})});assert.deepEqual(await archived.flow(request,signal()),{status:"denied"});assert.equal(archived.counts().writes,0);
 let canEdit=true;
 const lost=setup({canEdit:()=>canEdit,paths:async()=>{canEdit=false;return paths}});
 assert.deepEqual(await lost.flow(request,signal()),{status:"denied"});assert.equal(lost.counts().writes,0);
});
test("PAP-2412 per-workspace fence blocks concurrent and uncertain replay",async()=>{
 let finish!:()=>void;const wait=new Promise<void>(r=>{finish=r});let writes=0;
 const x=setup({submit:async()=>{writes++;await wait;return {state:"unverified",message:"lost ack"}}});
 const fence=createMissionInlineFence(),a=createMissionInlineFlow(x.ports,fence),b=createMissionInlineFlow(x.ports,fence);
 const first=a(request,signal());assert.deepEqual(await b(request,signal()),{status:"busy"});finish();
 assert.deepEqual(await first,{status:"uncertain"});assert.deepEqual(await b(request,signal()),{status:"uncertain"});assert.equal(writes,1);
 x.setVersion(6);
 assert.deepEqual(await b(request,signal()),{status:"conflict"});assert.equal(writes,1);
});
test("PAP-2412 abort after submission and inconsistent verified result stay uncertain",async()=>{
 const ctrl=new AbortController();
 const x=setup({submit:async()=>{ctrl.abort();return {state:"verified",record:{id,code:"HIST-1",status:"ACTIVE",version:6}}}});
 assert.deepEqual(await x.flow(request,ctrl.signal),{status:"uncertain"});
 assert.deepEqual(await x.flow(request,signal()),{status:"uncertain"});
 const bad=setup({submit:async()=>({state:"verified",record:{id,code:"WRONG",status:"ACTIVE",version:6}})});
 assert.deepEqual(await bad.flow(request,signal()),{status:"uncertain"});
});
