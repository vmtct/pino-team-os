import test from "node:test";
import assert from "node:assert/strict";
import {newActivationPreview,fixtureSubject,activateFixture} from "./staff-activation-preview";
import {activationRequest} from "./staff-activation-model";
import {commitStaffProfile,stopStaffEmployment} from "./staff-profile-local";
const id="STAFF-MOCK-001";
test("PAP-2423 local profile CAS permits contact fields and preserves access and audit",()=>{
 const s=newActivationPreview("test",true),r=s.records[0]!;
 const next=commitStaffProfile(s,id,r.activationRevision,"name","New sample")!;
 assert.ok(next);assert.equal(next.records[0]!.name,"New sample");
 assert.deepEqual(next.records[0]!.access,r.access);assert.equal(next.records[0]!.loginEmail,r.loginEmail);assert.equal(next.records[0]!.createdAt,r.createdAt);
 assert.equal(commitStaffProfile(next,id,r.activationRevision,"name","Stale"),null);
 for(const key of ["id","role","status","center","loginEmail","createdAt","accountState"])assert.equal(commitStaffProfile(s,id,r.activationRevision,key,"x"),null);
 assert.equal(commitStaffProfile(s,id,r.activationRevision,"email","real@example.com"),null);
 assert.equal(commitStaffProfile(s,id,r.activationRevision,"birthDate","2026-02-30"),null);
});

test("PAP-2423 employment stop requires current active fixture and confirmation, preserves separate account and scope",()=>{
 const s=newActivationPreview("test",true),subject=fixtureSubject(s,id)!;
 const active=activateFixture(s,activationRequest(subject)!).state;
 const r=active.records[0]!;
 assert.equal(stopStaffEmployment(active,id,r.activationRevision,false),null);
 assert.equal(stopStaffEmployment(active,"foreign",r.activationRevision,true),null);
 assert.equal(stopStaffEmployment(active,id,r.activationRevision-1,true),null);
 const stopped=stopStaffEmployment(active,id,r.activationRevision,true)!;
 const n=stopped.records[0]!;
 assert.equal(n.status,"Ng\u01b0ng");assert.deepEqual(n.access,r.access);assert.equal(n.accountState,r.accountState);assert.equal(n.loginEmail,r.loginEmail);assert.equal(n.createdAt,r.createdAt);
 assert.equal(stopStaffEmployment(stopped,id,n.activationRevision,true),null);
 const reactivated=activateFixture(stopped,activationRequest(fixtureSubject(stopped,id)!)!);
 assert.equal(reactivated.result.kind,"activated");
});
