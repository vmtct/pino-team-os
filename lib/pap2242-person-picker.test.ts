import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../app/components/mytime-workshop/ParticipationPersonPicker.tsx",import.meta.url),"utf8");
test("PAP-2242 Person picker receives canonical identities from host",()=>{
  assert.ok(source.includes("people: readonly ParticipationPersonOption[]"));
  assert.ok(source.includes("personId: string"));
  assert.ok(source.includes("phoneLast4: string | null"));
  assert.ok(source.includes("onSelect: (personId:string)=>void"));
  assert.ok(!source.includes("fetch("));
});
test("PAP-2242 picker shows name age last four and avoids full phone",()=>{
  assert.ok(source.includes("person.fullName"));
  assert.ok(source.includes("person.age"));
  assert.ok(source.includes("person.phoneLast4"));
  assert.ok(source.includes("^[0-9]{4}$"));
});
