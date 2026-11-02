import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const detail=readFileSync(new URL("../app/bo/components/registration/BoFullDetail.tsx",import.meta.url),"utf8");
const income=readFileSync(new URL("../app/bo/components/registration/BoStaffIncomeReadTab.tsx",import.meta.url),"utf8");

test("PAP-876 adds Staff Thu nhập within canonical BO Full Detail",()=>{
  for(const s of ['moduleKey === "staffs"','["Detail", "Thu nhập", "Lịch Sử"]','activeTab === "Thu nhập"','<BoStaffIncomeReadTab staffMemberId={record.id} />']) assert.ok(detail.includes(s),s);
  assert.ok(!detail.includes("StaffCompensationView"));
});
test("PAP-876 income reveal calls Core private GET only after user click",()=>{
  for(const s of ["onClick={()=>void reveal()}","await boApi.staffCompensation(staffMemberId)","row.staffMemberId!==staffMemberId",'setState("denied")','state==="ready"']) assert.ok(income.includes(s),s);
  for(const s of ["createStaffCompensation","correctStaffCompensation","localStorage","sessionStorage","POST","PATCH"]) assert.ok(!income.includes(s),s);
});
test("PAP-876 conceal and stale response fence protect sensitive data",()=>{
  for(const s of ["generation.current+=1","setRows([])","visibilitychange","pagehide","onClick={conceal}"]) assert.ok(income.includes(s),s);
  assert.ok(!income.includes("console.log"));
});
