import type {StaffDutyBoard} from "./workforce-api";
/** PAP-944: readonly self-duty summary, not a station-wide manager projection. */
export function ownShiftLeadDutySummary(board:StaffDutyBoard){
 const pending=board.duties.filter(d=>d.status==="PENDING"||d.status==="BLOCKED");
 const blocked=pending.filter(d=>d.blocking);
 return {
  dutyCount:board.duties.length,
  pendingCount:pending.length,
  blockingCount:blocked.length,
  checkoutAllowed:board.gate.allowed&&board.gate.blockers.length===0&&board.gate.unavailableSources.length===0,
  checkoutGateMode:board.gate.mode,
  unavailableSources:[...board.gate.unavailableSources],
 };
}
export const SHIFT_LEAD_STATION_WIDE_WRITES_ADMITTED=false;
