import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {CAMERA_STAGE_HOST,CAMERA_STAGE_PATH,parseCameraStageReview} from "./pap1612-camera-stage-route";
const center="01912345-6789-7abc-8def-0123456789ab";
const env={APP_ENV:"staging",BO_CAMERA_M1_REVIEW:"enabled",TOS_CAMERA_M1_REVIEW:"enabled"};
for(const surface of ["BO","TOS"] as const){
 const base="https://"+CAMERA_STAGE_HOST[surface]+CAMERA_STAGE_PATH[surface];
 const query="?cameraReview=1&centerId="+center;
 test("PAP-1612 "+surface+" canonical exact explicit staging review",()=>{
  assert.deepEqual(parseCameraStageReview(surface,new URL(base+query),env),{surface,centerId:center});
  for(const disabled of [{},{...env,APP_ENV:"production"},{...env,BO_CAMERA_M1_REVIEW:undefined,TOS_CAMERA_M1_REVIEW:undefined}])assert.equal(parseCameraStageReview(surface,new URL(base+query),disabled),null);
 });
 test("PAP-1612 "+surface+" denies malformed or foreign review",()=>{
  for(const u of [base,base+"?cameraReview=1",base+query+"&centerId="+center,base+query+"&cameraReview=1",base+query+"&actorId=x",base+query+"#x",base+"?cameraReview=0&centerId="+center,base+"?cameraReview=1&centerId=mock",base.replace("https:","http:")+query,base.replace(".staging","")+query,"https://"+CAMERA_STAGE_HOST[surface]+"/tos-v4"+query])assert.equal(parseCameraStageReview(surface,new URL(u),env),null,u);
 });
}
test("PAP-1612 server proof uses only existing authenticated scoped reads",()=>{
 const s=readFileSync("lib/pap1612-camera-stage-admission.server.ts","utf8");
 for(const evidence of ["authorizeBoShell","staff.timekeeping.view","workforce/timekeeping/centers","authorizeTosV4Staging","/timekeeping/current","current.userId!==actor.userId","current.staffMemberId!==actor.staffMemberId","centerIncluded","credential.kind!==\"password\""])assert.ok(s.includes(evidence),evidence);
 assert.doesNotMatch(s,/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']|executeWithSupportSession/);
});
