import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {classroomReadErrorMessage,loadClassroomV4} from "./tos-classroom-v4-reader";
import {classroomFixture} from "./test-fixtures/classroom-v4";
import {renderClassroom} from "./test-support/classroom-v4-render";
test("PAP-945 classroom errors map HTTP status to fixed safe copy",()=>{
 assert.equal(classroomReadErrorMessage(401),"Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
 assert.equal(classroomReadErrorMessage(403),"Bạn chưa có quyền xem lớp học tại cơ sở này.");
 assert.equal(classroomReadErrorMessage(409),"Thông tin lớp học đã thay đổi. Vui lòng tải lại.");
 for(const status of [503,502,404,500,0,null,undefined,"401",999]){
  assert.equal(classroomReadErrorMessage(status),"Chưa thể tải lớp học. Vui lòng thử lại.");
 }
});
test("PAP-945 raw or malicious errors cannot supply classroom UI copy",()=>{
 const malicious="<script>alert('internal-secret')</script> database failure";
 const raw=Object.assign(new Error(malicious),{code:malicious,stack:malicious});
 Object.defineProperty(raw,"toString",{value:()=>{throw new Error("must not stringify diagnostics")}});
 for(const status of [401,403,409,503,undefined]){
  const error=Object.assign(raw,{status});
  const message=classroomReadErrorMessage(error.status);
  assert.ok(!message.includes(malicious));
  assert.equal(classroomReadErrorMessage(error),"Chưa thể tải lớp học. Vui lòng thử lại.");
 }
 assert.equal(classroomReadErrorMessage(malicious),"Chưa thể tải lớp học. Vui lòng thử lại.");
});
test("PAP-945 VNext Classroom renders the mapper without retaining backend diagnostics",()=>{
 const source=readFileSync("app/components/tos-vnext/TosVNextClassroom.tsx","utf8");
 assert.match(source,/import\s*\{[^}]*classroomReadErrorMessage[^}]*\}\s*from\s*["']@\/lib\/tos-classroom-v4-reader["']/);
 assert.match(source,/<p role="alert">\{classroomReadErrorMessage\(read\.status\)\}<\/p>/);
 assert.doesNotMatch(source,/read\.error|\berror\s*(?:\.|\?\.)\s*(?:message|code|stack)\b/);
});
test("PAP-945 401/403/unavailable Core never returns fixture roster or an empty-success model",async()=>{
 const original=globalThis.fetch;try{for(const status of [401,403,404,503]){const paths:string[]=[];globalThis.fetch=async url=>{paths.push(String(url));return Response.json({error:{code:"DENIED",message:"Unavailable"}},{status})};await assert.rejects(loadClassroomV4("center-1","2026-10-26","Actor"),(error:unknown)=>error instanceof Error&&"status" in error&&error.status===status);assert.equal(paths.length,1);assert.ok(!paths[0].includes("sessions/day"))}}finally{globalThis.fetch=original}
});
test("PAP-945 unavailable collection stays distinct from confirmed-empty collection in V4 UI",async()=>{
 const model=classroomFixture();model.data.diaries=[];model.diaryReadState="UNAVAILABLE";
 let html=await renderClassroom(model,{classId:model.classes[0].id,tab:"diaries"});assert.match(html,/Chưa tải được Nhật ký/);assert.ok(!html.includes("Không có Nhật ký phù hợp."));
 model.diaryReadState="LOADED";html=await renderClassroom(model,{classId:model.classes[0].id,tab:"diaries"});assert.match(html,/Không có Nhật ký phù hợp/);
});
