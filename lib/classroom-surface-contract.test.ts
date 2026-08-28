import test from"node:test";
import assert from"node:assert/strict";
import{readFileSync}from"node:fs";
import{resolve}from"node:path";

test("mentor classroom keeps Attendance read-only",()=>{
 const source=readFileSync(resolve(process.cwd(),"app/classroom/ClassroomView.tsx"),"utf8");
 assert.equal(source.includes("settleRecurring"),false);
 assert.equal(source.includes("participation/settle"),false);
 assert.equal(source.includes("Attendance là dữ liệu vận hành read-only"),true);
 assert.equal(source.includes("Reception/Operations ghi nhận"),true);
});
