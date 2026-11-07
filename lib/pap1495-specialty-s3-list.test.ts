
import test from "node:test";
import assert from "node:assert/strict";
import {specialtyFields,specialtyQuery,formatSpecialtyAuditTime,specialtyPathLabel} from "../app/ho/learning/specialties/schema";
import {parseSpecialtySummary} from "./ho-specialty-v2-reader";
const id="01234567-89ab-7cde-8fab-0123456789ab",pathId="11234567-89ab-7cde-8fab-0123456789ab";
test("PAP-1495 S3: founder-confirmed 11 columns; description stays optional hidden",()=>{
 const expected=["name","path","status","levelCount","prerequisiteView","tagView","missionCount","createdTime","createdBy","lastModifiedTime","lastModifiedBy"];
 assert.deepEqual(specialtyQuery.visible,expected);
 assert.deepEqual(specialtyQuery.order.slice(0,11),expected);
 assert.equal(specialtyQuery.visible.includes("description"),false);
 for(const key of expected)assert.ok(specialtyFields.some(f=>f.key===key));
});
test("PAP-1495 S3 maps canonical Core Path ID to label; unrecognized IDs fail closed",()=>{
 assert.equal(specialtyPathLabel(pathId,[{id:pathId,code:"artchitect",label:"Artchitect"}]),"Artchitect");
 assert.throws(()=>specialtyPathLabel(id,[{id:pathId,code:"artchitect",label:"Artchitect"}]));
});
test("PAP-1495 S3 audit formatting VN timezone and safe absent fields",()=>{
 assert.equal(formatSpecialtyAuditTime("2026-08-25T17:00:00.000Z"),"26/08/2026 · 00:00");
 assert.equal(formatSpecialtyAuditTime(null),"—");
 const base={id,pathProgramId:pathId,name:"Test",description:null,status:"DRAFT",tags:[],version:1,missionCountDistinct:0};
 const old=parseSpecialtySummary(base); assert.ok(old);assert.equal(old.createdAt,undefined);
 const aud=parseSpecialtySummary({...base,createdAt:"2026-08-25T17:00:00.000Z",updatedAt:null,createdByVerifiedLegalName:null});
 assert.ok(aud);assert.equal(aud.createdAt,"2026-08-25T17:00:00.000Z");
 assert.equal(parseSpecialtySummary({...base,createdAt:"not-a-date"}),null);
 assert.equal(parseSpecialtySummary({...base,createdByVerifiedLegalName:"someone@example.com"}),null);
});
