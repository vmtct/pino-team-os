import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const station=readFileSync(new URL("../app/components/tos-vnext/TosVNextStation.tsx",import.meta.url),"utf8");

test("PAP-943 sidebar announces active workspace and connects navigation to content",()=>{
 assert.match(station,/aria-label="Điều hướng Trạm TOS"/);
 assert.match(station,/aria-current=\{item\.id===tab\?"page":undefined\}/);
 assert.match(station,/aria-controls="tos-vnext-station-workspace"/);
 assert.match(station,/id="tos-vnext-station-workspace"/);
 assert.match(station,/onClick=\{\(\)=>setTab\(item\.id\)\}/);
});

test("PAP-943 workstation keeps meaningful sidebar icons without inventing Core truth",()=>{
 for(const icon of ["faDesktop","faStar","faUsers","faGear","faTv"]){
  assert.match(station,new RegExp(`\\b${icon}\\b`));
 }
 assert.match(station,/icon=\{stationIcons\[item\.id\]\}/);
 assert.match(station,/Chưa có dữ liệu Core được xác minh/);
});