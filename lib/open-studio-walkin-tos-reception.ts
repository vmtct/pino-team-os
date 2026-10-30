import type { Assignment, TimekeepingSession } from "./workforce-api";
import type { WalkinLookup } from "./open-studio-walkin-tos-api";
import { ownReceptionAssignments } from "./tos-vnext-reception";

/** PAP-1166: selector only; Core independently verifies the timekeeping session and entitlement. */
export function currentReceptionSession(
  assignments: readonly Assignment[],
  session: TimekeepingSession | null,
  centerId: string,
  workDate: string,
): TimekeepingSession | null {
  if (!session || !centerId || session.centerId !== centerId || session.workDate !== workDate
    || session.status !== "OPEN" || session.checkOutAt !== null) return null;
  const authorized = ownReceptionAssignments(assignments, centerId, workDate);
  if (!session.assignmentId || !authorized.some(a => a.id === session.assignmentId)) return null;
  return session;
}

export const WALKIN_PATHS = ["AC", "LPP", "LPA", "PH"] as const;

export function isConsumableWalkinLookup(lookup: WalkinLookup | null): boolean {
  if (!lookup) return false;
  const { pass } = lookup;
  return pass.status === "ASSIGNED" && Boolean(pass.parent_user_id)
    && Boolean(pass.code) && WALKIN_PATHS.some(path => path === pass.path_code);
}

/** Linked child is the default. Explicit manual fallback never impersonates a linked CRM Student. */
export function defaultWalkinStudentSelection(lookup: WalkinLookup): string {
  return lookup.students[0]?.id ?? "__manual__";
}
