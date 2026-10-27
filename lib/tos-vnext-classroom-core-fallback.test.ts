import test from "node:test";
import assert from "node:assert/strict";
import {loadClassroomV4} from "./tos-classroom-v4-reader";
import {classroomFixture} from "./test-fixtures/classroom-v4";
import {renderClassroom} from "./test-support/classroom-v4-render";
test("PAP-945 401/403/unavailable Core never returns fixture roster or an empty-success model",async()=>{
 const original=globalThis.fetch;try{for(const status of [401,403,404,503]){const paths:string[]=[];globalThis.fetch=async url=>{paths.push(String(url));return Response.json({error:{code:"DENIED",message:"Unavailable"}},{status})};await assert.rejects(loadClassroomV4("center-1","2026-10-26","Actor"),(error:unknown)=>error instanceof Error&&"status" in error&&error.status===status);assert.equal(paths.length,1);assert.ok(!paths[0].includes("sessions/day"))}}finally{globalThis.fetch=original}
});
test("PAP-945 unavailable collection stays distinct from confirmed-empty collection in V4 UI",async()=>{
 const model=classroomFixture();model.data.diaries=[];model.diaryReadState="UNAVAILABLE";
 let html=await renderClassroom(model,{classId:model.classes[0].id,tab:"diaries"});assert.match(html,/Chưa tải được Nhật ký/);assert.ok(!html.includes("Không có Nhật ký phù hợp."));
 model.diaryReadState="LOADED";html=await renderClassroom(model,{classId:model.classes[0].id,tab:"diaries"});assert.match(html,/Không có Nhật ký phù hợp/);
});
