import test from "node:test";
import assert from "node:assert/strict";
import {NextRequest} from "next/server";
import {middleware} from "../../../middleware";
import {decideHostBoundary} from "../../../lib/host-boundary";
import {enrollmentRelationLinks} from "./enrollment-read-client";
const host="bo.staging.pinohouse.art",prod="bo.pinohouse.art";
const id="019d2181-0000-7000-8000-000000000100",record="019d2181-0000-7000-8000-000000000200";
const req=(path:string,hostname=host,cookie=true,method="GET")=>middleware(new NextRequest("https://"+hostname+path,{method,headers:{host:hostname,...(cookie?{cookie:"pino_staff_password_session=fixture-only"}:{})}}));
test("PAP-2181 Enrollment is exact staging-only read page, unchanged Production Registration",()=>{
 assert.equal(decideHostBoundary(host,"/bo/enrollments").action,"next");
 for(const hostname of [prod,"tos.pinohouse.art","ho.staging.pinohouse.art",host+".evil.example"])assert.equal(decideHostBoundary(hostname,"/bo/enrollments").action,"not_found");
 assert.equal(decideHostBoundary(host,"/bo/enrollments","POST").action,"not_found");
 assert.equal(decideHostBoundary(host,"/bo/enrollments/"+record).action,"not_found");
 assert.equal(decideHostBoundary(prod,"/bo/registrations").action,"next");
 assert.equal(req("/bo/enrollments",host,false).headers.get("location"),"https://"+host+"/staff-login");
 assert.equal(req("/bo/enrollments?centerId="+id).headers.get("x-middleware-next"),"1");
});
test("PAP-2181 old Registration never conflates identities, legacy Enrollment preserves authorized-scope hints only",()=>{
 let r=req("/bo/registrations?centerId="+id+"&record="+record+"&sessionId="+record);
 assert.equal(r.status,307);assert.equal(r.headers.get("location"),"https://"+host+"/bo/enrollments?centerId="+id);
 r=req("/bo?module=enrollments&centerId="+id+"&record="+record);
 assert.equal(r.headers.get("location"),"https://"+host+"/bo/enrollments?centerId="+id+"&record="+record);
 assert.equal(req("/bo/registrations?centerId=bad").status,400);
 assert.equal(req("/bo/registrations?centerId="+id+"&centerId="+record).status,400);
 assert.equal(req("/bo/registrations",prod).headers.get("x-middleware-next"),"1");
 for(const link of enrollmentRelationLinks({studentId:record,subscriptionId:record,runningClassId:record},id)){
  const url=new URL(link.href,"https://"+host);assert.equal(url.pathname,"/bo");assert.equal(url.searchParams.get("centerId"),id);assert.equal(url.searchParams.get("record"),record);
 }
});
