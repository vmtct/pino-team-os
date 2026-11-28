import test from "node:test";
import assert from "node:assert/strict";
import {createStaffDossierM1Fixture} from "../app/bo/workforce/staffs/staff-dossier-m1-fixture";
import {STAFF_DOSSIER_MOCK_ID as id} from "../app/bo/workforce/staffs/staff-registration-m1-service";
test("PAP-2411 BO dossier review moves to HO without identity or Access creation",async()=>{
 const f=createStaffDossierM1Fixture(),submit=f.dossierReview.submit!,center=f.dossierReview.centerId;
 await assert.rejects(submit(id,1,"foreign","foreign"));
 await assert.rejects(submit(id,2,center,"stale"));
 const receipt=await submit(id,1,center,"valid");
 assert.deepEqual(receipt,{registrationRequestId:id,centerId:center,status:"REVIEWED_FOR_HO",reviewedVersion:1,reviewedBy:"M1 BO Reviewer"});
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
test("PAP-2411 dossier identity is distinct from existing Staff",async()=>{const f=createStaffDossierM1Fixture();const [row]=await f.dossierReview.list!();assert.equal(row.id,id);assert.equal(row.email,"applicant@example.invalid");assert.notEqual(row.id,"STAFF-DIRECTORY-MOCK-001");assert.notEqual(row.displayLabel,"Nhân sự mẫu PINO");await assert.rejects(f.dossierReview.submit!("STAFF-DIRECTORY-MOCK-001",1,f.dossierReview.centerId,"wrong"));});
test("PAP-2411 dossier audit uses explicit synthetic provenance, not fabricated live metadata",async()=>{const f=createStaffDossierM1Fixture();const [before]=await f.dossierReview.list!();assert.equal(before.createdAt,before.submittedAt);assert.equal(before.createdBy,"M1 Applicant");await f.dossierReview.submit!(id,1,f.dossierReview.centerId,"audit");const [after]=await f.dossierReview.list!();assert.equal(after.createdAt,before.createdAt);assert.equal(after.createdBy,before.createdBy);assert.equal(after.updatedBy,"M1 BO Reviewer");assert.equal(after.updatedAt,"2026-11-26T08:05:00.000Z");});
