export type FounderAssignmentView = {
  roleKey: string;
  roleStatus?: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
};

export function hasEffectiveFounderAssignment(
  assignments: FounderAssignmentView[],
  now = Date.now(),
): boolean {
  return assignments.some((assignment) => {
    if (assignment.roleKey !== "founder" || (assignment.roleStatus ?? "active") !== "active") return false;
    const from = Date.parse(assignment.effectiveFrom);
    if (!Number.isFinite(from) || from > now) return false;
    if (assignment.effectiveUntil === null) return true;
    const until = Date.parse(assignment.effectiveUntil);
    return Number.isFinite(until) && until > now;
  });
}

export function canManageFounderTarget(
  actorUserId: string,
  targetUserId: string,
  actorIsFounder: boolean,
): boolean {
  return actorIsFounder && Boolean(actorUserId) && actorUserId !== targetUserId;
}
