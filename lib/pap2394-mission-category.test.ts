import test from "node:test";
import assert from "node:assert/strict";
import {missionCategories,isMissionCategory} from "../app/ho/learning/missions/mission-category";
import {createMissionM1Boundary,MISSION_M1_ID} from "../app/ho/learning/missions/mission-m1-boundary";
import {missionCategoryColumnKeys,missionTableColumnKeys,missionCategoryDefinition,missionInlineFields,missionInlineTableFields,missionCategoryPropertyKeys} from "../app/ho/learning/missions/schema";
import {emptyMission,validateMissionCreate} from "../app/ho/learning/missions/MissionCreateFields";
test("PAP-2394 exact category and unchanged PLS/Path/audit fields",()=>{
 assert.deepEqual(missionCategories,["Staff Training","PINO Afterschool","MyTime"]);
 assert.equal(isMissionCategory("Other"),false);
 assert.deepEqual(missionCategoryColumnKeys.filter(k=>k!=="category"),missionTableColumnKeys);
 assert.deepEqual(missionCategoryDefinition.table.inlineEdit.fields,missionInlineTableFields);
 assert.deepEqual(missionCategoryDefinition.fields.filter(f=>f.capabilities.inlineEdit).map(f=>f.key).sort(),[...missionInlineFields].sort());
 assert.ok(missionCategoryPropertyKeys.includes("description")&&missionCategoryPropertyKeys.includes("guideline"));
 assert.equal(validateMissionCreate(emptyMission,true),"Vui lòng chọn Category.");
});
test("PAP-2394 isolated Mission category edit preserves Staff PLS and denies stale/other patches",async()=>{
 const boundary=createMissionM1Boundary(), signal=new AbortController().signal;
 const {adapter}=await boundary.open(signal);
 const old=await adapter.detail(MISSION_M1_ID,signal);
 assert.equal(old?.row.category,"Staff Training");assert.equal(old?.row.plsValue,30);
 const update=(patch:unknown,version:string,context=adapter.context)=>adapter.mutation!.update(MISSION_M1_ID,patch as never,version,context,signal);
 assert.equal((await update({category:"Other"},"1")).status,"invalid");
 assert.equal((await update({plsValue:-1},"1")).status,"invalid");
 assert.equal((await update({status:"INACTIVE"},"1")).status,"invalid");
 assert.equal((await update({category:"MyTime"},"0")).status,"conflict");
 assert.equal((await update({category:"MyTime"},"1",{surface:"HO",authorize:()=>true})).status,"denied");
 assert.equal((await update({category:"MyTime"},"1")).status,"saved");
 const next=await adapter.detail(MISSION_M1_ID,signal);
 assert.equal(next?.row.category,"MyTime");assert.equal(next?.row.plsValue,30);
 const independent=await createMissionM1Boundary().open(signal);
 assert.equal((await independent.adapter.detail(MISSION_M1_ID,signal))?.row.category,"Staff Training");
});
test("PAP-2394 new/edit/archived preview record uses exact category and PLS",async()=>{
 const boundary=createMissionM1Boundary(), paths=await boundary.paths();
 const d={...emptyMission,name:"Mission mẫu",code:"MOCK-NEW",category:"Staff Training" as const,plsValue:25,pathProgramId:paths[0].id,pathKeySnapshot:paths[0].code};
 const bad=await boundary.submit({kind:"create",data:{...d,category:null},idempotencyKey:"mock-invalid"});
 assert.equal(bad.state,"invalid");
 const created=await boundary.submit({kind:"create",data:d,idempotencyKey:"mock-create"});
 assert.equal(created.state,"verified");
 if(created.state!=="verified")throw Error("not created");
 const read=await boundary.load(created.record.id);
 assert.equal(read.state,"ready");
 if(read.state!=="ready")throw Error("not ready");
 assert.equal(read.data.category,"Staff Training");assert.equal(read.data.plsValue,25);
 const edited=await boundary.submit({kind:"update",id:read.id,expectedVersion:read.version,data:{...read.data,category:"PINO Afterschool"},idempotencyKey:"mock-edit"});
 assert.equal(edited.state,"verified");
 assert.throws(()=>createMissionM1Boundary("real-id"));
});

