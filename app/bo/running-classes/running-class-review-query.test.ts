import test from "node:test";
import assert from "node:assert/strict";
import {NextRequest} from "next/server";
import {middleware} from "../../../middleware";
import {safeBoStagingReturnTo} from "../../../lib/bo-staging-return-to";
import {parseRunningClassReviewQuery,RC_REVIEW_PATH} from "./running-class-review-query";
const host="bo.staging.pinohouse.art",center="01a208c1-8909-7aee-891b-109558e986f9",seed="RUNNING-CLASS-MOCK-001";
test("exact canonical fixture path and safe legacy continuation",()=>{
 const suffix="?centerId="+center+"&record="+seed;
 assert.equal(parseRunningClassReviewQuery(new URLSearchParams(suffix)),RC_REVIEW_PATH+suffix);
 assert.equal(safeBoStagingReturnTo("/bo?module=classes&centerId="+center+"&record="+seed),RC_REVIEW_PATH+suffix);
 assert.equal(safeBoStagingReturnTo(RC_REVIEW_PATH+suffix),RC_REVIEW_PATH+suffix);
 const anon=middleware(new NextRequest("https://"+host+RC_REVIEW_PATH+suffix));
 assert.equal(anon.status,307);assert.equal(new URL(anon.headers.get("location")!).searchParams.get("returnTo"),RC_REVIEW_PATH+suffix);
});
test("reject real IDs, extra selectors, duplicate and malformed Center; never admit synthetic state via arbitrary route",()=>{
 for(const q of ["record="+center,"record=RUNNING-CLASS-MOCK-002","record="+seed+"&record="+seed,"centerId=bad","centerId="+center+"&centerId="+center,"m1Preview=1","tab=history"]){
  assert.equal(parseRunningClassReviewQuery(new URLSearchParams(q)),null,q);
  assert.equal(safeBoStagingReturnTo(RC_REVIEW_PATH+"?"+q),null,q);
  const res=middleware(new NextRequest("https://"+host+RC_REVIEW_PATH+"?"+q,{headers:{cookie:"pino_staff_password_session=fixture-only"}}));
  assert.equal(res.status,404,q);
 }
});
