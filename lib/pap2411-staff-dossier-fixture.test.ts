import test from "node:test";
import assert from "node:assert/strict";
import {createStaffDossierM1Fixture} from "../app/bo/workforce/staffs/staff-dossier-m1-fixture";
import {STAFF_DIRECTORY_MOCK_ID as id} from "../app/bo/workforce/staffs/staff-directory-m1-fixture";
test("PAP-2411 BO dossier review moves to HO without identity or Access creation",async()=>{
 const f=createStaffDossierM1Fixture(),submit=f.dossierReview.submit!,center=f.dossierReview.centerId;
 await assert.rejects(submit(id,1,"foreign","foreign"));
 await assert.rejects(submit(id,2,center,"stale"));
 const receipt=await submit(id,1,center,"valid");
 assert.deepEqual(receipt,{registrationRequestId:id,centerId:center,status:"REVIEWED_FOR_HO"});
 assert.deepEqual(f.readback(),receipt);assert.deepEqual(await f.service.staffRegistrationRequests(),[]);const rows=await f.dossierReview.list!();assert.equal(rows.length,1);assert.equal(rows[0].reviewStage,"REVIEWED_FOR_HO");assert.equal(rows[0].reviewedVersion,1);assert.equal(rows[0].reviewedBy,"M1 BO Reviewer");
 assert.deepEqual(await submit(id,1,center,"valid"),receipt);
 await assert.rejects(submit(id,1,center,"duplicate"));
 await assert.rejects(f.service.rejectStaffRegistration(id,"reason","reject"));
 await assert.rejects(f.service.approveStaffRegistration());
 assert.equal((await createStaffDossierM1Fixture().service.staffRegistrationRequests()).length,1);
});
test("PAP-2411 incomplete documents and rejected dossier never go to HO",async()=>{
 const f=createStaffDossierM1Fixture({completeDocuments:false});
 await assert.rejects(f.dossierReview.submit!(id,1,f.dossierReview.centerId,"missing"));assert.equal(f.readback(),null);
 const r=createStaffDossierM1Fixture();
 await r.service.rejectStaffRegistration(id,"reason","reject");
 await assert.rejects(r.dossierReview.submit!(id,1,r.dossierReview.centerId,"after-reject"));assert.equal(r.readback(),null);const rows=await r.dossierReview.list!();assert.equal(rows[0].reviewStage,"REJECTED");assert.equal(rows[0].rejectReason,"reason");
});
