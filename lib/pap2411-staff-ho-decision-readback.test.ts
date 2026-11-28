import test from "node:test";
import assert from "node:assert/strict";
import {createStaffDossierM1Fixture} from "../app/bo/workforce/staffs/staff-dossier-m1-fixture";
import {projectStaffHoDecision,type StaffHoDecisionReadback} from "../app/bo/workforce/staffs/staff-ho-decision-readback";
import {STAFF_DOSSIER_MOCK_ID as id} from "../app/bo/workforce/staffs/staff-registration-m1-service";
const setup=async()=>{const f=createStaffDossierM1Fixture(),bo=await f.dossierReview.submit!(id,1,f.dossierReview.centerId,"BO-review");const [row]=await f.dossierReview.list!();const approval={kind:"approved",receipt:{registrationRequestId:id,status:"APPROVED",reviewedVersion:1,personId:"HO-PERSON-MOCK-001",staffId:"HO-STAFF-MOCK-001",userId:"HO-USER-MOCK-001",roleId:"STAFF-MOCK-ROLE",scopeType:"CENTER",scopeId:bo.centerId,employmentStatus:"inactive",operationalReadiness:"unverified",fixture:true}} as const;return {f,bo,row,approval};};
test("PAP-2411 BO readback projects only the confirmed HO result and Staff link",async()=>{
 const {f,bo,row,approval}=await setup();
 const next=projectStaffHoDecision(row,bo,approval);
 assert.equal(next.reviewStage,"HO_APPROVED");assert.equal(next.finalizedStaffId,approval.receipt.staffId);assert.equal(next.reviewedBy,bo.reviewedBy);
 assert.equal(Object.hasOwn(next,"userId"),false);assert.equal(Object.hasOwn(next,"personId"),false);assert.equal(Object.hasOwn(next,"roleId"),false);
 assert.equal((await f.dossierReview.list!())[0].reviewStage,"REVIEWED_FOR_HO");
 assert.throws(()=>projectStaffHoDecision(next,bo,approval));
});
test("PAP-2411 unreviewed, foreign, stale, denied and malformed HO receipts never finalize a BO dossier",async()=>{
 const {bo,row,approval}=await setup();
 assert.throws(()=>projectStaffHoDecision({...row,reviewStage:undefined},bo,approval));
 for(const patch of [{registrationRequestId:"foreign"},{reviewedVersion:2},{scopeId:"foreign"},{staffId:id},{roleId:""},{fixture:false},{employmentStatus:"active"}]){
  assert.throws(()=>projectStaffHoDecision(row,bo,{...approval,receipt:{...approval.receipt,...patch}} as StaffHoDecisionReadback));
 }
 assert.throws(()=>projectStaffHoDecision(row,{...bo,reviewedBy:"different"},approval));
 assert.throws(()=>projectStaffHoDecision(row,bo,{kind:"denied"}));
});
test("PAP-2411 HO rejection readback retains BO review and separate HO rejection reason",async()=>{
 const {bo,row}=await setup();const decision={kind:"rejected",registrationRequestId:id,reviewedVersion:1,reason:"M1 HO rejection"} as const;
 const next=projectStaffHoDecision(row,bo,decision);
 assert.equal(next.reviewStage,"HO_REJECTED");assert.equal(next.hoRejectReason,decision.reason);assert.equal(next.reviewedBy,bo.reviewedBy);assert.equal(next.finalizedStaffId,undefined);
 assert.throws(()=>projectStaffHoDecision(row,bo,{...decision,reason:" "}));
 assert.throws(()=>projectStaffHoDecision(row,bo,{...decision,reviewedVersion:2}));
});

test("PAP-2411 fixture list consumes HO readback only after exact BO review",async()=>{
 let decision:StaffHoDecisionReadback|null=null,calls=0;
 const f=createStaffDossierM1Fixture({readHoDecision:async()=>{calls++;return decision;}});
 assert.equal((await f.dossierReview.list!())[0].reviewStage,undefined);assert.equal(calls,0);
 const bo=await f.dossierReview.submit!(id,1,f.dossierReview.centerId,"BO-review");
 assert.equal((await f.dossierReview.list!())[0].reviewStage,"REVIEWED_FOR_HO");
 const {approval}=await setup();
 decision={...approval,receipt:{...approval.receipt,reviewedVersion:2}};
 await assert.rejects(f.dossierReview.list!());
 decision=approval;
 const [final]=await f.dossierReview.list!();assert.equal(final.reviewStage,"HO_APPROVED");assert.equal(final.finalizedStaffId,approval.receipt.staffId);assert.equal(final.reviewedBy,bo.reviewedBy);
 assert.deepEqual(await f.dossierReview.list!(),[final]);
 decision={kind:"rejected",registrationRequestId:id,reviewedVersion:1,reason:"Conflicting"};
 assert.deepEqual(await f.dossierReview.list!(),[final]);
});
test("PAP-2411 fixture list retains HO rejection and never reads HO for BO rejected dossier",async()=>{
 let calls=0;
 const rejected=createStaffDossierM1Fixture({readHoDecision:async()=>{calls++;return {kind:"rejected",registrationRequestId:id,reviewedVersion:1,reason:"HO reason"};}});
 await rejected.service.rejectStaffRegistration(id,"BO reason","reject");
 assert.equal((await rejected.dossierReview.list!())[0].reviewStage,"REJECTED");assert.equal(calls,0);
 const reviewed=createStaffDossierM1Fixture({readHoDecision:async()=>({kind:"rejected",registrationRequestId:id,reviewedVersion:1,reason:"HO reason"})});
 await reviewed.dossierReview.submit!(id,1,reviewed.dossierReview.centerId,"review");
 const [row]=await reviewed.dossierReview.list!();assert.equal(row.reviewStage,"HO_REJECTED");assert.equal(row.hoRejectReason,"HO reason");assert.equal(row.finalizedStaffId,undefined);
});
