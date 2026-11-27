import test from "node:test";
import assert from "node:assert/strict";
import {createMissionMetadataBinding} from "../app/ho/learning/missions/mission-metadata-binding";
import type {MissionEditLoad} from "../app/ho/learning/missions/read-edit";
const id="01900000-0000-7000-8000-000000002394";
const paths=[
 {id:"01900000-0000-7000-8000-000000000011",code:"artchitect",label:"Artchitect"},
 {id:"01900000-0000-7000-8000-000000000012",code:"pianohouse",label:"PianoHouse"},
 {id:"01900000-0000-7000-8000-000000000013",code:"little-piner-art",label:"Little Piner Art"},
 {id:"01900000-0000-7000-8000-000000000014",code:"little-piner-piano",label:"Little Piner Piano"}
] as const;
const source:Extract<MissionEditLoad,{state:"ready"}>={state:"ready",id,version:5,data:{category:null,supplementalUrl:null,name:"Historical",code:"HIST-1",level:2,status:"ACTIVE",plsValue:30,paperSize:"A4",description:null,guideline:"Guide",pathProgramId:paths[0].id,pathKeySnapshot:paths[0].code,prerequisiteMissionId:null,prerequisiteCodeSnapshot:null}};
const request={id,expectedVersion:"5",patch:{category:"Staff Training"}};
const signal=()=>new AbortController().signal;
test("PAP-2412 binding serializes with existing workspace actions and rechecks eligibility",async()=>{
 let locked=true,writes=0,releases=0,notice=0,eligible=true;
 const binding=createMissionMetadataBinding({
  read:async()=>source,paths:async()=>paths,key:()=>"test-key",canEdit:()=>true,
  acquireActionLock:()=>{if(locked)return null;locked=true;return ()=>{locked=false;releases++;};},
  onUncertain:()=>{notice++;},
  submit:async command=>{writes++;assert.equal(command.kind,"update");if(command.kind!=="update")throw Error("wrong kind");return {state:"verified",record:{id,code:command.data.code,status:"ACTIVE",version:6}};}
 });
 assert.deepEqual(await binding.commit(request,signal(),()=>eligible),{status:"busy"});
 locked=false;eligible=false;
 assert.deepEqual(await binding.commit(request,signal(),()=>eligible),{status:"denied"});
 eligible=true;
 const result=binding.commit(request,signal(),()=>eligible);
 assert.deepEqual(await binding.commit(request,signal(),()=>eligible),{status:"busy"});
 assert.deepEqual(await result,{status:"saved",version:"6"});
 assert.equal(writes,1);assert.equal(releases,1);assert.equal(notice,0);assert.equal(locked,false);
});
test("PAP-2412 ambiguous command fences later edits and notifies workspace exactly once",async()=>{
 let writes=0,notice=0,releases=0;
 const binding=createMissionMetadataBinding({
  read:async()=>source,paths:async()=>paths,key:()=>"test-key",canEdit:()=>true,
  acquireActionLock:()=>()=>{releases++;},onUncertain:()=>{notice++;},
  submit:async()=>{writes++;return {state:"unverified",message:"lost acknowledgement"};}
 });
 assert.deepEqual(await binding.commit(request,signal(),()=>true),{status:"uncertain"});
 assert.deepEqual(await binding.commit({...request,expectedVersion:"6"},signal(),()=>true),{status:"uncertain"});
 assert.equal(writes,1);assert.equal(notice,1);assert.equal(releases,1);
});
