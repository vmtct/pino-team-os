import test from "node:test";
import assert from "node:assert/strict";
import {diaryUiReceipt,canCreateDiary,canRetryDiary} from "./tos-diary-ui-receipt";
import type {ObservationOutcome} from "./tos-diary-observation-workflow";

const linkPlan={diaryId:"diary-1",centerId:"center-1",submissionKey:"submit-1",selected:[{missionId:"mission-1"}]};
const observationPlan={...linkPlan,studentId:"student-1",pathKey:"path-1",teachingContextKey:"class-1:2026-11-02",expectedVersion:1,
 observation:{interest:3,notes:"Đã quan sát.",difficulty:null}};

test("PAP-945 no source receipt permits only future admitted initial submission",()=>{
 assert.equal(diaryUiReceipt(null),null);
 assert.equal(canCreateDiary(null,true),true);
 assert.equal(canCreateDiary(null,false),false);
 assert.equal(canRetryDiary(null,true),false);
});
test("PAP-945 ambiguous Register fences any new Register without a known diaryId",()=>{
 const r:ObservationOutcome={state:"REGISTER_UNCERTAIN",diaryId:null,submissionKey:"submit-1",errorCode:"TIMEOUT",errorMessage:"No ack"};
 const view=diaryUiReceipt(r);assert.equal(view?.diaryId,null);
 assert.equal(view?.canRetry,false);assert.equal(view?.severity,"warning");
 assert.equal(canCreateDiary(r,true),false);assert.equal(canRetryDiary(r,true),false);
 assert.match(view?.message??"",/đối soát|Đối soát/);
});
test("PAP-945 uncertain observation preserves Diary ID and only allows deliberate retry",()=>{
 const r:ObservationOutcome={state:"OBSERVATION_PENDING",plan:observationPlan,errorCode:"DRAFT_FAILED",errorMessage:"draft unverified"};
 const view=diaryUiReceipt(r);
 assert.equal(view?.diaryId,"diary-1");assert.equal(view?.canRetry,true);
 assert.equal(canCreateDiary(r,true),false);assert.equal(canRetryDiary(r,true),true);
 assert.equal(canRetryDiary(r,false),false);
});
test("PAP-945 Mission link failure must remain LINK_PENDING and never re-register",()=>{
 const r:ObservationOutcome={state:"LINK_PENDING",plan:linkPlan,verifiedMissionIds:[],pendingMissionIds:["mission-1"],errorCode:"LINK_FAIL",errorMessage:"not linked"};
 const view=diaryUiReceipt(r);
 assert.equal(view?.state,"LINK_PENDING");assert.equal(view?.diaryId,"diary-1");
 assert.equal(view?.canRetry,true);assert.deepEqual(view?.pendingMissionIds,["mission-1"]);
 assert.equal(canCreateDiary(r,true),false);assert.equal(canRetryDiary(r,true),true);
});
test("PAP-945 confirmed link state is readback verified, not retryable",()=>{
 const r:ObservationOutcome={state:"LINK_VERIFIED",plan:linkPlan,verifiedMissionIds:["mission-1"],pendingMissionIds:[]};
 const view=diaryUiReceipt(r);
 assert.equal(view?.severity,"success");assert.equal(view?.canRetry,false);
 assert.equal(canCreateDiary(r,true),false);assert.equal(canRetryDiary(r,true),false);
});
