import test from "node:test";
import assert from "node:assert/strict";
import {createRunningClassReview} from "./running-class-review";
import {validateClassDraft} from "./running-class-draft";
test("isolated seed plus newly created record, versioned readback, no persisted shared state",()=>{
 const review=createRunningClassReview();const seed=review.find(review.fixtureId)!;
 assert.equal(review.list().length,1);
 const validated=validateClassDraft({...seed,operationalName:"New piano"},review.catalog);assert.equal(validated.ok,true);if(!validated.ok)return;
 const created=review.create(validated.value);assert.notEqual(created.id,seed.id);assert.equal(created.status,"INACTIVE");assert.equal(review.list().length,2);
 const edited=review.edit({id:created.id,expectedVersion:1,changes:{operationalName:"Updated"}});
 assert.equal(edited.name,"Updated");assert.equal(review.properties(created.id).operationalName,"Updated");
 assert.throws(()=>review.edit({id:created.id,expectedVersion:1,changes:{operationalName:"Stale"}}));
 assert.equal(createRunningClassReview().list().length,1);
});
test("inline Path Space status and nullable capacity edit readback with CAS",()=>{const review=createRunningClassReview(),id=review.fixtureId;const updates=[{pathProgramId:"RC-MOCK-PATH-ART"},{learningSpaceId:"RC-MOCK-ROOM-ART"},{status:"ACTIVE"},{hardConcurrentCapacity:null}];updates.forEach((changes,i)=>review.edit({id,expectedVersion:i+1,changes}));assert.equal(review.find(id)?.version,5);assert.equal(review.find(id)?.status,"ACTIVE");assert.equal(review.find(id)?.hardConcurrentCapacity,null);assert.equal(review.properties(id).pathProgramId,"Mỹ thuật sáng tạo");assert.equal(review.properties(id).learningSpaceId,"Art Studio");assert.throws(()=>review.edit({id,expectedVersion:5,changes:{learningSpaceId:"foreign"}}));assert.equal(review.find(id)?.version,5);});
