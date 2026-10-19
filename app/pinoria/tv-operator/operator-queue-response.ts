/** The visible Center and request generation must still match before accepting any result. */
export function isCurrentOperatorQueueResponse(
  requestedCenter: string,
  requestedGeneration: number,
  visibleCenter: string,
  currentGeneration: number,
): boolean {
  return requestedCenter === visibleCenter &&
    requestedGeneration === currentGeneration;
}

/** Reject a snapshot whose claim token no longer matches the inspected singleton. */
export function matchesInspectedPresentation(
  active: { id: string; claimedAt: string },
  inspected: { id: string; claimedAt: string },
): boolean {
  return active.id === inspected.id &&
    active.claimedAt === inspected.claimedAt;
}