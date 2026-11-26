import test from "node:test";
import assert from "node:assert/strict";
import {createParentFixture,PARENT_MOCK_CENTER as center,PARENT_MOCK_SEED as seed} from "../app/bo/parents/parent-m1-fixture";
test("PAP-2387 fixture starts with one synthetic Parent and null audit",()=>{
 const f=createParentFixture(),rows=f.list(center);assert.equal(rows.length,1);assert.equal(rows[0].id,seed);
 for(const key of ["createdAt","createdBy","updatedAt","updatedBy"])assert.equal(rows[0][key],null);
 assert.equal(f.detail(center,seed).id,seed);assert.equal(f.detail(center,seed).students.length,rows[0].studentCount);
 assert.throws(()=>f.list("01a0b29a-3acd-7a18-a0f2-cf6016548ab5"));assert.throws(()=>f.detail(center,"01a0b29a-3acd-7a18-a0f2-cf6016548ab5"));
});
test("PAP-2387 synthetic edits are scoped, versioned, isolated and reset",()=>{
 const f=createParentFixture();const row=f.rename(center,seed,"Tên mẫu mới",1);assert.equal(row.version,2);assert.equal(f.list(center)[0].name,"Tên mẫu mới");
 assert.throws(()=>f.rename(center,seed,"Khác",1));assert.notEqual(createParentFixture().list(center)[0].name,row.name);
});
test("PAP-2387 create is idempotent in memory and keeps masked data",()=>{
 const f=createParentFixture(),body={displayName:"Mẫu mới",contacts:[{identifierType:"EMAIL" as const,value:"sample@example.invalid",isPrimary:true}]};
 const receipt=f.create(center,body,"key-1");assert.equal(receipt.parentUserId,"PARENT-MOCK-002");
 assert.deepEqual(f.create(center,body,"key-1"),receipt);assert.equal(f.list(center).length,2);
 assert.throws(()=>f.create(center,{...body,displayName:"Khác"},"key-1"));assert.equal(f.detail(center,receipt.parentUserId).contacts[0].maskedValue,"•••@example.invalid");
 assert.equal(createParentFixture().list(center).length,1);
});
