import { strict as assert } from "node:assert";
import { test } from "node:test";
import { defaultPolicy, policyReadPath, safeDemoProjection, policyIssues } from "./pinoria-tv-policy-client";
import { readSafeTvPolicy, eligibleTvEvent, displayNameForSharedTv, redactTvPresentationName } from "./pinoria-tv-policy-runtime";
test("PAP-660 BO config read paths preserve DEFAULT/CENTER scopes and cannot leak identifiers", () => {
  assert.equal(policyReadPath("head",{kind:"DEFAULT"}),"/api/bo/pinoria/tv-config/policy/head?scope=DEFAULT");
  assert.ok(policyReadPath("head",{kind:"CENTER",centerId:"abc"}).includes("scope=CENTER&centerId=abc"));
  assert.throws(()=>policyReadPath("version",{kind:"DEFAULT"}),/Version ID required/);
});
test("PAP-660 safe demo does not show hidden PLS, Fruit, room, highlight", () => {
  const p=defaultPolicy();
  assert.deepEqual(safeDemoProjection(p,"DEPARTURE",new Date()).context,{
    name:"Piner Demo",path:"ART",companion:"MORI",
  });
  p.visibleContext.name=false;
  assert.equal("name" in safeDemoProjection(p,"DEPARTURE",new Date()).context,false);
  p.quietMode=true;
  assert.equal(safeDemoProjection(p,"QUICK_CHOICE",new Date()).allowed,false);
});
test("PAP-660 policy adapter rejects corrupt payload and retains privacy-safe fallback", () => {
  const p=defaultPolicy();
  assert.equal(readSafeTvPolicy({configuration:p,scope:"DEFAULT"},"centerA")?.visibleContext.pls,false);
  assert.equal(readSafeTvPolicy({configuration:p,scope:"CENTER:centerB"},"centerA"),null);
  assert.equal(readSafeTvPolicy({configuration:{...p,visibleContext:{...p.visibleContext,privatePhone:true}},scope:"DEFAULT"},"centerA"),null);
  assert.equal(readSafeTvPolicy({configuration:{...p,events:{...p.events,SECRET:{enabled:true,priority:99}}},scope:"DEFAULT"},"centerA"),null);
  assert.ok(policyIssues({...p,events:{...p.events,ARRIVAL:{...p.events.ARRIVAL,maxAgeSeconds:0}}}).length);
});
test("PAP-660 runtime gating expires and suppresses without suppressing domain truth", () => {
  const policy=defaultPolicy();
  const now=new Date("2026-10-20T12:00:00.000Z");
  assert.equal(eligibleTvEvent(policy,"ARRIVAL","2026-10-20T11:59:59.000Z",now),true);
  assert.equal(eligibleTvEvent(policy,"ARRIVAL","2026-10-20T11:57:59.000Z",now),false);
  assert.equal(eligibleTvEvent(policy,"ARRIVAL","2026-10-20T12:00:01.000Z",now),false);
  assert.equal(eligibleTvEvent(policy,"SECRET","2026-10-20T11:59:59.000Z",now),false);
  policy.quietMode=true;
  assert.equal(eligibleTvEvent(policy,"WISH_REVEAL","2026-10-20T11:59:59.000Z",now),false);
  assert.equal(eligibleTvEvent(policy,"DEPARTURE","2026-10-20T11:59:59.000Z",now),true);
  policy.visibleContext.name=false;
  assert.equal(displayNameForSharedTv(policy,"Private Student"),"Piner");
});

test("PAP-660 presentation name redaction does not mutate canonical Core projection", () => {
  const policy=defaultPolicy();
  const source={
    id:"test",kind:"WISH_REVEAL",claimedAt:"2026-10-20T12:00:00.000Z",
    projection:{subject:{studentProfileId:"id",displayName:"Private Learner",character:{id:"character",config:{}}}},
  };
  policy.visibleContext.name=false;
  const rendered=redactTvPresentationName(policy,source as never) as typeof source;
  assert.equal(rendered.projection.subject.displayName,"Piner");
  assert.equal(source.projection.subject.displayName,"Private Learner");
  assert.notEqual(rendered,source);
});
