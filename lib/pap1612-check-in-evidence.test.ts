import assert from "node:assert/strict";
import test from "node:test";
import {defaultTable,display} from "./bo-registration";
import {checkInEvidenceModule,createCheckInEvidenceFixture,evidenceRecord} from "../app/bo/workforce/timekeeping/check-in-evidence-presentation";
test("PAP-1612 approved 11 read-only fields retain exact order",()=>{
 const fields=checkInEvidenceModule.fields;
 assert.deepEqual(fields.map(f=>f.label),["Ngày công","Nhân viên","Ca phân công","Check-in Time","Check-out Time","Bằng chứng ảnh","Lý do thiếu ảnh","Created Time","Created by (User)","Last Modified Time","Last Modified By (User)"]);
 assert.equal(fields.every(f=>f.readonly),true);
 assert.deepEqual(defaultTable(fields).visible,fields.map(f=>f.key));
 const row=evidenceRecord(createCheckInEvidenceFixture());assert.equal(fields.every(f=>f.key in row),true);
});
test("PAP-1612 fixture and unknown audit facts remain isolated and truthful",()=>{
 const a=createCheckInEvidenceFixture(),b=createCheckInEvidenceFixture();a.staffName="changed";assert.equal(b.staffName,"Nhân viên mẫu");
 const missing=evidenceRecord(b);assert.equal(missing.evidence,"Thiếu ảnh");assert.equal(missing.missingReason,"Chưa ghi nhận ảnh");
 for(const key of ["createdAt","createdBy","updatedAt","updatedBy","checkOutAt"])assert.equal(display(missing[key]),"—");
 for(const state of ["BOUND","DELETED"] as const){const row=evidenceRecord({...b,state});assert.equal(row.evidence,state==="BOUND"?"Đã có ảnh":"Đã xóa ảnh");assert.equal(row.missingReason,null);assert.equal("photoUrl" in row,false);}
});
