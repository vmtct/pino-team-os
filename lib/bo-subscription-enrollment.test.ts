import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {enrollmentStatus,validExclusiveEnd,isEligibleClass,todayInHouseTimeZone} from "./bo-enrollment-contract";
const row={effectiveFromLocalDate:"2026-10-27",effectiveUntilExclusiveLocalDate:"2026-11-04"};
test("PAP-1035 exclusive dates show historical/upcoming/current status",()=>{
 assert.equal(enrollmentStatus(row,"2026-10-26"),"UPCOMING");
 assert.equal(enrollmentStatus(row,"2026-10-27"),"CURRENT");
 assert.equal(enrollmentStatus(row,"2026-11-03"),"CURRENT");
 assert.equal(enrollmentStatus(row,"2026-11-04"),"ENDED");
 assert.equal(enrollmentStatus({...row,effectiveUntilExclusiveLocalDate:null},"2028-01-01"),"CURRENT");
 assert.equal(validExclusiveEnd("2026-10-27","2026-10-27"),false);
 assert.equal(validExclusiveEnd("2026-10-27","2026-10-28"),true);
});
test("PAP-1035 center and Path are distinct authoritative constraints",()=>{
 const cls={status:"ACTIVE",centerId:"C1",pathProgramId:"LP-ART"};
 assert.equal(isEligibleClass(cls,"LP-ART","C1"),true);
 assert.equal(isEligibleClass(cls,"LP-PIANO","C1"),false);
 assert.equal(isEligibleClass(cls,"LP-ART","C2"),false);
 assert.equal(isEligibleClass({...cls,status:"INACTIVE"},"LP-ART","C1"),false);
});
test("PAP-1035 Vietnam-local asOf date is independent of browser timezone",()=>{
 assert.equal(todayInHouseTimeZone(new Date("2026-10-26T18:00:00Z")),"2026-10-27");
});
test("PAP-1035 Full Detail Enrollment uses shared DS and Core reads, no table clone",()=>{
 const tab=readFileSync("app/bo/subscriptions/BoSubscriptionEnrollmentTab.tsx","utf8");
 const detail=readFileSync("app/bo/components/registration/BoFullDetail.tsx","utf8");
 const api=readFileSync("lib/bo-api.ts","utf8");
 assert.match(detail, /<BoSubscriptionEnrollmentTab subscriptionId=\{record.id\}/);
 assert.match(tab,/data-bo-s3-enrollment="core"/);
 assert.match(tab,/<BoDataGrid/);
 assert.doesNotMatch(tab,/<table/);
 for(const method of ["subscriptionById","subscriptionEnrollments","subscriptionPlacement","enrollmentCapacity","placeEnrollment","transferEnrollment","endEnrollment","activateSubscription"])
  assert.match(tab,new RegExp("boApi\\."+method+"\\("));
 assert.match(api,/enrollments\/capacity/);
 assert.match(api,/enrollments\/bulk-preflight/);
 assert.match(tab,/effectiveUntilExclusiveLocalDate/);
 assert.match(tab,/predecessorEnrollmentId/);
});
test("PAP-1035 mutations remain separately authenticated, replay same key and version",()=>{
 const tab=readFileSync("app/bo/subscriptions/BoSubscriptionEnrollmentTab.tsx","utf8");
 assert.match(tab,/crypto\.randomUUID\(\),policyEffectiveAt:new Date\(\)\.toISOString\(\)/);
 assert.match(tab,/policyEffectiveAt:attempt.policyEffectiveAt/);
 assert.match(tab,/if\(pending\)/);
 assert.match(tab,/attempt.key/);
 assert.match(tab,/expectedVersion:attempt.version!/);
 assert.match(tab,/placementState!=="PLACED"/);
 assert.doesNotMatch(tab,/createBillingSale/);
});

test("PAP-1035 Quick View labels Enrollment accurately and cannot disguise Transfer as Full Detail",()=>{
 const tab=readFileSync("app/bo/subscriptions/BoSubscriptionEnrollmentTab.tsx","utf8");
 const quick=readFileSync("app/bo/components/registration/BoQuickView.tsx","utf8");
 assert.match(tab,/label:"Enrollment ID"/);
 assert.match(tab,/hideDetailAction/);
 assert.doesNotMatch(tab,/onDetail=\{\(\)=>open\("transfer",active\)\}/);
 assert.match(quick,/hideDetailAction/);
 assert.match(quick,/record && hideDetailAction/);
});
