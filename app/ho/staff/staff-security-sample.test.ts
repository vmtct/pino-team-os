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

import {linkedSecuritySample} from "./staff-security-sample";
import type {Snapshot} from "./staff-access-presentation-model";
test("PAP-2430 shared hypothetical account gates Security on employment and account status",()=>{
 const s:Snapshot={staffId:"STAFF-MOCK-001",accountId:"M1-HYPOTHETICAL-ACCOUNT:STAFF-MOCK-001",accountStatus:"active",employment:"active",revision:2,affiliationIds:[],assignments:[]};
 const ready=linkedSecuritySample(s,"absent");assert.equal(sampleAction(ready),"initial");assert.equal(sampleAction(linkedSecuritySample(s,"present")),"reset");
 for(const bad of [{...s,accountStatus:"inactive" as const},{...s,employment:"inactive" as const},{...s,accountId:null},{...s,accountId:"foreign"},{...s,accountStatus:"unknown" as const}])assert.equal(sampleAction(linkedSecuritySample(bad,"absent")),"none");
 assert.equal(sampleAction(linkedSecuritySample(s,"unknown")),"none");assert.equal(simulateInitialEnrollment(linkedSecuritySample({...s,revision:3},"absent"),ready),null);
 assert.equal(simulateInitialEnrollment(ready,ready)?.scenario,"present");
 assert.equal(sampleAction(linkedSecuritySample({...s,accountStatus:"inactive"},"present")),"none");
 assert.equal(sampleAction(linkedSecuritySample({...s,revision:4},"present")),"reset");
});

test("PAP-2430 existing password does not imply first-change presentation metadata",()=>{
 const s:Snapshot={staffId:"STAFF-MOCK-001",accountId:"M1-HYPOTHETICAL-ACCOUNT:STAFF-MOCK-001",accountStatus:"active",employment:"active",revision:2,affiliationIds:[],assignments:[]};
 assert.equal(linkedSecuritySample(s,"present").firstChangeRequired,false);
 assert.equal(linkedSecuritySample(s,"present",true).firstChangeRequired,true);
 assert.equal(linkedSecuritySample(s,"unknown",true).firstChangeRequired,false);
 assert.equal(linkedSecuritySample({...s,accountStatus:"inactive"},"present",true).firstChangeRequired,false);
 assert.equal(sampleAction(linkedSecuritySample(s,"present")),"reset");
});
