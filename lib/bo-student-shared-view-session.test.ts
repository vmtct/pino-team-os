import test from "node:test";
import assert from "node:assert/strict";
import { studentSharedViewContract } from "./bo-student-shared-view-session";
import type { BoContext } from "./bo-model";

const base = { userId:"u", email:"staff@example.invalid", staffMemberId:null, displayName:null, staffProfile:null, surface:"BO", entitled:true, permissionKeys:[] } as BoContext;
test("Student view role fails closed without domain read",()=>{
  assert.equal(studentSharedViewContract({...base,permissionKeys:["bo.shared_view.manage"]}),null);
});
test("Staff read access never implies manager",()=>{
  assert.equal(studentSharedViewContract({...base,permissionKeys:["student.profile.view"]})?.role,"staff");
});
test("Manager projection requires explicit global manage permission key",()=>{
  const result=studentSharedViewContract({...base,permissionKeys:["student.profile.view","bo.shared_view.manage"]});
  assert.equal(result?.role,"manager");
  assert.equal(result?.moduleKey,"students");
  assert.deepEqual(result?.allowedFields,["id","name","birth","paths","learning","member","attention"]);
});
