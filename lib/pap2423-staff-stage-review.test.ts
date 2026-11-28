import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseStaffStageReview,staffStageReviewEnabled,staffStageReviewUrl,staffStageQuery,staffHoStageSearch} from "../app/ho/staff/staff-stage-review-route";
const ho="https://ho.staging.pinohouse.art/ho/staff",bo="https://bo.staging.pinohouse.art/bo/workforce/staffs",center="12345678-1234-4abc-8abc-123456789abc",env={APP_ENV:"staging",BO_UI_ONLY:"enabled",STAFF_M1_REVIEW:"enabled"};
test("PAP-2423 review is explicitly staging-only, surface and deployment flagged",()=>{
 assert.equal(staffStageReviewEnabled(env,"HO","ho.staging.pinohouse.art"),true);
 assert.equal(staffStageReviewEnabled(env,"BO","bo.staging.pinohouse.art"),true);
 for(const e of [{},{...env,APP_ENV:"production"},{...env,STAFF_M1_REVIEW:"disabled"}])assert.equal(staffStageReviewEnabled(e,"HO","ho.staging.pinohouse.art"),false);
 assert.equal(staffStageReviewEnabled({...env,BO_UI_ONLY:"disabled"},"BO","bo.staging.pinohouse.art"),false);
 assert.equal(staffStageReviewEnabled(env,"HO","bo.staging.pinohouse.art"),false);
});
test("PAP-2423 HO pinned review grammar and stable query",()=>{
 for(const tab of ["overview","access","staff-rate","history"]){
  const search=staffHoStageSearch({kind:"detail",recordId:"STAFF-MOCK-001",tab});
  assert.deepEqual(parseStaffStageReview(new URL(ho+search)),{surface:"HO",state:{kind:"detail",recordId:"STAFF-MOCK-001",tab}});
 }
 for(const q of ["","?staffReview=0","?staffReview=1&record="+center,"?staffReview=1&record=STAFF-MOCK-002","?staffReview=1&staffReview=1","?staffReview=1&centerId="+center,"?staffReview=1&tab=access","?staffReview=1#fragment"])assert.equal(parseStaffStageReview(new URL(ho+q)),null,q);
 assert.equal(staffStageReviewUrl("HO",staffStageQuery({staffReview:["1","1"]})),null);
});
test("PAP-2411 BO review requires exact scoped fixture, no live identity or implicit Center",()=>{
 assert.deepEqual(parseStaffStageReview(new URL(bo+"?staffReview=1")),{surface:"BO",centerId:null,view:"all",recordId:null,kind:"table"});
 const prefix=bo+"?staffReview=1&centerId="+center;
 assert.deepEqual(parseStaffStageReview(new URL(prefix+"&record=STAFF-DIRECTORY-MOCK-001&surface=detail")),{surface:"BO",centerId:center,view:"all",recordId:"STAFF-DIRECTORY-MOCK-001",kind:"detail"});
 for(const q of ["?staffReview=1&view=register","?staffReview=1&centerId=STAFF-MOCK-CENTER","?staffReview=1&record=STAFF-DIRECTORY-MOCK-001","?staffReview=1&centerId="+center+"&record="+center,"?staffReview=1&centerId="+center+"&surface=detail","?staffReview=1&centerId="+center+"&record=STAFF-DIRECTORY-MOCK-001&view=register","?staffReview=1&centerId="+center+"&centerId="+center])assert.equal(parseStaffStageReview(new URL(bo+q)),null,q);
 assert.equal(parseStaffStageReview(new URL(bo.replace("https:","http:")+"?staffReview=1")),null);
});
test("PAP-2423 existing server authorization and scoped GET proof; no real row result or command transport",()=>{
 const server=readFileSync("app/ho/staff/staff-stage-review-admission.server.ts","utf8");
 assert.match(server,/authorizeHoShell\(headers,env\)/);
 assert.match(server,/authorizeBoShell\(headers,env\)/);
 assert.match(server,/workforce\/staff-records/);assert.match(server,/workforce\/staff-registration-requests/);
 assert.match(server,/current\.userId===actor\.userId/);assert.match(server,/currentChoices\.source===choices\.source/);
 assert.doesNotMatch(server,/method:\s*"(POST|PUT|PATCH|DELETE)"|return\s+body/);
});

import {invalidStaffPhaseOneRequest} from "../app/ho/staff/staff-phase-one-route";
import {safeHoReturnTo} from "./ho-routes";
import {safeBoStagingReturnTo} from "./bo-staging-return-to";
test("PAP-2423 narrow pre-stream and safe post-login navigation; live grammar remains unchanged",()=>{
 const path="/ho/staff",q="staffReview=1&record=STAFF-MOCK-001&surface=detail&tab=access";
 assert.equal(invalidStaffPhaseOneRequest("ho.staging.pinohouse.art",path,"GET",new URLSearchParams(q),null),false);
 assert.equal(invalidStaffPhaseOneRequest("ho.staging.pinohouse.art",path,"GET",new URLSearchParams(q+"&_rsc=next"),"1"),false);
 assert.equal(safeHoReturnTo(path+"?"+q),path+"?"+q);
 for(const invalid of [q+"&record=STAFF-MOCK-001",q+"&redirect=evil",q.replace("STAFF-MOCK-001",center),q.replace("staffReview=1","staffReview=0")]){
  assert.equal(invalidStaffPhaseOneRequest("ho.staging.pinohouse.art",path,"GET",new URLSearchParams(invalid),null),true);assert.equal(safeHoReturnTo(path+"?"+invalid),null);
 }
 const boPath="/bo/workforce/staffs",bq="staffReview=1&centerId="+center+"&record=STAFF-DIRECTORY-MOCK-001&surface=detail";
 assert.equal(safeBoStagingReturnTo(boPath+"?"+bq),boPath+"?"+bq);
 assert.equal(safeBoStagingReturnTo(boPath+"?"+bq+"&centerId="+center),null);
 assert.equal(safeBoStagingReturnTo(boPath+"?"+bq.replace("STAFF-DIRECTORY-MOCK-001",center)),null);
 assert.equal(safeBoStagingReturnTo("/bo?module=staffs&staffReview=1"),null);
 assert.equal(safeHoReturnTo(path+"?record=0198d050-56c1-7ac5-b9ab-b0e45d912345"),path+"?record=0198d050-56c1-7ac5-b9ab-b0e45d912345");
 const vars=JSON.parse(readFileSync("wrangler.ho-staging.json","utf8")).vars;assert.equal(vars.APP_ENV,"staging");assert.equal(vars.STAFF_M1_REVIEW,"enabled");
});
