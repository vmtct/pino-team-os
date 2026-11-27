import test from "node:test";
import assert from "node:assert/strict";
import {createStaffLifecycleM1Fixture} from "../app/bo/workforce/staffs/staff-lifecycle-m1-fixture";
import {createStaffRegistrationM1Service} from "../app/bo/workforce/staffs/staff-registration-m1-service";
import {STAFF_DIRECTORY_MOCK_ID as id} from "../app/bo/workforce/staffs/staff-directory-m1-fixture";
test("PAP-2411 synthetic approval projects the exact same Staff into directory",async()=>{
 const f=createStaffLifecycleM1Fixture("pending"),s=createStaffRegistrationM1Service();
 assert.deepEqual(f.rows(),[]);
 const [role]=await s.accessRoles(),[center]=(await s.scopeCatalog()).centers;
 const receipt=await s.approveStaffRegistration(id,[{roleId:role.id,scopeType:"CENTER",scopeId:center.id}],{mode:"CREATE_STAFF_ONLY_PERSON"},"approve");
 assert.throws(()=>f.approve({...receipt,staffMemberId:"foreign"}));
 assert.equal(f.approve(receipt).profile?.id,id);assert.equal(f.rows()[0].status,"active");
 assert.throws(()=>f.approve(receipt));assert.equal(f.rows().length,1);
});
test("PAP-2411 rejected registration never enters directory",()=>{const f=createStaffLifecycleM1Fixture("pending");assert.throws(()=>f.reject("foreign"));assert.equal(f.reject(id).phase,"rejected");assert.deepEqual(f.rows(),[]);});
test("PAP-2411 profile edit and deactivation retain same record, reject stale and unconfirmed",()=>{
 const f=createStaffLifecycleM1Fixture(),original=f.snapshot();
 assert.throws(()=>f.edit("foreign",1,{displayLabel:"Changed"}));
 assert.throws(()=>f.edit(id,1,{displayLabel:" "}));
 assert.throws(()=>f.edit(id,1,{status:"inactive"} as never));
 const edited=f.edit(id,1,{displayLabel:"M1 edited",department:"M1"});
 assert.equal(edited.profile?.id,id);assert.equal(edited.profile?.status,"active");assert.equal(f.rows()[0].name,"M1 edited");
 assert.throws(()=>f.deactivate(id,1,true));assert.throws(()=>f.deactivate(id,2,false));
 const inactive=f.deactivate(id,2,true);assert.equal(inactive.profile?.status,"inactive");assert.equal(inactive.profile?.roleLabel,original.profile?.roleLabel);assert.equal(f.rows()[0].status,"inactive");
 assert.throws(()=>f.deactivate(id,3,true));assert.equal(createStaffLifecycleM1Fixture().snapshot().profile?.status,"active");
});
