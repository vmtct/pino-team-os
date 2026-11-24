import test from "node:test";
import assert from "node:assert/strict";
import { classify } from "./classify-m1-fe-candidate.mjs";
const root="app/ho/staff";
const input={base:"a".repeat(40),head:"b".repeat(40),featureRoot:root};
const change=(path,status="M")=>({status,path});
const run=(changes,override={})=>classify({...input,changes,...override});
test("feature-local UI is only an advisory candidate",()=>{
 const r=run([change(root+"/StaffManualPreview.tsx"),change(root+"/staff.module.css","A")]);
 assert.equal(r.classification,"FE_ONLY_CANDIDATE");assert.equal(r.canSkipChecks,false);assert.equal(r.requiredChecks,"UNCHANGED");
});
test("mixed, shared, auth, route, workflow, lockfile and config changes use full pipeline",()=>{
 for(const p of ["app/ho/layout.tsx","lib/auth.ts","app/api/x/route.ts",".github/workflows/pr-validation.yml","bun.lock","config/tdd-admission.json",root+"/page.tsx",root+"/auth/Guard.tsx",root+"/server/Read.tsx",root+"/contract.ts","app/bo/leads/Lead.tsx"]){
  assert.equal(run([change(root+"/Staff.tsx"),change(p)]).classification,"FULL_PIPELINE",p);
 }
});
test("unknown, rename/delete, traversal, ambiguous and empty fail closed",()=>{
 for(const list of [[],undefined,[change(root+"/Staff.tsx","D")],[change(root+"/Staff.tsx","R100")],[change(root+"/../Staff.tsx")],[change(root+"/Staff.tsx"),change(root+"/staff.tsx")]]){
  assert.equal(run(list).classification,"FULL_PIPELINE");
 }
 for(const patch of [{base:"bad"},{head:input.base},{featureRoot:"app/ho/shared"}]) assert.equal(run([change(root+"/Staff.tsx")],patch).classification,"FULL_PIPELINE");
});
