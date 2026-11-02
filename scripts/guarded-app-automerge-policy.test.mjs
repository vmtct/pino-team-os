import test from "node:test";
import assert from "node:assert/strict";
import { assessApplicationFiles } from "./guarded-app-automerge-policy.mjs";
import { safeUiPath, assessFiles } from "./guarded-ui-automerge.mjs";

const files = names => names.map(filename => ({ filename, status: "modified" }));
const PIN = [
  "app/bo/architecture/bo-unified-workspace-source.ts",
  "lib/bo-sidebar-routes.ts",
  "lib/bo-url-contract.test.ts",
  "lib/bo-url-contract.ts",
  "scripts/verify-bo-runtime-surface-ownership.mjs",
  "scripts/verify-bo-runtime-surface-ownership.test.mjs",
];
const ctx = {prNumber:948,headSha:"4d459bbde542be98fd4a29ad0deff9196de4eb4c"};
const classify = (names,context={}) => assessApplicationFiles(files(names),context,safeUiPath);

test("PAP-1091 Founder-scoped pinned verifier PR requires immutable exact head and file list", () => {
  assert.deepEqual(classify(PIN,ctx),{ok:true,lane:"pinned-pap1089"});
  assert.deepEqual(assessFiles(files(PIN),ctx),{ok:true,lane:"pinned-pap1089"});
  for(const newCtx of [
    {...ctx,headSha:"0".repeat(40)},
    {...ctx,prNumber:949},
  ]) assert.equal(classify(PIN,newCtx).ok,false);
  for(const altered of [
    PIN.slice(0,-1),
    [...PIN,"lib/bo-auth.ts"],
    [...PIN.slice(0,-1),"scripts/verify-bo-module-contract.mjs"]
  ]) assert.equal(classify(altered,ctx).ok,false);
});

test("PAP-1091 scoped application lane needs approved paths and regression",()=>{
  assert.deepEqual(classify(["lib/bo-url-contract.ts","lib/bo-url-contract.test.ts"],{prNumber:1100}),{ok:true,lane:"scoped-application"});
  assert.equal(classify(["lib/bo-url-contract.ts"],{prNumber:1100}).ok,false);
  assert.equal(classify(["app/bo/architecture/bo-unified-workspace-source.ts","lib/bo-url-contract.test.ts"],{prNumber:1100}).ok,true);
  assert.equal(classify(["app/bo/components/Student.tsx"],{prNumber:1100}).ok,false);
  assert.equal(assessFiles(files(["app/bo/components/Student.tsx"]),{prNumber:1100}).ok,true);
});

test("PAP-1091 never auto admits arbitrary lib, scripts, auth, CI or infra",()=>{
  for(const forbidden of [
    "lib/bo-auth.ts","lib/bo-permission.ts","lib/bo-core.ts",
    "scripts/verify-bo-module-contract.mjs",
    "scripts/verify-bo-runtime-surface-ownership.mjs",
    ".github/workflows/pr-validation.yml",
    ".github/workflows/guarded-ui-automerge.yml",
    "ops/team-production-build-boundary.json",
    "app/api/bo/route.ts",
    "wrangler.ho-staging.json",
  ]) assert.equal(classify(["lib/bo-url-contract.test.ts",forbidden],{prNumber:1100}).ok,false,forbidden);
});

test("PAP-1091 reject renamed/removed files and duplicate paths, including pinned PR",()=>{
  const cases=[
    [...files(PIN.slice(1)),{filename:PIN[0],previous_filename:"lib/bo-auth.ts",status:"renamed"}],
    [...files(PIN.slice(1)),{filename:PIN[0],status:"removed"}],
    [...files(PIN),{filename:PIN[0],status:"modified"}],
    [],
    Array(41).fill({filename:"lib/bo-url-contract.ts",status:"modified"}),
  ];
  for(const arr of cases)assert.equal(assessApplicationFiles(arr,ctx,safeUiPath).ok,false);
});

test("PAP-1091 filenames cannot silently alter the scoped policy",()=>{
  assert.equal(classify(["lib/bo-url-contract.ts","lib/bo-url-contract.test.ts","scripts/guarded-app-automerge-policy.mjs"],{prNumber:1100}).ok,false);
});

test("PAP-1091 activation dates do not reclassify existing UI PRs as stale",async()=>{
  const {policyEpochForLane,assessPR}=await import("./guarded-ui-automerge.mjs");
  const newPolicy="2026-10-27T15:45:00Z";
  const originalEpoch=policyEpochForLane("ui",newPolicy);
  assert.equal(originalEpoch,"2026-10-27T00:21:29Z");
  assert.equal(policyEpochForLane("scoped-application",newPolicy),newPolicy);
  assert.equal(policyEpochForLane("pinned-pap1089",newPolicy),"1970-01-01T00:00:00Z");
  const pr={state:"open",draft:false,created_at:"2026-10-27T15:06:31Z",
    base:{ref:"main"},head:{repo:{full_name:"vmtct/pino-team-os"}},
    user:{login:"vmtct"},labels:[],requested_reviewers:[],requested_teams:[],
    mergeable_state:"clean"};
  assert.equal(assessPR(pr,policyEpochForLane("pinned-pap1089",newPolicy)),null);
  assert.match(assessPR(pr,policyEpochForLane("scoped-application",newPolicy)),/pre-existing/);
});

test("PAP-1091 CI-completed admission only trusts same-repo exact PR Validation",async()=>{
 const {verifiedGreenPRRun,pendingGithubMergeStatus}=await import("./guarded-ui-automerge.mjs");
 const run={event:"pull_request",conclusion:"success",path:".github/workflows/pr-validation.yml",
   head_repository:{full_name:"vmtct/pino-team-os"},head_sha:"a".repeat(40)};
 assert.equal(verifiedGreenPRRun(run,"vmtct/pino-team-os"),true);
 for(const mutated of [
  {...run,event:"push"},{...run,conclusion:"failure"},
  {...run,path:".github/workflows/untrusted.yml"},
  {...run,head_repository:{full_name:"evil/fork"}},{...run,head_sha:"broken"},
 ]) assert.equal(verifiedGreenPRRun(mutated,"vmtct/pino-team-os"),false);
 assert.equal(pendingGithubMergeStatus({errors:[{type:"UNPROCESSABLE",message:"Pull request is in unstable status"}]}),true);
 assert.equal(pendingGithubMergeStatus({errors:[{type:"FORBIDDEN",message:"Permission denied"}]}),false);
 assert.equal(pendingGithubMergeStatus({errors:[{type:"UNPROCESSABLE",message:"Branch protection failed"}]}),false);
 assert.equal(pendingGithubMergeStatus({data:{enablePullRequestAutoMerge:{pullRequest:{autoMergeRequest:{}}}}}),false);
});

test("PAP-1091 already enabled native auto-merge is idempotent, but real holds revoke",async()=>{
 const {assessPR}=await import("./guarded-ui-automerge.mjs");
 const pr={state:"open",draft:false,created_at:"2026-10-27T15:06:31Z",
   base:{ref:"main"},head:{repo:{full_name:"vmtct/pino-team-os"}},
   user:{login:"vmtct"},auto_merge:{enabled_by:{login:"github-actions[bot]"}},
   labels:[],requested_reviewers:[],requested_teams:[],mergeable_state:"blocked"};
 const epoch="2026-10-27T00:21:29Z";
 assert.equal(assessPR(pr,epoch),null,"enabled auto merge must not be classified as HOLD");
 assert.match(assessPR({...pr,labels:[{name:"merge-hold"}]},epoch),/hold/);
 assert.match(assessPR({...pr,draft:true},epoch),/draft/);
});
