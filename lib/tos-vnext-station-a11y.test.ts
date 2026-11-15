import test from "node:test";
import assert from "node:assert/strict";
import {renderV4} from "./test-support/v4-render";
test("PAP-943 navigation announces selected workspace and targets its content",async()=>{
 const html=await renderV4("TosVNextStation",{desktop:true,onHome:()=>{},centerName:"Test",initialTab:"students"});
 assert.match(html,/aria-label="Điều hướng Trạm TOS"/);assert.equal((html.match(/aria-current="page"/g)||[]).length,2);
 assert.equal((html.match(/aria-controls="tos-vnext-station-workspace"/g)||[]).length,5);assert.match(html,/id="tos-vnext-station-workspace"/);
 assert.match(html,/<table/);assert.match(html,/<th>Học viên<\/th>/);
});
test("PAP-2000 mobile keeps five tabs and shared mobile chrome",async()=>{
 const html=await renderV4("TosVNextStation",{desktop:false,onHome:()=>{},centerName:"Test"});
 assert.match(html,/data-tos-vnext-station="mobile"/);assert.match(html,/data-tos-phone-frame="station"/);assert.match(html,/data-tos-shared="bottom-nav"/);assert.doesNotMatch(html,/Trạm TOS chỉ dùng trên máy tính/);assert.match(html,/Về TOS Home/);
});
