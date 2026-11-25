import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canonicalParentRoute,PARENT_ROUTE } from "../app/bo/parents/parent-route";
const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const record="01a1ef9f-d253-7e6b-ba2d-200887c4486f";
test("PAP-2389 canonical and legacy Parent links preserve valid Center and record",()=>{
  assert.equal(canonicalParentRoute({}),PARENT_ROUTE);
  assert.equal(canonicalParentRoute({module:"parents"},true),PARENT_ROUTE);
  const expected=PARENT_ROUTE+"?centerId="+center+"&record="+record;
  assert.equal(canonicalParentRoute({record,centerId:center}),expected);
  assert.equal(canonicalParentRoute({module:"parents",record,centerId:center,utm_source:"chatgpt.com",pilot:"tdd"},true),expected);
});
test("PAP-2389 ambiguous and unrelated Parent state fail closed",()=>{
  for(const q of [{record:[record,record]},{centerId:"bad"},{record:"../x"},{module:"parents"},{redirect:"/ho"},{record:""},{tab:"history"}]) assert.equal(canonicalParentRoute(q),null);
  for(const q of [{module:["parents","parents"]},{module:"students"},{module:"parents",pilot:"unknown"},{module:"parents",record:[record,record]}]) assert.equal(canonicalParentRoute(q,true),null);
});
test("PAP-2389 direct page uses existing native Parent runtime and staging fence",()=>{
  const page=readFileSync("app/bo/parents/page.tsx","utf8");
  assert.match(page,/boSkeletonEnabled\(env,host\)/);
  assert.match(page,/canonicalParentRoute\(query\)/);
  assert.match(page,/BoRuntimeEntry moduleKey="parents"/);
});
