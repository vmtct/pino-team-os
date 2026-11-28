import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {currentStaffRate,staffRateReviewRows,staffRateReviewDate} from "../app/bo/workforce/staffs/staff-current-rate";
import {STAFF_DIRECTORY_MOCK_ID as id} from "../app/bo/workforce/staffs/staff-directory-m1-fixture";
test("PAP-2423 PAP-1063 unique current effective rate, not historical or scheduled",()=>{
 const rows=staffRateReviewRows(id)!;
 assert.equal(currentStaffRate(rows,id,staffRateReviewDate)?.amountMinor,36000);
 assert.equal(currentStaffRate(rows,id,"2026-12-01"),null);
 assert.equal(currentStaffRate(rows,id,"2026-02-30"),null);
 assert.equal(currentStaffRate(rows,"foreign",staffRateReviewDate),null);
 assert.equal(currentStaffRate(null,id,staffRateReviewDate),null);
 assert.equal(currentStaffRate(rows.filter(r=>r.state!=="CURRENT"),id,staffRateReviewDate),null);
 assert.equal(currentStaffRate([...rows,{...rows[1]!,id:"M1-AMBIG"}],id,staffRateReviewDate),null);
 assert.equal(currentStaffRate([...rows,{...rows[0]!,id:"M1-OVERLAP",periodUntilExclusive:null}],id,staffRateReviewDate),null);
 assert.equal(staffRateReviewRows("foreign"),null);
});
test("PAP-2423 BO mounted Staff detail has no record mutation controls and registration workflow stays separate",()=>{
 const view=readFileSync("app/bo/workforce/staffs/StaffLifecycleDetail.tsx","utf8");
 const entry=readFileSync("scripts/native-m1-local/bo-staff-directory-entry.tsx","utf8");
 assert.match(view,/data-staff-directory-readonly/);assert.match(view,/data-staff-rate-current/);
 assert.doesNotMatch(view,/fixture\.(edit|deactivate)|BoTypedCellEditor|<button|onSaved/);
 assert.match(entry,/staffDetailReview:/);assert.match(entry,/StaffRegistrationReviewQueue service=/);
 assert.doesNotMatch(entry,/onSaved=\{/);
});