test("PAP-2394 all eight inline fields validate and read back; protected fields stay immutable",async()=>{
 const b=createMissionM1Boundary(),signal=new AbortController().signal,{adapter}=await b.open(signal);
 const update=(patch:unknown,version:string)=>adapter.mutation!.update(MISSION_M1_ID,patch as never,version,adapter.context,signal);
 for(const patch of [{name:" "},{code:"!"},{level:6},{level:1.5},{plsValue:1.1},{path:"unknown"},{description:"x".repeat(4001)},{guideline:"x".repeat(8001)},{createdAt:"fake"},{paperSize:"A4"},{name:"a",code:"AB"}])assert.equal((await update(patch,"1")).status,"invalid");
 let version="1";
 for(const [key,value] of Object.entries({name:"Mission revised",code:"mock-revised",category:"MyTime",level:5,plsValue:45,path:"PianoHouse",description:"Mô tả mới",guideline:"Hướng dẫn mới"})){
  const r=await update({[key]:value},version);
  assert.equal(r.status,"saved",key);if(r.status!=="saved")throw Error(key);
  version=r.version;assert.equal(r.row[key as keyof typeof r.row],key==="code"?"MOCK-REVISED":value);
 }
 const read=await b.load(MISSION_M1_ID);assert.equal(read.state,"ready");if(read.state!=="ready")throw Error("read");
 assert.equal(read.data.pathKeySnapshot,"pianohouse");assert.equal(read.data.pathProgramId,(await b.paths()).find(p=>p.code==="pianohouse")?.id);
 assert.equal((await adapter.detail(MISSION_M1_ID,signal))?.row.createdAt,"—");
 assert.equal((await update({name:"stale"},"1")).status,"conflict");
 assert.equal((await b.submit({kind:"archive",id:read.id,expectedVersion:read.version,data:read.data,idempotencyKey:"archive-mock"})).state,"verified");
 assert.equal((await update({name:"archived"},String(read.version+1))).status,"denied");
});

test("PAP-2394 M1-B canonical query and actual admitted actor boundary",async()=>{
 const {parseMissionM1Query,hasMissionM1Permissions,MISSION_M1_READ,MISSION_M1_EDIT}=await import("../app/ho/learning/missions/mission-m1-query");
 assert.deepEqual(parseMissionM1Query(new URLSearchParams()),{});
 assert.deepEqual(parseMissionM1Query(new URLSearchParams("record=MISSION-MOCK-001")),{record:MISSION_M1_ID});
 for(const query of ["m1Preview=1","record=real-id","record=","record=MISSION-MOCK-001&record=MISSION-MOCK-001","tab=history"])assert.equal(parseMissionM1Query(new URLSearchParams(query)),null);
 assert.equal(hasMissionM1Permissions([MISSION_M1_READ]),false);
 assert.throws(()=>createMissionM1Boundary(undefined,{userId:"actor",permissionKeys:[MISSION_M1_READ]}));
 assert.throws(()=>createMissionM1Boundary(undefined,{userId:"",permissionKeys:[MISSION_M1_READ,MISSION_M1_EDIT]}));
 const b=createMissionM1Boundary(MISSION_M1_ID,{userId:"test-actor",permissionKeys:[MISSION_M1_READ,MISSION_M1_EDIT,"foreign.permission"]});
 const {adapter,navigation}=await b.open(new AbortController().signal);
 assert.equal(adapter.userId,"test-actor");assert.equal(adapter.context.authorize("foreign.permission"),false);
 assert.equal(navigation.read().recordId,MISSION_M1_ID);
});
