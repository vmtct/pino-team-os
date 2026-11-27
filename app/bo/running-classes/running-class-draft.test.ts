import test from "node:test";
import assert from "node:assert/strict";
import {initialClassDraft, changeClassCenter, eligibleClassSpaces, validateClassDraft, type ClassCatalog, type ClassDraft} from "./running-class-draft";
const catalog: ClassCatalog = {
 centers:[{id:"c1",status:"ACTIVE",displayName:"Center 1"},{id:"c2",status:"ACTIVE",displayName:"Center 2"}],
 paths:[{id:"p1",status:"ACTIVE",displayName:"Path"},{id:"p2",status:"INACTIVE",displayName:"Retired"}],
 spaces:[{id:"s1",centerId:"c1",status:"ACTIVE",displayName:"Room 1"},{id:"s2",centerId:"c2",status:"ACTIVE",displayName:"Room 2"},{id:"s3",centerId:"c1",status:"INACTIVE",displayName:"Old room"}]
};
const valid: ClassDraft = {...initialClassDraft("c1"),operationalName:"  Piano  ",pathProgramId:"p1",learningSpaceId:"s1",weekdayIso:7,windowStartsLocal:"18:00",windowEndsLocal:"19:30",optimalConcurrentCapacity:8};
test("create is explicitly inactive, trims name, and defaults optional capacities and participation to null",()=>{
 const r=validateClassDraft(valid,catalog); assert.equal(r.ok,true); if(!r.ok) return;
 assert.equal(r.value.status,"INACTIVE"); assert.equal(r.value.operationalName,"Piano"); assert.equal(r.value.defaultParticipationMinutes,null);
 assert.equal(r.value.hardConcurrentCapacity,null);
});
test("center changes clear the space; only active same-center rooms are selectable",()=>{
 assert.equal(changeClassCenter(valid,"c2").learningSpaceId,""); assert.deepEqual(eligibleClassSpaces(catalog,"c1").map(s=>s.id),["s1"]);
 assert.equal(validateClassDraft({...valid,learningSpaceId:"s2"},catalog).ok,false);
 assert.equal(validateClassDraft({...valid,pathProgramId:"p2"},catalog).ok,false);
});
test("ISO weekday, time and capacity bounds reject invalid inputs",()=>{
 for(const patch of [{weekdayIso:0},{weekdayIso:8},{windowStartsLocal:"24:00"},{windowEndsLocal:"18:00"},{optimalConcurrentCapacity:0},{optimalConcurrentCapacity:1.5},{hardConcurrentCapacity:7},{operationalName:" ".repeat(10)},{operationalName:"x".repeat(201)}])
   assert.equal(validateClassDraft({...valid,...patch},catalog).ok,false,JSON.stringify(patch));
});
test("topology-specific participation duration",()=>{
 assert.equal(validateClassDraft({...valid,deliveryTopology:"FLEXIBLE_STUDIO"},catalog).ok,false);
 assert.equal(validateClassDraft({...valid,deliveryTopology:"FLEXIBLE_STUDIO",defaultParticipationMinutes:45},catalog).ok,true);
 assert.equal(validateClassDraft({...valid,deliveryTopology:"FLEXIBLE_STUDIO",defaultParticipationMinutes:91},catalog).ok,false);
 assert.equal(validateClassDraft({...valid,defaultParticipationMinutes:45},catalog).ok,false);
 assert.equal(validateClassDraft({...valid,deliveryTopology:"OVERLAPPING_COHORT",defaultParticipationMinutes:90},catalog).ok,true);
});
