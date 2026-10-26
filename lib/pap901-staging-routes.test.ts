import assert from "node:assert/strict";
import { test } from "node:test";
import { isWorkforceBoStagingRoute } from "../app/bo/architecture/workforce-staging-routes";
test("PAP-901 only admits four workforce pages in BO UI-only staging",()=>{
 for(const path of ["/bo/workforce-term-weeks","/bo/workforce-shift-plans","/bo/workforce-availability","/bo/workforce-assignments"]) assert.equal(isWorkforceBoStagingRoute(path),true);
 for(const path of ["/bo","/bo/learners","/bo/staff","/bo/workforce","/bo/workforce-assignments/extra","/bo/workforce-assignments/../staff"]) assert.equal(isWorkforceBoStagingRoute(path),false);
});
