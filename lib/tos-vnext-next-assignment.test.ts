import test from "node:test";
import assert from "node:assert/strict";
import {nextConfirmedAssignment} from "./tos-vnext-next-assignment";
import type {Assignment} from "./workforce-api";
const assignment=(id:string,workDate:string,status:string,centerId="center-1",time="18:00"):Assignment=>({
 id,workDate,status,centerId,shiftTemplateId:"shift",timeBasis:"SHIFT_TEMPLATE",coverageMode:"FULL_SHIFT",
 effectiveStartLocal:null,effectiveEndLocal:null,termWeekId:null,shift:{code:"S",displayLabel:"Ca tối",startLocalTime:time,endLocalTime:"21:00"}
});
test("PAP-940 Home excludes non-ACTIVE and other-center shifts",()=>{
 const rows=[assignment("draft","2026-10-23","DRAFT"),assignment("cancel","2026-10-23","CANCELLED"),
  assignment("other","2026-10-23","ACTIVE","center-2"),assignment("old","2026-10-22","ACTIVE"),
  assignment("valid","2026-10-24","ACTIVE")];
 assert.equal(nextConfirmedAssignment(rows,"center-1","2026-10-23")?.id,"valid");
 assert.equal(nextConfirmedAssignment(rows,"center-3","2026-10-23"),null);
});
test("PAP-940 Home sorts confirmed shifts deterministically by local start",()=>{
 const rows=[assignment("later","2026-10-23","ACTIVE","center-1","19:00"),assignment("earlier","2026-10-23","ACTIVE","center-1","18:00")];
 assert.equal(nextConfirmedAssignment(rows,"center-1","2026-10-23")?.id,"earlier");
 assert.equal(nextConfirmedAssignment(rows,"center-1","2026-10-23","21:00"),null);
 assert.equal(nextConfirmedAssignment(rows,"center-1","2026-10-23","20:59")?.id,"earlier");
 const overnight={...assignment("night","2026-10-23","ACTIVE","center-1","22:00"),shift:{code:"N",displayLabel:"Ca đêm",startLocalTime:"22:00",endLocalTime:"03:00"}};
 assert.equal(nextConfirmedAssignment([overnight],"center-1","2026-10-23","11:03")?.id,"night");
 assert.equal(nextConfirmedAssignment([overnight],"center-1","2026-10-24","02:59")?.id,"night");
 const nextDay=assignment("morning","2026-10-24","ACTIVE","center-1","08:00");
 assert.equal(nextConfirmedAssignment([nextDay,overnight],"center-1","2026-10-24","02:59")?.id,"night");
 assert.equal(nextConfirmedAssignment([nextDay,overnight],"center-1","2026-10-24","03:00")?.id,"morning");
 assert.equal(nextConfirmedAssignment([overnight],"center-1","2026-10-24","03:00"),null);
 assert.equal(nextConfirmedAssignment([overnight],"center-1","2026-10-25","02:00"),null);
 const invalid={...assignment("unknown-start","2026-10-23","ACTIVE"),shift:{code:"X",displayLabel:"Ca chưa xác minh",startLocalTime:"",endLocalTime:"10:00"}};
 assert.equal(nextConfirmedAssignment([invalid],"center-1","2026-10-23","11:03")?.id,"unknown-start");
 const tied=[assignment("z","2026-10-24","ACTIVE"),assignment("a","2026-10-24","ACTIVE")];
 assert.equal(nextConfirmedAssignment(tied,"center-1","2026-10-23")?.id,"a");
 assert.equal(nextConfirmedAssignment([...tied].reverse(),"center-1","2026-10-23")?.id,"a");
 assert.equal(nextConfirmedAssignment(rows,"center-1","bad"),null);
});
