import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handleBoWriteRequest, isAllowedPostPath, type BoWriteEnv } from "./bo-write-handler";
import type { BoAccessCoreBinding } from "./bo-core";

const student="01990000-0000-7000-8000-000000000001";
const companion="01990000-0000-7000-8000-000000000002";
const feed=`students/${student}/pinoria/companions/${companion}/feed`;

test("F4a facade allowlists only bounded Student Companion Feed",()=>{
  assert.equal(isAllowedPostPath(feed),true);
  assert.equal(isAllowedPostPath(`students/${student}/pinoria/companions/${companion}/ritual`),false);
  assert.equal(isAllowedPostPath(`students/${student}/pinoria/rewards/fruit/grant`),false);
});

test("F4a UI keeps replay key across retry and does not surface correction or lifecycle commands",async()=>{
  const [panel,api,handler]=await Promise.all([readFile(new URL("../app/bo/learners/StudentPinoriaPanel.tsx",import.meta.url),"utf8"),readFile(new URL("./bo-api.ts",import.meta.url),"utf8"),readFile(new URL("./bo-write-handler.ts",import.meta.url),"utf8")]);
  assert.match(panel,/retryKeys\.current\.get/);assert.match(panel,/feedLearnerCompanion/);
  assert.doesNotMatch(panel,/awardWaterSigil|grantFruit|executeCompanionRitual|createEgg/);
  assert.match(api,/feedLearnerCompanion/);assert.match(handler,/STUDENT_COMPANION_FEED_PATH\.test\(path\)[\s\S]*idempotencyKey/);
});


test("F4a Feed facade rejects non-empty bodies before Core",async()=>{
  let called=false;
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(){called=true;return{status:200,body:{data:{}},requestId:"unexpected"};}};
  const env:BoWriteEnv={PINO_BO_CORE:binding};
  const request=new Request(`https://bo.pinohouse.art/api/bo/${feed}`,{method:"POST",headers:{cookie:"pino_staff_password_session=pw", "content-type":"application/json","idempotency-key":"feed-1"},body:JSON.stringify({fruit:1})});
  const response=await handleBoWriteRequest(request,env,feed);
  assert.equal(response.status,400);assert.equal(called,false);
  assert.match(JSON.stringify(await response.json()),/Companion Feed request body must be empty/);
});

test("F4a Feed facade forwards the approved empty object",async()=>{
  let forwarded:unknown=null;
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){forwarded=request;return{status:200,body:{data:{ok:true}},requestId:"feed-ok"};}};
  const env:BoWriteEnv={PINO_BO_CORE:binding};
  const request=new Request(`https://bo.pinohouse.art/api/bo/${feed}`,{method:"POST",headers:{cookie:"pino_staff_password_session=pw", "content-type":"application/json","idempotency-key":"feed-2"},body:"{}"});
  const response=await handleBoWriteRequest(request,env,feed);
  assert.equal(response.status,200);assert.deepEqual(forwarded,{method:"POST",path:feed,body:{},idempotencyKey:"feed-2"});
});
