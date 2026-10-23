import test from "node:test";
import assert from "node:assert/strict";
import {ownReceptionAssignments,pickupRequiresCoreVerification,RECEPTION_VNEXT_WRITE_ADMITTED} from "./tos-vnext-reception";
import type {Assignment} from "./workforce-api";
const core=(centerId:string,workDate:string,roleType:"FRONT_DESK"|"TEACHER",targetId=centerId):Assignment=>
 ({id:centerId+workDate+roleType,centerId,workDate,status:"ACTIVE",
  roleAssignments:[{roleType,targetType:"CENTER",targetId}],shift:null,
  shiftTemplateId:"tmpl",timeBasis:"SHIFT_TEMPLATE",coverageMode:"FULL_SHIFT",
  effectiveStartLocal:null,effectiveEndLocal:null,termWeekId:null});
test("PAP-942 today uses only own scoped FRONT_DESK assignments",()=>{
 const a=core("center-1","2026-10-23","FRONT_DESK"),b=core("center-2","2026-10-23","FRONT_DESK");
 const c=core("center-1","2026-10-23","TEACHER"),d=core("center-1","2026-10-24","FRONT_DESK");
 const e=core("center-1","2026-10-23","FRONT_DESK","center-other");
 assert.deepEqual(ownReceptionAssignments([a,b,c,d,e],"center-1","2026-10-23"),[a]);
});
test("PAP-942 no client-side pickup success without Core authority",()=>{
 assert.equal(RECEPTION_VNEXT_WRITE_ADMITTED,false);
 assert.equal(pickupRequiresCoreVerification(),true);
});
