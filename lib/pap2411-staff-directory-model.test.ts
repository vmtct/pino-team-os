import test from "node:test";
import assert from "node:assert/strict";
import {defaultTable} from "./bo-registration";
import {staffDirectoryModule,staffDirectoryPresentationRow} from "../app/bo/workforce/staffs/staff-directory-model";
import {staffDirectoryFixture,STAFF_DIRECTORY_MOCK_ID} from "../app/bo/workforce/staffs/staff-directory-m1-fixture";
test("PAP-2411 lean directory and four default audit columns",()=>{
  const fields=staffDirectoryModule.fields;
  assert.deepEqual(defaultTable(fields).visible.slice(-4),["createdAt","createdBy","updatedAt","updatedBy"]);
  assert.ok(fields.every(field=>field.readonly));
  assert.ok(!fields.some(field=>["email","mobile","bank","governmentId","accessStatus"].includes(field.key)));
});
test("PAP-2411 isolated synthetic staff seed is consistent and fresh",()=>{
  const a=staffDirectoryFixture(),b=staffDirectoryFixture();
  assert.equal(a.id,STAFF_DIRECTORY_MOCK_ID);assert.deepEqual(a,b);assert.notEqual(a,b);
});

test("PAP-2411 employment label mapping preserves source and other fields",()=>{
 const row=staffDirectoryFixture();assert.equal(staffDirectoryPresentationRow(row).status,"\u0110ang l\u00e0m");assert.equal(row.status,"active");
 assert.equal(staffDirectoryPresentationRow({...row,status:"inactive"}).status,"Ng\u01b0ng ho\u1ea1t \u0111\u1ed9ng");assert.equal(staffDirectoryPresentationRow(row).id,row.id);
});
