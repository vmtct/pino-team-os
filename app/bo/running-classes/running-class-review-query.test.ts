import test from "node:test";
import assert from "node:assert/strict";
import {NextRequest} from "next/server";
import {middleware} from "../../../middleware";
import {safeBoStagingReturnTo} from "../../../lib/bo-staging-return-to";
import {parseRunningClassReviewQuery,RC_REVIEW_PATH} from "./running-class-review-query";
const host="bo.staging.pinohouse.art",center="01a208c1-8909-7aee-891b-109558e986f9",seed="RUNNING-CLASS-MOCK-001";
test("historical fixture parser stays isolated; live Staging never continues a mock link",()=>{
 const suffix="?centerId="+center+"&record="+seed;
 assert.equal(parseRunningClassReviewQuery(new URLSearchParams(suffix)),RC_REVIEW_PATH+suffix);
 assert.equal(parseRunningClassReviewQuery(new URLSearchParams("module=classes&centerId="+center+"&record="+seed),true),RC_REVIEW_PATH+suffix);
 assert.equal(safeBoStagingReturnTo("/bo?module=classes&centerId="+center+"&record="+seed),null);
 assert.equal(safeBoStagingReturnTo(RC_REVIEW_PATH+suffix),null);
 const anon=middleware(new NextRequest("https://"+host+RC_REVIEW_PATH+suffix));
 assert.equal(anon.status,307);assert.equal(new URL(anon.headers.get("location")!).searchParams.get("returnTo"),null);
 const auth=middleware(new NextRequest("https://"+host+RC_REVIEW_PATH+suffix,{headers:{cookie:"pino_staff_password_session=fixture-only"}}));
 assert.equal(auth.status,404);
});
test("fixture rejects real IDs; live accepts real UUID only and both reject malformed links",()=>{
 const q="record="+center;
 assert.equal(parseRunningClassReviewQuery(new URLSearchParams(q)),null);
 assert.equal(safeBoStagingReturnTo(RC_REVIEW_PATH+"?"+q),RC_REVIEW_PATH+"?"+q);
 assert.equal(middleware(new NextRequest("https://"+host+RC_REVIEW_PATH+"?"+q,{headers:{cookie:"pino_staff_password_session=fixture-only"}})).headers.get("x-middleware-next"),"1");
 for(const bad of ["record=RUNNING-CLASS-MOCK-002","record="+seed+"&record="+seed,"centerId=bad","centerId="+center+"&centerId="+center,"m1Preview=1","tab=history"]){
  assert.equal(parseRunningClassReviewQuery(new URLSearchParams(bad)),null,bad);
  assert.equal(safeBoStagingReturnTo(RC_REVIEW_PATH+"?"+bad),null,bad);
  assert.equal(middleware(new NextRequest("https://"+host+RC_REVIEW_PATH+"?"+bad,{headers:{cookie:"pino_staff_password_session=fixture-only"}})).status,404,bad);
 }
});
