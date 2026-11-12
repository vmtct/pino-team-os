// PAP-1924 (Epic PAP-1676 — MISSION ASSIGNMENT is keeping):
// Business TDD slots receive recordProjection's display-only record. Hidden
// Center must NOT be read from that record. The authorized BO context is the
// trusted selected-Center scope; the BFF and Core validate each actual read.
import type { AuthorizationContext } from "./workspace-schema";
import { assignmentUuid } from "./bo-mission-assignments";

export function canReadMissionProjectedSlot(context: AuthorizationContext, assignmentId: string): boolean {
  return context.surface === "BO" &&
    assignmentUuid.test(context.centerId) &&
    assignmentUuid.test(assignmentId) &&
    context.authorize("student.mission_assignment.view");
}
