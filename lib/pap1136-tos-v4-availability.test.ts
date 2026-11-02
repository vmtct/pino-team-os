import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("PAP-1136 wires TOS V4 calendar to Staff-owned Core availability, not mock state",async()=>{
 const ui=await readFile("app/components/tos-vnext/TosVNextAvailability.tsx","utf8");
 const shift=await readFile("app/components/tos-vnext/TosVNextShift.tsx","utf8");
 assert.ok(shift.includes('<TosVNextAvailability key={centerId+":"+weekStart}'));
 for(const call of [
  /workforceApi\.context\(\)/,
  /workforceApi\.availabilityWeeks\(centerId\)/,
  /workforceApi\.availabilityWindow\(centerId,matched\.id\)/,
  /workforceApi\.availability\(centerId,matched\.id\)/,
  /workforceApi\.availabilityDraft\(centerId,scoped\.weekId\)/,
  /workforceApi\.replaceAvailability\(\{centerId,termWeekId:editScope\.weekId,/,
  /workforceApi\.submitAvailability\(\{centerId,termWeekId:editScope\.weekId,/
 ])assert.match(ui,call);
 assert.match(ui,/expectedVersion:editScope\.submission\.version/);
 assert.match(ui,/submission\.status==="VOIDED"/);
 assert.match(ui,/!context\.data\.staffMemberId/);
 assert.match(ui,/context\.data\.centers\.some\(c=>c\.id===centerId\)/);
 assert.match(ui,/matched=context\.data\.termWeeks\.find/);
 assert.match(ui,/role="alert"/);
 assert.match(ui,/Gửi cho Manager/);
 assert.doesNotMatch(ui,/localStorage|mockAvailability|fakeSuccess/);
});

test("PAP-1136 distinguishes availability preference from real shift assignment",async()=>{
 const ui=await readFile("app/components/tos-vnext/TosVNextAvailability.tsx","utf8");
 assert.match(ui,/Đây chưa phải lịch phân công chính thức/);
 assert.match(ui,/Không thể tải dữ liệu từ Core/);
 assert.match(ui,/Core chưa xác nhận trạng thái SUBMITTED/);
 assert.match(ui,/Đăng ký không thể chỉnh trong trạng thái hiện tại/);
 assert.match(ui,/setRead\(\{centerId,weekStart,weekId:/);
});
