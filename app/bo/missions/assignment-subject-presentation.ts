/** PAP-2425 / MISSION-ASSIGNMENT: local M1 presentation contract, not authorization or a Core writer. */
import { missionCategories, isMissionCategory, type MissionCategory } from "../../ho/learning/missions/mission-category";

export const assignmentCategoryOptions = missionCategories;
export type AssignmentSubject = Readonly<{ kind: "Student" | "Staff" | "MyTime participant"; displayName: string | null }>;
export type AssignmentPresentation = Readonly<{
  category: MissionCategory | null;
  subject: AssignmentSubject;
  status: "ASSIGNED" | "CANCELLED";
  execution: "IN_PROGRESS" | "COMPLETED" | null;
}>;
export type AssignmentCategoryFilter = MissionCategory | "ALL" | "UNCLASSIFIED";

export function presentCategory(value: unknown): MissionCategory | null {
  return isMissionCategory(value) ? value : null;
}

export function matchesAssignmentCategory(row: AssignmentPresentation, filter: AssignmentCategoryFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "UNCLASSIFIED") return row.category === null;
  return row.category === filter;
}

/** Missing display name never falls back to opaque identity. No inferred category from subject type. */
export function assignmentSubjectLabel(row: AssignmentPresentation): string {
  return row.subject.displayName?.trim() || "—";
}

/** Presentation hints only: actual action admission and subject-specific eligibility remain Core-owned.
 * MyTime identity/eligibility remains unresolved and is not offered as a command. */
export function assignmentPresentationScope(row: AssignmentPresentation) {
  const classroom = row.subject.kind === "Student" &&
    (row.category === null || row.category === "PINO Afterschool");
  const staffTraining = row.subject.kind === "Staff" && row.category === "Staff Training";
  const active = row.status === "ASSIGNED";
  return {
    classroom,
    staffTraining,
    showDiary: classroom,
    showResults: classroom,
    showCompletionProposal: staffTraining && active && row.execution === "IN_PROGRESS",
    showReopenProposal: (classroom || staffTraining) && active && row.execution === "COMPLETED",
  };
}
