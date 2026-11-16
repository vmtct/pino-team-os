import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dressingReadUrl,parseDressingProjection} from "./pinoria-tv-dressing-read";
const centerId="019b1126-0001-7000-8000-000000000001";
const visitId="019b1126-0001-7000-8000-000000000002";
const scope={centerId,visitId,policyRef:"tvp2-house-ambient-"+centerId};
const item=(i:number)=>({itemId:"019b1126-0001-7000-8000-00000000000"+i,displayName:"Hat "+i,image:{mimeType:"image/png",bytesBase64:"AA=="}});
const wrap=(items:unknown[],extra={})=>({data:{...scope,items,...extra}});
test("PAP-2041 exact logical Center/Visit URL, no self or item input",()=>{
 const url=dressingReadUrl(scope);assert.ok(url);
 assert.equal(new URL(url,"https://example.test").pathname,"/api/tos-learning/pinoria/tv-policies/house-ambient/dressing");
 assert.deepEqual(Object.fromEntries(new URL(url,"https://example.test").searchParams),scope);
 assert.equal(dressingReadUrl({...scope,policyRef:"tvp1-default"}),null);
 assert.equal(dressingReadUrl({...scope,visitId:"fake"}),null);
});
test("accepts 0,1,2,3 distinct display items, including empty",()=>{
 for(let n=0;n<=3;n++){const items=Array.from({length:n},(_,i)=>item(i+3));assert.deepEqual(parseDressingProjection(wrap(items),scope),items);}
});
test("fails closed on foreign response, over-limit, duplicates, extra/private fields, bad media",()=>{
 for(const payload of [
  wrap([item(3)],{centerId:visitId}),wrap([item(3)],{visitId:centerId}),wrap([item(3)],{policyRef:"tvp1-default"}),
  wrap([item(3),item(4),item(5),item(6)]),wrap([item(3),item(3)]),
  wrap([{...item(3),price:10}]),wrap([{...item(3),image:{...item(3).image,assetKey:"private"}}]),
  wrap([{...item(3),image:{mimeType:"image/svg+xml",bytesBase64:"AA=="}}]),
  wrap([{...item(3),image:{mimeType:"image/png",bytesBase64:"<script>"}}]),
  wrap([{...item(3),displayName:" "}]),wrap([], {balance:5}),{data:null},
 ]) assert.equal(parseDressingProjection(payload,scope),null);
});
test("mount tied to the matching learner Arrival only, no write or old Quick Choice route",()=>{
 const source=readFileSync("app/pinoria-tv/reception-tv.tsx","utf8");
 const scene=readFileSync("app/pinoria-tv/dressing-avatar-scene.tsx","utf8");
 assert.match(source,/scene\.actorType === "LEARNER" && scene\.sourceType === "STUDENT_VISIT"/);
 assert.match(source,/staffPolicyRef && connected && !revoked && sceneIsCurrent/);
 assert.match(source,/controller\.abort\(\)/);
 assert.match(source,/dressingReady\.current\?\.key === dressingKey \? "dressing" : "handoff"/);
 assert.match(source,/scene\?\.phase === "dressing" && dressingKey && dressing\?\.key === dressingKey/);
 assert.match(scene,/Nay \{name\} mặc gì đi học\?/);
 assert.doesNotMatch(scene,/fetch\(|onClick|button|localStorage|price|balance/i);
});
