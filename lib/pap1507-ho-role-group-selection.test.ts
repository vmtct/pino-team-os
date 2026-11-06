import test from "node:test";
import assert from "node:assert/strict";
import {groupSelectionState,bulkGroupPermissionKeys} from "../app/ho/system/roles/HoRoleEditor";

test("PAP-1507: group checkbox is none/mixed/all and selects then clears visible ACL",()=>{
  const visible=["access.role.view","access.role.edit","access.role.manage"];
  assert.equal(groupSelectionState([],visible),"none");
  assert.equal(groupSelectionState(["access.role.view"],visible),"mixed");
  assert.equal(groupSelectionState(visible,visible),"all");
  assert.deepEqual(bulkGroupPermissionKeys(["access.role.view"],visible),[...visible].sort());
  assert.deepEqual(bulkGroupPermissionKeys(visible,visible),[]);
});
test("PAP-1507: bulk toggles only filtered group keys; hidden ACL is preserved",()=>{
  const hidden=["staff.salary.view","learning.diary.create"];
  const visible=["access.role.edit","access.role.view"];
  const changed=bulkGroupPermissionKeys([...hidden,"access.role.view"],visible);
  assert.deepEqual(changed,["access.role.edit","access.role.view",...hidden].sort());
  const cleared=bulkGroupPermissionKeys(changed,visible);
  assert.deepEqual(cleared,hidden.sort());
});
test("PAP-1507: empty group is safe and never clears the draft",()=>{
  const initial=["hidden.key"];
  assert.equal(groupSelectionState(initial,[]),"none");
  assert.deepEqual(bulkGroupPermissionKeys(initial,[]),initial);
});
