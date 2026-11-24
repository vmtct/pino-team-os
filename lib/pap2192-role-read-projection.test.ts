import assert from "node:assert/strict";
import test from "node:test";
import {roleProvider,roleDefinition,roleQuery} from "../app/ho/system/roles/schema";
const role={id:"01a17d3f-8697-7080-bdf1-33e939758059",roleKey:"custom-example",displayName:"Sample",roleType:"custom",
 status:"active",description:"Persisted description",createdAt:"2026-11-23T01:00:00.000Z",updatedAt:"2026-11-24T01:00:00.000Z",
 permissionCount:2,assignmentCount:1};
const scope={surface:"HO"} as const;
const signal=new AbortController().signal;
const fetcher=(records:unknown[])=>((input:RequestInfo|URL,init?:RequestInit)=>{
 assert.equal(input,"/api/bo/access/roles");assert.equal(init?.method,"GET");
 return Promise.resolve(Response.json({data:records}));
}) as typeof fetch;
test("native role list and detail expose actual read-only metadata and audit time",async()=>{
 const list=await roleProvider.list(roleQuery,scope,fetcher([role]),signal);
 assert.equal(list.total,1);
 const row=list.records[0]!.row;
 assert.equal(row.description,role.description);assert.equal(row.createdAt,role.createdAt);assert.equal(row.updatedAt,role.updatedAt);
 assert.equal(row.createdBy,"—");assert.equal(row.updatedBy,"—");
 assert.deepEqual(await roleProvider.detail(role.id,scope,fetcher([role]),signal),{row});
 assert.equal(await roleProvider.detail("missing",scope,fetcher([role]),signal),null);
 assert.equal((await roleProvider.list(roleQuery,scope,fetcher([{...role,description:null}]),signal)).records[0]!.row.description,"");
 assert.equal(roleProvider.mutation,undefined);assert.equal(roleDefinition.table.inlineEdit.enabled,false);
});
test("invalid metadata, missing time, malformed ID and wrong surface fail closed",async()=>{
 for(const bad of [{...role,description:42},{...role,updatedAt:undefined},{...role,createdAt:"bad"},{...role,id:42},{...role,assignmentCount:-1}])
  await assert.rejects(roleProvider.list(roleQuery,scope,fetcher([bad]),signal),/Invalid Role record/);
 await assert.rejects(roleProvider.list(roleQuery,{surface:"BO",centerId:"center"},fetcher([role]),signal),/HO only/);
});