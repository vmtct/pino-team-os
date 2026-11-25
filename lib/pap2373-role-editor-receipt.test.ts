import assert from "node:assert/strict";
import test from "node:test";
import {verifiedExistingRoleEdit} from "../app/ho/system/roles/role-editor-receipt";
import type {BoAccessRoleDetail} from "./bo-access-model";
const current:BoAccessRoleDetail={id:"00000000-0000-4000-8000-000000000025",roleKey:"custom-example",roleType:"custom",status:"active",
 displayName:"Old",description:null,createdAt:"2026-11-20T00:00:00.000Z",updatedAt:"2026-11-24T10:00:00.000Z",
 permissionKeys:["access.role.view"],permissionCount:1,assignmentCount:0};
const wanted={displayName:"New",description:null,permissionKeys:["access.role.view"],expectedUpdatedAt:current.updatedAt};
const actual={...current,displayName:"New",updatedAt:"2026-11-24T10:00:01.000Z"};
test("existing editor only accepts a newer exact identity and consistent persisted receipt",()=>{
 assert.equal(verifiedExistingRoleEdit(current,wanted,actual),true);
 for(const bad of [{...actual,id:"other"},{...actual,roleKey:"other"},{...actual,createdAt:"invalid"},
  {...actual,updatedAt:current.updatedAt},{...actual,updatedAt:"invalid"},{...actual,status:"archived" as const},
  {...actual,roleType:"system" as const},{...actual,permissionKeys:["access.role.view","access.role.view"],permissionCount:2},
  {...actual,permissionKeys:[]},{...actual,permissionCount:2},{...actual,assignmentCount:-1},{...actual,description:"unexpected"}])
  assert.equal(verifiedExistingRoleEdit(current,wanted,bad),false);
 assert.equal(verifiedExistingRoleEdit(current,{...wanted,expectedUpdatedAt:"stale"},actual),false);
 assert.equal(verifiedExistingRoleEdit({...current,roleKey:"founder"},wanted,actual),false);
});
