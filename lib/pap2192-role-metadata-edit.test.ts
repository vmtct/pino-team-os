import assert from "node:assert/strict";
import test from "node:test";
import {prepareRoleMetadataEdit,verifyRoleMetadataEdit} from "../app/ho/system/roles/role-metadata-edit";
const role={id:"01a17d3f-8697-7080-bdf1-33e939758059",roleKey:"custom-example",roleType:"custom",status:"active",
 displayName:"Old name",description:"Old description",permissionKeys:["student.record.view","access.role.view"],
 updatedAt:"2026-11-24T10:00:00.000Z",permissionCount:2,assignmentCount:1};
test("metadata edit maps only selected fields to the existing full update contract",()=>{
 const result=prepareRoleMetadataEdit(role,role.updatedAt,{name:" New name "});
 assert.deepEqual(result,{roleId:role.id,roleKey:role.roleKey,body:{displayName:"New name",description:role.description,
 permissionKeys:["access.role.view","student.record.view"],expectedUpdatedAt:role.updatedAt}});
 assert.equal(prepareRoleMetadataEdit(role,role.updatedAt,{description:" "})?.body.description,null);
 assert.deepEqual(role.permissionKeys,["student.record.view","access.role.view"]);
});
test("reject stale, protected or noncanonical records and forbidden patch fields",()=>{
 for(const current of [null,{...role,id:"mock"},{...role,roleKey:"founder"},{...role,roleType:"system"},
  {...role,status:"archived"},{...role,updatedAt:"invalid"},{...role,permissionKeys:["bad"]},
  {...role,permissionKeys:["access.role.view","access.role.view"]},{...role,description:" trailing "}])
  assert.equal(prepareRoleMetadataEdit(current,role.updatedAt,{name:"New"}),null);
 assert.equal(prepareRoleMetadataEdit(role,"2020-01-01T00:00:00Z",{name:"New"}),null);
 for(const patch of [null,[],{}, {name:" "},{name:"x".repeat(121)},{description:"x".repeat(501)},
  {name:role.displayName},{name:42},{description:null},{roleKey:"other"},{permissionKeys:[]},{name:"New",status:"archived"}])
  assert.equal(prepareRoleMetadataEdit(role,role.updatedAt,patch),null);
});
test("only newer exact persisted metadata and unchanged permission membership is accepted",()=>{
 const command=prepareRoleMetadataEdit(role,role.updatedAt,{name:"New name",description:""})!;
 const receipt={...role,displayName:"New name",description:null,updatedAt:"2026-11-24T10:00:01.000Z"};
 assert.equal(verifyRoleMetadataEdit(command,receipt),true);
 assert.equal(verifyRoleMetadataEdit(command,{...receipt,permissionKeys:[...receipt.permissionKeys].reverse(),assignmentCount:2}),true);
 for(const bad of [null,{}, {...receipt,id:"other"},{...receipt,roleKey:"other"},{...receipt,displayName:"Wrong"},
  {...receipt,description:"Wrong"},{...receipt,status:"archived"},{...receipt,updatedAt:role.updatedAt},
  {...receipt,permissionKeys:["access.role.view"]},{...receipt,permissionCount:1},{...receipt,assignmentCount:-1}])
  assert.equal(verifyRoleMetadataEdit(command,bad),false);
});
