import assert from "node:assert/strict";
import test from "node:test";
import {initialSecuritySample,sampleAction,sampleCases,simulateInitialEnrollment} from "./staff-security-sample";
test("PAP-2430 sample initial vs reset vs nonactionable states",()=>{
 for(const c of sampleCases){const s=initialSecuritySample(c);assert.equal(sampleAction(s),c==="absent"?"initial":c==="present"?"reset":"none");if(c!=="absent")assert.equal(simulateInitialEnrollment(s,s),null);}
});
test("PAP-2430 synthetic exact confirmation, no overwrite or secret",()=>{
 const s=initialSecuritySample("absent");
 for(const wrong of [{...s,staffId:"foreign"},{...s,accountId:"foreign"},{...s,revision:0}])assert.equal(simulateInitialEnrollment(s,wrong),null);
 const next=simulateInitialEnrollment(s,s);assert.ok(next);assert.equal(next.scenario,"present");assert.equal(next.firstChangeRequired,true);assert.equal(next.revision,2);assert.equal(simulateInitialEnrollment(next,s),null);assert.equal(simulateInitialEnrollment(next,next),null);assert.deepEqual(Object.keys(next).sort(),["accountId","firstChangeRequired","revision","scenario","staffId"]);
});
