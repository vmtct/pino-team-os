import assert from "node:assert/strict";
import test from "node:test";
import {readSyntheticReviewDecision} from "../src/synthetic-review-decision.mjs";
import {readFileSync} from "node:fs";
const origin = "https://app.staging.pinohouse.art";
const member = {runtime:true};
const deny = {allowed:false};
test("PAP-2377 private reviewer binding accepts only the exact returned program", async () => {
  const calls = [];
  const binding = {verify: async r => {calls.push(r); return {allowed:true,program:"house"};}};
  const request = new Request(origin+"/piner/house");
  assert.deepEqual(await readSyntheticReviewDecision(request,binding,member,"true"), {allowed:true,program:"house"});
  assert.equal(calls[0],request);
  assert.deepEqual(await readSyntheticReviewDecision(new Request(origin+"/piner/mytime"),binding,member,"true"),deny);
});
test("PAP-2377 default off and out-of-scope requests do not call Identity", async () => {
  let calls=0;
  const binding={verify:async()=>{calls++;return {allowed:true,program:"house"};}};
  for(const request of [new Request(origin+"/piner"),new Request(origin+"/piner/house/reels"),
    new Request("https://app.pinohouse.art/piner/house"),new Request(origin+"/piner/house",{method:"POST"}),
    new Request(origin+"/piner/house",{headers:{"sec-fetch-site":"cross-site"}}),
    new Request(origin+"/piner/house",{headers:{"sec-fetch-site":"same-site"}})]) {
    assert.deepEqual(await readSyntheticReviewDecision(request,binding,member,"true"),deny);
  }
  const request=new Request(origin+"/piner/house");
  assert.deepEqual(await readSyntheticReviewDecision(request,binding,member,undefined),deny);
  assert.deepEqual(await readSyntheticReviewDecision(request,binding,null,"true"),deny);
  assert.equal(calls,0);
});
test("PAP-2377 malformed or unavailable private proof fails closed",async()=>{
  const request=new Request(origin+"/piner/house");
  for(const result of [null,{}, {allowed:"true",program:"house"},
    {allowed:true,program:"house",principal:"unexpected"}, {allowed:false,program:"house"}]){
    assert.deepEqual(await readSyntheticReviewDecision(request,{verify:async()=>result},member,"true"),deny);
  }
  assert.deepEqual(await readSyntheticReviewDecision(request,{verify:async()=>{throw Error("unavailable");}},member,"true"),deny);
  assert.deepEqual(await readSyntheticReviewDecision(request,null,member,"true"),deny);
});
test("PAP-2377 named proof service is staging-only, absent enable flag",()=>{
  const staging=JSON.parse(readFileSync(new URL("../wrangler.staging.jsonc",import.meta.url),"utf8"));
  const prod=JSON.parse(readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8"));
  assert.deepEqual(staging.services.find(x=>x.binding==="PINER_SYNTHETIC_REVIEW"),{
    binding:"PINER_SYNTHETIC_REVIEW",service:"piner-space-staging",entrypoint:"PinerSyntheticReviewControlPlane"});
  assert.equal(prod.services?.some(x=>x.binding==="PINER_SYNTHETIC_REVIEW")??false,false);
  assert.notEqual(staging.vars?.PINER_SYNTHETIC_REVIEW_ENABLED,"true");
});
