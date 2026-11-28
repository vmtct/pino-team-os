import test from "node:test";
import assert from "node:assert/strict";
import {newActivationPreview} from "./staff-activation-preview";
import {commitStaffProfile} from "./staff-profile-local";
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
