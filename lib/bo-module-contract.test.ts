import test from "node:test";
import assert from "node:assert/strict";
import { defineBoModule, defineBoModuleRegistry } from "../app/bo/architecture/contract";
import { requireBoModule, requireBoModuleForRoute } from "../app/bo/architecture/registry";
const valid = {
  key:"music-studio",
  href:"/bo/music-studio",
  label:"Music Studio",
  kind:"entity",
  permissions:{read:"academy.music.view",write:"academy.music.manage"},
  fields:[
    {key:"id",label:"ID",type:"id",readOnly:true},
    {key:"name",label:"Tên",type:"text"},
  ],
  publicViews:"module-shared",
  quickView:"canonical-properties",
  fullDetail:"shared-tabs",
} as const;
test("unregistered modules and URLs are denied by runtime",()=>{
  assert.throws(()=>requireBoModule("nonexistent"),/Unregistered/);
  assert.throws(()=>requireBoModuleForRoute("/bo/nonexistent"),/Unregistered/);
});
test("factory registry accepts a complete entity contract",()=>{
  const result=defineBoModule(valid);
  assert.equal(result.publicViews,"module-shared");
  assert.equal(defineBoModuleRegistry([result]).length,1);
});
test("runtime contract fails on duplicate routes or fields",()=>{
  assert.throws(()=>defineBoModuleRegistry([valid,valid]),/Duplicate/);
  assert.throws(()=>defineBoModule({
    ...valid,fields:[valid.fields[0],valid.fields[0],valid.fields[1]],
  }),/Duplicate/);
});
test("runtime contract rejects incomplete read-only ID, permissions and share policy",()=>{
  assert.throws(()=>defineBoModule({
    ...valid, fields:[{key:"id",label:"ID",type:"text"},valid.fields[1]],
  } as unknown as typeof valid),/incomplete/);
  assert.throws(()=>defineBoModule({
    ...valid,permissions:{read:"",write:""},
  }),/incomplete/);
  assert.throws(()=>defineBoModule({
    ...valid,publicViews:"private",
  } as unknown as typeof valid),/incomplete/);
});
