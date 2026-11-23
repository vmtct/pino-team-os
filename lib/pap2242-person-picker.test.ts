import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {availableParticipationPeople,type ParticipationPersonOption} from "../app/components/mytime-workshop/ParticipationPersonOptions";

const source=readFileSync(new URL("../app/components/mytime-workshop/ParticipationPersonPicker.tsx",import.meta.url),"utf8");
const tab=readFileSync(new URL("../app/components/mytime-workshop/WorkshopParticipationTab.tsx",import.meta.url),"utf8");
const review=readFileSync(new URL("../app/bo-m1-participation-review/review.tsx",import.meta.url),"utf8");

const people:ParticipationPersonOption[]=[
  {personId:"p1",fullName:"Preview Person 01",age:8,phoneLast4:"0001"},
  {personId:"p2",fullName:"Preview Person 02",age:9,phoneLast4:"0002"},
  {personId:"p3",fullName:"Preview Person 03",age:10,phoneLast4:"0003"},
  {personId:"p4",fullName:"Preview Person 04",age:11,phoneLast4:"0004"},
  {personId:"p5",fullName:"Preview Person 05",age:12,phoneLast4:"0005"},
];

test("PAP-2242 Person picker is one DSA search combobox with a dropdown",()=>{
  assert.equal((source.match(/<input\b/g)||[]).length,1);
  assert.ok(!source.includes("<select"));
  assert.ok(source.includes('role="combobox"'));
  assert.ok(source.includes('role="listbox"'));
  assert.ok(source.includes('role="option"'));
  assert.ok(source.includes('placeholder="Nhập để tìm kiếm người"'));
  assert.ok(source.includes("aria-expanded={open"));
  assert.ok(!source.includes("fetch("));
});

test("PAP-2242 excludes existing Workshop participants and shows at most three Person choices",()=>{
  const candidates=availableParticipationPeople(people,["p2"]);
  assert.deepEqual(candidates.map(person=>person.personId),["p1","p3","p4"]);
  assert.deepEqual(availableParticipationPeople(people,[],"person 05").map(person=>person.personId),["p5"]);
  assert.deepEqual(availableParticipationPeople(people,[],"not found"),[]);
  assert.ok(tab.includes("rows.flatMap(row=>row.personId"));
});

test("PAP-2242 three preview options stay local and are marked synthetic",()=>{
  assert.ok(review.includes("sampleParticipationPeople"));
  assert.ok(review.includes("synthetic"));
  assert.ok(review.includes("personCandidates={sampleParticipationPeople}"));
  assert.ok(tab.includes("people={personCandidates}"));
});
