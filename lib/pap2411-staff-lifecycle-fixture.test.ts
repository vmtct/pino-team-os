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

test("PAP-2411 BO edits do not mutate identity, account, role or imply eligibility",()=>{
 const f=createStaffLifecycleM1Fixture();
 assert.equal(f.snapshot().accountState,"UNKNOWN");assert.equal(f.snapshot().operationalReadiness,"NOT_VERIFIED");
 for(const patch of [{email:"other@example.invalid"},{mobile:"0000"},{roleLabel:"Founder"},{startDate:"2026-02-30"}])assert.throws(()=>f.edit(id,1,patch));
 assert.equal(f.snapshot().revision,1);
 const saved=f.edit(id,1,{startDate:"2026-02-28",employmentType:"M1"});assert.equal(saved.operationalReadiness,"NOT_VERIFIED");
 assert.equal(f.deactivate(id,2,true).operationalReadiness,"NOT_READY");
 assert.equal(f.snapshot().accountState,"UNKNOWN");
});

test("PAP-2411 synthetic audit metadata advances only after a successful lifecycle mutation",()=>{
 const f=createStaffLifecycleM1Fixture(),initial=f.rows()[0];
 assert.throws(()=>f.edit(id,9,{displayLabel:"Stale"}));assert.deepEqual(f.rows()[0],initial);
 f.edit(id,1,{displayLabel:"M1 changed"});const edited=f.rows()[0];
 assert.equal(edited.createdAt,initial.createdAt);assert.equal(edited.createdBy,initial.createdBy);assert.equal(edited.updatedAt,"2026-11-26T08:01:00.000Z");assert.equal(edited.updatedBy,"M1 Fixture Reviewer");
 assert.throws(()=>f.deactivate(id,2,false));assert.deepEqual(f.rows()[0],edited);
 f.deactivate(id,2,true);assert.equal(f.rows()[0].updatedAt,"2026-11-26T08:02:00.000Z");assert.equal(f.rows()[0].id,id);
});
test("PAP-2411 inactive profile is readonly at fixture boundary; malformed name cannot mutate state",()=>{const f=createStaffLifecycleM1Fixture();const original=f.snapshot(),row=f.rows()[0];for(const displayLabel of [null,undefined,""," "])assert.throws(()=>f.edit(id,1,{displayLabel} as never));assert.deepEqual(f.snapshot(),original);assert.deepEqual(f.rows()[0],row);assert.equal(original.profile?.roleLabel,"Nhân sự (custom M1)");f.deactivate(id,1,true);const inactive=f.snapshot(),inactiveRow=f.rows()[0];assert.throws(()=>f.edit(id,2,{department:"Unexpected edit"}));assert.deepEqual(f.snapshot(),inactive);assert.deepEqual(f.rows()[0],inactiveRow);});
