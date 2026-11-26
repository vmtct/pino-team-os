import test from "node:test";
import assert from "node:assert/strict";
import {createStaffRegistrationM1Service} from "../app/bo/workforce/staffs/staff-registration-m1-service";
import {STAFF_DIRECTORY_MOCK_ID} from "../app/bo/workforce/staffs/staff-directory-m1-fixture";
const identity={mode:"CREATE_STAFF_ONLY_PERSON"} as const;
test("PAP-2411 synthetic approval is isolated and idempotent",async()=>{
  const service=createStaffRegistrationM1Service();
  const role=(await service.accessRoles())[0];const center=(await service.scopeCatalog()).centers[0];
  const assignments=[{roleId:role.id,scopeType:"CENTER" as const,scopeId:center.id}];
  await assert.rejects(service.approveStaffRegistration("real-id",assignments,identity,"bad"));
  const receipt=await service.approveStaffRegistration(STAFF_DIRECTORY_MOCK_ID,assignments,identity,"a");
  assert.deepEqual(await service.approveStaffRegistration(STAFF_DIRECTORY_MOCK_ID,assignments,identity,"a"),receipt);
  await assert.rejects(service.rejectStaffRegistration(STAFF_DIRECTORY_MOCK_ID,"test","a"));
  assert.equal((await service.staffRegistrationRequests()).length,0);
  assert.equal((await createStaffRegistrationM1Service().staffRegistrationRequests()).length,1);
});
test("PAP-2411 reject and intake state stay within each fixture instance",async()=>{
  const a=createStaffRegistrationM1Service(),b=createStaffRegistrationM1Service();
  await assert.rejects(a.rejectStaffRegistration(STAFF_DIRECTORY_MOCK_ID," ","bad"));
  const rejected=await a.rejectStaffRegistration(STAFF_DIRECTORY_MOCK_ID,"test","r");
  assert.deepEqual(await a.rejectStaffRegistration(STAFF_DIRECTORY_MOCK_ID,"test","r"),rejected);
  assert.equal((await a.staffRegistrationRequests()).length,0);
  assert.equal((await b.staffRegistrationRequests()).length,1);
  assert.equal((await a.setStaffRegistrationIntake(false)).enabled,false);
  assert.equal((await b.staffRegistrationIntake()).enabled,true);
});
