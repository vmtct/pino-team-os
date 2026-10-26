import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../app/components/tos-vnext/TosVNextClassroom.tsx",import.meta.url),"utf8");

test("PAP-945 roster is loaded from authorized Core response, never placeholder data",()=>{
 assert.match(source,/tosClassroomV18bApi\.today\(centerId,localDate\)/);
 assert.match(source,/setRows\(day\.occurrences\)/);
 assert.match(source,/Core Classroom V18b chưa được phát hành/);
 assert.match(source,/Không có lớp được phân công\/được phép xem hôm nay/);
});

test("PAP-945 mission and diary remain disabled while their Core contracts are unavailable",()=>{
 const mission=source.match(/detailTab==="missions"&&[\s\S]*?detailTab==="diary"/);
 const diary=source.match(/detailTab==="diary"&&[\s\S]*?data-tos-vnext-class-tabs/);
 assert.ok(mission,"mission panel missing");
 assert.ok(diary,"diary panel missing");
 assert.match(mission[0],/TosVNextButton disabled/);
 assert.match(diary[0],/TosVNextButton disabled/);
});