import assert from "node:assert/strict";
import test from "node:test";
import {NextRequest} from "next/server";
import {middleware} from "../middleware";
import {safeBoStagingReturnTo} from "./bo-staging-return-to";
import {isBoStagingRouteAdmitted} from "../app/bo/architecture/bo-staging-route-policy";
const center="01912345-6789-7abc-8def-0123456789ab",q="?cameraReview=1&centerId="+center;
const bo="https://bo.staging.pinohouse.art",tos="https://tos.staging.pinohouse.art",path="/bo/workforce/timekeeping";
const headers={cookie:"pino_staff_password_session=fixture-only"};
test("PAP-1612 exact BO Timekeeping admission and return-to",()=>{
 assert.equal(isBoStagingRouteAdmitted(path),true);
 assert.equal(isBoStagingRouteAdmitted(path+"/extra"),false);
 assert.equal(safeBoStagingReturnTo(path+q),path+q);
 const anonymous=middleware(new NextRequest(bo+path+q));
 assert.equal(anonymous.status,307);
 assert.equal(new URL(anonymous.headers.get("location")!).searchParams.get("returnTo"),path+q);
 assert.equal(middleware(new NextRequest(bo+path+q,{headers})).headers.get("x-middleware-next"),"1");
});
test("PAP-1612 exact TOS review root retains login and ordinary redirect",()=>{
 assert.equal(new URL(middleware(new NextRequest(tos+"/")).headers.get("location")!).pathname,"/tos-v4");
 assert.equal(new URL(middleware(new NextRequest(tos+"/"+q)).headers.get("location")!).pathname,"/staff-login");
 assert.equal(middleware(new NextRequest(tos+"/"+q,{headers})).headers.get("x-middleware-next"),"1");
});
test("PAP-1612 invalid explicit review navigation never enters preview",()=>{
 for(const suffix of [q+"&cameraReview=1",q+"&actorId=x","?cameraReview=1&centerId=mock","?cameraReview=0&centerId="+center]){
  assert.equal(safeBoStagingReturnTo(path+suffix),null);
  assert.equal(middleware(new NextRequest(bo+path+suffix,{headers})).status,404);
  assert.equal(middleware(new NextRequest(tos+"/"+suffix,{headers})).status,404);
 }
 assert.equal(safeBoStagingReturnTo("/bo/parents"+q),null);
});
