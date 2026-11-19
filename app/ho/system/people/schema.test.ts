import {test} from "node:test";
import assert from "node:assert/strict";
import {personSchema,registry,queryDefault,READ} from "./schema";
import {allows,validateQuery,validateModule} from "@/lib/workspace-schema";
test("PAP-2180 admitted canonical schema, readonly and global HO only",()=>{
 validateModule(personSchema);
 const ctx={surface:"HO" as const,authorize:(key:string)=>key===READ};
 validateQuery(personSchema,queryDefault,ctx);
 assert.equal(registry.get("HO","people"),personSchema);
 assert.equal(allows(personSchema,ctx,"read"),true);
 assert.equal(allows(personSchema,ctx,"edit"),false);
 assert.equal(allows(personSchema,ctx,"create"),false);
 assert.equal(allows(personSchema,{surface:"BO",centerId:"qa",authorize:()=>true},"read"),false);
 assert.equal(allows(personSchema,{surface:"HO",authorize:()=>false},"read"),false);
 assert.ok(personSchema.fields.every(f=>f.readOnly&&!f.capabilities.inlineEdit));
 for(const k of ["createdAt","createdBy","updatedAt","updatedBy"])assert.ok(queryDefault.visible.includes(k as typeof queryDefault.visible[number]));
 assert.equal(personSchema.drawer.density,"one-column");
});
