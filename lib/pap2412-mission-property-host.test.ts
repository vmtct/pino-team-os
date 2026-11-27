import test from "node:test";
import assert from "node:assert/strict";
import {MISSION_METADATA_COMMAND} from "../app/ho/learning/missions/mission-inline-presentation";
import {missionPropertyField,normalizeMissionPropertyValue,commitMissionProperty,type MissionMetadataBinding} from "../app/ho/learning/missions/MissionMetadataPropertyHost";
const id="01900000-0000-7000-8000-000000002394";
const signal=()=>new AbortController().signal;
test("PAP-2412 PINO property controls match all nine approved fields",()=>{
 const types={name:"text",code:"text",category:"select",level:"number",plsValue:"number",path:"select",description:"textarea",guideline:"textarea",supplementalUrl:"url"} as const;
 for(const field of MISSION_METADATA_COMMAND.fields)assert.equal(missionPropertyField(field,field).type,types[field]);
 assert.deepEqual(missionPropertyField("category","Category").options?.map(o=>o.value),["Staff Training","PINO Afterschool","MyTime"]);
 assert.deepEqual(normalizeMissionPropertyValue("code","  hist-2 "),{ok:true,value:"HIST-2"});
 assert.deepEqual(normalizeMissionPropertyValue("supplementalUrl"," "),{ok:true,value:null});
 assert.deepEqual(normalizeMissionPropertyValue("description",""),{ok:true,value:null});
 for(const [field,value] of [["category",null],["level",6],["plsValue",-1],["path","Other"],["supplementalUrl","javascript:alert(1)"]] as const)assert.deepEqual(normalizeMissionPropertyValue(field,value),{ok:false});
});
test("PAP-2412 editor accepts only one verified next-version command and blocks ambiguous result",async()=>{
 const selection={id,expectedVersion:"5",field:"supplementalUrl"} as const;
 let calls=0,blocked=0;
 const binding:MissionMetadataBinding={command:MISSION_METADATA_COMMAND,commit:async(request,_signal,eligible)=>{
  calls++;assert.equal(eligible(),true);assert.deepEqual(request,{id,expectedVersion:"5",patch:{supplementalUrl:"https://example.test/guide"}});
  return {status:"saved",version:"6"};
 }};
 const block=()=>{blocked++;};
 assert.deepEqual(await commitMissionProperty(selection," https://example.test/guide ",binding,()=>true,signal(),block),{status:"saved",value:"https://example.test/guide"});
 assert.deepEqual(await commitMissionProperty(selection,"ftp://example.test",binding,()=>true,signal(),block),{status:"error"});
 assert.deepEqual(await commitMissionProperty(selection,"https://example.test/guide",binding,()=>false,signal(),block),{status:"denied"});
 assert.equal(calls,1);assert.equal(blocked,0);
 for(const outcome of [{status:"saved",version:"7"},{status:"uncertain"},{status:"conflict"}] as const)
  assert.deepEqual(await commitMissionProperty(selection,null,{...binding,commit:async()=>outcome},()=>true,signal(),block),{status:"conflict"});
 assert.equal(blocked,3);
 let eligible=true;
 assert.deepEqual(await commitMissionProperty(selection,null,{...binding,commit:async()=>{eligible=false;return {status:"saved",version:"6"}}},()=>eligible,signal(),block),{status:"conflict"});
 assert.equal(blocked,4);
});
