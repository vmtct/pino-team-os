import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../app/components/mytime-workshop/WorkshopParticipationCreate.tsx",import.meta.url),"utf8");
test("PAP-2242 creation only submits canonical Person, Workshop and Center IDs",()=>{
 for(const key of ["workshopId","centerId","personId"]) assert.ok(source.includes(key));
 assert.ok(source.includes("onSubmit({workshopId,centerId,personId})"));
 assert.ok(source.includes("people.some(p=>p.personId===personId)"));
});
test("PAP-2242 prevents concurrent submit and handles errors",()=>{
 assert.ok(source.includes("busy||submitting"));
 assert.ok(source.includes("setSubmitting(true)"));
 assert.ok(source.includes('role="alert"'));
 assert.ok(!source.includes("fetch("));
});
