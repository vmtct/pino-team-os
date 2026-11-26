// PAP-2358 · WFM-STAFF. Presentation is not audit provenance.
import test from "node:test";
import assert from "node:assert/strict";
import {formatStaffAuditTime,staffNativeOverviewProperties} from "./staff-native-overview";
test("audit display uses Vietnam time and honest unknown",()=>{
  assert.equal(formatStaffAuditTime("2026-11-25T23:05:00Z"),"26/11/2026 · 06:05");
  assert.equal(formatStaffAuditTime(null),"—");assert.equal(formatStaffAuditTime("invalid"),"—");
  const p={fields:[],sections:[],record:{id:"synthetic",name:"QA Staff",birthDate:"2000-02-29",createdAt:"2026-11-25T23:05:00Z",updatedAt:null,createdBy:null,updatedBy:null}};
  const result=staffNativeOverviewProperties(p);
  assert.equal(result.record.birthDate,"29/02/2000");assert.equal(result.record.createdAt,"26/11/2026 · 06:05");assert.equal(result.record.updatedAt,"—");
  assert.equal(result.record.createdBy,null);assert.equal(p.record.createdAt,"2026-11-25T23:05:00Z");
});
