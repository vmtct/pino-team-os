import type { BoWorkforceAssignment } from "@/lib/bo-model";

// Scoped BO read extension while the shared HO/BO model is owned by PAP-1067.
// Core owns the persisted optional note contract (PAP-1111, migration 0145).
export function workforceAssignmentNote(assignment: BoWorkforceAssignment | undefined): string | null {
  const note = (assignment as (BoWorkforceAssignment & { note?: unknown }) | undefined)?.note;
  return typeof note === "string" ? note : null;
}
