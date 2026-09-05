import type { StaffDutyBoard } from "./workforce-api";
import { dutyIsResolved } from "./wfm-duty-ui";

export function closeoutGuidanceState(board: StaffDutyBoard | null) {
  if (!board || board.gate.action !== "CHECK_OUT") {
    return { ready: false, ambiguous: true, outstanding: [] } as const;
  }
  const outstanding = board.duties.filter((duty) => !dutyIsResolved(duty));
  const ambiguous = board.gate.unavailableSources.length > 0
    || board.gate.blockers.some((blocker) => blocker.code !== "UNRESOLVED_OBLIGATION");
  return {
    ready: !ambiguous && outstanding.length === 0,
    ambiguous,
    outstanding,
  };
}
