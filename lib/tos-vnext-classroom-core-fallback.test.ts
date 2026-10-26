import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../app/components/tos-vnext/TosVNextClassroom.tsx",import.meta.url),"utf8");

test("PAP-945 does not show a fabricated Classroom roster when Core cannot answer",()=>{
 assert.match(source,/setRows\(\[\]\);setError\(/);
 assert.match(source,/Core Classroom V18b chưa được phát hành/);
 assert.match(source,/!busy&&!error&&rows\.map\(/);
});

test("PAP-945 preserves retry after a Core read error",()=>{
 assert.match(source,/setRefresh\(x=>x\+1\)/);
 assert.match(source,/\[centerId,localDate,refresh\]/);
 assert.match(source,/setBusy\(true\);setError\(""\);setRows\(\[\]\)/);
});

test("PAP-945 blocks diary actions when verified Core authorization is unavailable",()=>{
 assert.match(source,/TosVNextButton disabled>Ghi \/ đóng nhật ký/);
 assert.match(source,/TosVNextButton disabled>Đọc giáo án/);
});