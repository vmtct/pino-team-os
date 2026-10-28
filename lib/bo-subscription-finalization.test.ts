import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateRegistrationDates,existingRegistrationPlacements} from "./bo-subscription-finalization";
test("PAP-1100 placement must match contractual range",()=>{
 assert.equal(validateRegistrationDates("2026-10-28","2026-10-28","2027-01-24"),null);
 assert.notEqual(validateRegistrationDates("2026-11-01","2026-10-28","2027-01-24"),null);
 assert.notEqual(validateRegistrationDates("2026-10-28","2027-01-25","2027-01-24"),null);
});
test("PAP-1100 resume uses active Core enrollment facts",()=>{
 const rows=[{runningClassId:"A",effectiveFromLocalDate:"2026-10-01",effectiveUntilExclusiveLocalDate:"2026-11-01"},{runningClassId:"B",effectiveFromLocalDate:"2026-11-01",effectiveUntilExclusiveLocalDate:null}];
 assert.deepEqual(existingRegistrationPlacements(rows,"2026-11-01",new Set(["A","B"])),["B"]);
});
test("PAP-1100 no manual activation in Enrollment, verified activation in Create",()=>{
 const tab=readFileSync("app/bo/subscriptions/BoSubscriptionEnrollmentTab.tsx","utf8");
 const billing=readFileSync("app/bo/subscriptions/BillingWorkspace.tsx","utf8");
 assert.doesNotMatch(tab,/activateSubscription|Kích hoạt|action==="activate"/);
 assert.match(billing,/deferActivation: true/);
 assert.match(billing,/subscriptionPlacement\(subscriptionId,serviceStartsOn\)/);
 assert.match(billing,/finalizeRegistration/);
});

test("PAP-1100 renewal Draft has a safe completion path outside Enrollment",()=>{
 const view=readFileSync("app/bo/subscriptions/BoSubscriptionsView.tsx","utf8");
 assert.match(view,/async function finishRenewal/);
 assert.match(view,/subscription\.predecessorSubscriptionId/);
 assert.match(view,/boApi\.subscriptionPlacement\(subscription\.id,serviceStartsOn\)/);
 assert.match(view,/boApi\.activateSubscription\(subscription\.id/);
 assert.match(view,/Hoàn tất gia hạn/);
});
