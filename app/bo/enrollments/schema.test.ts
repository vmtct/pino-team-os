import assert from "node:assert/strict";
import test from "node:test";
import {enrollmentSchema,enrollmentModule,fields,queryDefault,READ} from "./schema";
test("PAP-2181 uses read-only native directory and all eleven visible columns",()=>{
 assert.equal(enrollmentSchema.key,"enrollments");
 assert.equal(enrollmentSchema.label,"Lịch học");
 assert.equal(enrollmentSchema.capabilities.read,READ);
 assert.equal(enrollmentSchema.table.inlineEdit.enabled,false);
 assert.equal(enrollmentSchema.capabilities.create,undefined);
 assert.equal(enrollmentSchema.capabilities.edit,undefined);
 assert.equal(fields.length,11);
 assert.ok(fields.every(f=>f.readOnly&&!f.capabilities.inlineEdit));
 assert.deepEqual(queryDefault.visible,fields.map(f=>f.key));
});
test("relation projection has no Session or Registration field; preserves date boundaries and audit",()=>{
 const keys=fields.map(f=>f.key);
 assert.deepEqual(keys,["name","subscription","runningClass","path","schedule","start","end","createdAt","createdBy","updatedAt","updatedBy"]);
 assert.ok(enrollmentModule.fields.every(f=>f.readonly));
 assert.equal(fields.find(f=>f.key==="end")?.label,"Đến ngày (loại trừ)");
});
test("unbound native preview fails closed for runtime reads",async()=>{
 await assert.rejects(()=>enrollmentSchema.data.list({} as never,{} as never,new AbortController().signal),/Core adapter not bound/);
 await assert.rejects(()=>enrollmentSchema.data.detail("unbound",{} as never,new AbortController().signal),/Core adapter not bound/);
});
