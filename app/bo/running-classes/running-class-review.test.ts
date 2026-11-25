import test from "node:test";
import assert from "node:assert/strict";
import {createRunningClassReview} from "./running-class-review";
import {validateClassDraft} from "./running-class-draft";
test("isolated seed plus newly created record, versioned readback, no persisted shared state",()=>{
 const review=createRunningClassReview();const seed=review.find(review.fixtureId)!;
 assert.equal(review.list().length,1);
 const validated=validateClassDraft({...seed,operationalName:"New piano"},review.catalog);assert.equal(validated.ok,true);if(!validated.ok)return;
 const created=review.create(validated.value);assert.notEqual(created.id,seed.id);assert.equal(created.status,"INACTIVE");assert.equal(review.list().length,2);
 const edited=review.edit({id:created.id,expectedVersion:1,changes:{operationalName:"Updated"},effectiveFromLocalDate:null});
 assert.equal(edited.name,"Updated");assert.equal(review.properties(created.id).operationalName,"Updated");
 assert.throws(()=>review.edit({id:created.id,expectedVersion:1,changes:{operationalName:"Stale"},effectiveFromLocalDate:null}));
 assert.equal(createRunningClassReview().list().length,1);
});
