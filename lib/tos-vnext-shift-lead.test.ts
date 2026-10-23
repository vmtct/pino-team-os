import test from "node:test";
import assert from "node:assert/strict";
import {ownShiftLeadDutySummary,SHIFT_LEAD_STATION_WIDE_WRITES_ADMITTED} from "./tos-vnext-shift-lead";
import type {StaffDutyBoard} from "./workforce-api";
const board={
 staffMemberId:"self",centerId:"center-1",workDate:"2026-10-23",briefing:null,acknowledgement:null,
 duties:[{obligationId:"o1",action:"CHECK_OUT",kind:"EVIDENCE",type:"photo",sourceDomain:"TOS",
  sourceRef:"r1",status:"BLOCKED",blocking:true,requiredBy:"CHECK_OUT"}],
 gate:{action:"CHECK_OUT",mode:"ENFORCED",allowed:false,obligations:[],blockers:[{code:"EVIDENCE_REQUIRED",sourceDomain:"TOS"}],unavailableSources:["MEDIA"]},
 checkoutException:null
} as StaffDutyBoard;
test("PAP-944 keeps Core blockers and source unavailability visible",()=>{
 const s=ownShiftLeadDutySummary(board);
 assert.deepEqual({pending:s.pendingCount,blocked:s.blockingCount,allowed:s.checkoutAllowed},{
  pending:1,blocked:1,allowed:false});
 assert.deepEqual(s.unavailableSources,["MEDIA"]);
});
test("PAP-944 does not infer station-wide closeout authority from self-duty gate",()=>{
 const permitted={...board,gate:{...board.gate,allowed:true,blockers:[],unavailableSources:[]}} as StaffDutyBoard;
 assert.equal(ownShiftLeadDutySummary(permitted).checkoutAllowed,true);
 assert.equal(SHIFT_LEAD_STATION_WIDE_WRITES_ADMITTED,false);
});
