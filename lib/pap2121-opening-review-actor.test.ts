import {test} from "node:test";
import assert from "node:assert/strict";
import {parseEvidenceDetail,parseEvidenceRow} from "./bo-opening-evidence-api";
import {parseClassOpening} from "./tos-class-opening-client";
import {parseReceptionHistory} from "./tos-reception-ready-client";
import {openingReviewActorLabel,recordedReviewAccountLabel} from "./opening-review-actor-label";
const id=(n:number)=>"00000000-0000-7000-8000-"+String(n).padStart(12,"0");
const at="2026-11-14T01:00:00.000Z",scope={centerId:id(1),runningClassId:id(2),localDate:"2026-11-14"};
const first={eventId:id(4),roundId:id(4),version:1,kind:"SUBMISSION",actorLegalFullName:null,occurredAt:at,privateAssetId:id(5),privateAssetIds:[id(5)],note:"",verdict:null,reason:null};
const review={eventId:id(6),roundId:id(4),version:2,kind:"REVIEW",actorLegalFullName:null,reviewAccountRecorded:true,occurredAt:at,privateAssetId:null,privateAssetIds:[],note:"",verdict:"APPROVED",reason:""};
const row={subjectType:"CLASS",openingReceiptId:id(3),centerId:scope.centerId,workDate:scope.localDate,subjectLabel:"Art",openedAt:at,submittedByLegalFullName:null,status:"APPROVED",latestRoundId:first.roundId,version:2,lastModifiedAt:at,lastModifiedByLegalFullName:null,lastModifiedReviewAccountRecorded:true,canReview:false};
const detail={row,history:[first,review]};
const snapshot={...scope,state:"OPENED",receipt:{kind:"CLASS_FIRST_OPENED",source:"DELIVERY_COMMITTED_OPEN",receiptId:id(3),...scope,occurrenceKey:scope.runningClassId+":"+scope.localDate,openedAt:at},canConfirm:false,canAppend:true,openedByLegalFullName:null,history:[first,review]};
void test("PAP-2121 BO recorded account readback is additive and matches history",()=>{
 assert.equal(parseEvidenceDetail(structuredClone(detail),scope.centerId,"CLASS",id(3)).row.lastModifiedReviewAccountRecorded,true);
 assert.throws(()=>parseEvidenceRow({...row,version:1},scope.centerId),/không hợp lệ/);
 assert.throws(()=>parseEvidenceDetail({...detail,history:[first,{...review,reviewAccountRecorded:undefined}]},scope.centerId,"CLASS",id(3)),/khớp/);
 assert.throws(()=>parseEvidenceDetail({...detail,history:[first,{...review,actorLegalFullName:"Verified"}]},scope.centerId,"CLASS",id(3)),/không hợp lệ/);
});
void test("PAP-2121 Class and Reception accept recorded account only for review without verified name",()=>{
 assert.equal(parseClassOpening(snapshot,scope).opening?.rounds?.[0]?.reviewedBy,recordedReviewAccountLabel);
 assert.equal(parseClassOpening({...snapshot,history:[first,{...review,reviewAccountRecorded:undefined}]},scope).opening?.rounds?.[0]?.reviewedBy,"—");
 assert.equal(parseReceptionHistory([first,review])[1]?.reviewAccountRecorded,true);
 for(const bad of [[{...first,reviewAccountRecorded:true},review],[first,{...review,reviewAccountRecorded:false}],[first,{...review,actorLegalFullName:"Verified"}]]){
  assert.throws(()=>parseClassOpening({...snapshot,history:bad},scope),/không hợp lệ/);
  assert.throws(()=>parseReceptionHistory(bad),/không hợp lệ/);
 }
 assert.equal(openingReviewActorLabel("Verified"),"Verified");
 assert.equal(openingReviewActorLabel(null,true),recordedReviewAccountLabel);
 assert.equal(openingReviewActorLabel(null),"—");
});
