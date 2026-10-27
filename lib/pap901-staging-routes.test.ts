import assert from "node:assert/strict";
import { test } from "node:test";
import { isBoStagingRouteAdmitted } from "../app/bo/architecture/bo-staging-route-policy";
test("PAP-901 admits approved workforce and standalone Subscription paths in BO UI-only staging",()=>{
 for(const path of ["/bo/workforce-shift-plans","/bo/workforce-availability","/bo/workforce-assignments","/bo/payroll-periods","/bo/subscriptions"]) assert.equal(isBoStagingRouteAdmitted(path),true);
 for(const path of ["/bo/workforce-term-weeks","/bo","/bo/learners","/bo/staff","/bo/workforce","/bo/workforce-assignments/extra","/bo/workforce-assignments/../staff"]) assert.equal(isBoStagingRouteAdmitted(path),false);
});
