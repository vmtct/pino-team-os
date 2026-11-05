import assert from "node:assert/strict";
import { test } from "node:test";
import { isBoStagingRouteAdmitted } from "../app/bo/architecture/bo-staging-route-policy";
test("PAP-901 only admits three workforce pages in BO UI-only staging",()=>{
 for(const path of ["/bo/workforce-shift-plans","/bo/workforce-availability","/bo/workforce-assignments"]) assert.equal(isBoStagingRouteAdmitted(path),true);
 for(const path of ["/bo/workforce-term-weeks","/bo","/bo/learners","/bo/staff","/bo/workforce","/bo/workforce-assignments/extra","/bo/workforce-assignments/../staff"]) assert.equal(isBoStagingRouteAdmitted(path),false);
});
