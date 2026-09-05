export type SequencedHouseEvent = { sequence: number };

export function selectUnseenHouseEvents<T extends SequencedHouseEvent>(
  events: readonly T[],
  afterSequence: number,
  pageCursor?: number,
): { events: T[]; lastSequence: number; hasGap: boolean } {
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) throw new Error("INVALID_HOUSE_EVENT_CURSOR");
  const bySequence = new Map<number, T>();
  for (const event of events) {
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) throw new Error("INVALID_HOUSE_EVENT_SEQUENCE");
    if (event.sequence <= afterSequence || bySequence.has(event.sequence)) continue;
    bySequence.set(event.sequence, event);
  }
  const unseen = [...bySequence.values()].sort((a, b) => a.sequence - b.sequence);
  let expected = afterSequence + 1;
  let hasGap = false;
  for (const event of unseen) {
    if (event.sequence !== expected) { hasGap = true; break; }
    expected += 1;
  }
  const lastSequence = unseen.at(-1)?.sequence ?? afterSequence;
  if (pageCursor !== undefined) {
    if (!Number.isSafeInteger(pageCursor) || pageCursor < afterSequence) throw new Error("INVALID_HOUSE_EVENT_CURSOR");
    if (pageCursor > lastSequence) hasGap = true;
  }
  return { events: unseen, lastSequence, hasGap };
}

export function houseRefreshSnapshotIsCurrent(
  snapshotCursor: number,
  currentCursor: number,
  presentedSequence: number,
): boolean {
  for (const value of [snapshotCursor, currentCursor, presentedSequence]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("INVALID_HOUSE_EVENT_CURSOR");
  }
  return snapshotCursor >= Math.max(currentCursor, presentedSequence);
}

export function advanceHouseSnapshotCursor(
  snapshotCursor: number,
  currentCursor: number,
  presentedSequence: number,
): { applySnapshot: boolean; cursor: number; presentedSequence: number } {
  for (const value of [snapshotCursor, currentCursor, presentedSequence]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("INVALID_HOUSE_EVENT_CURSOR");
  }
  const floor = Math.max(currentCursor, presentedSequence);
  if (snapshotCursor < floor) {
    return { applySnapshot: false, cursor: currentCursor, presentedSequence };
  }
  return {
    applySnapshot: true,
    cursor: snapshotCursor,
    presentedSequence: Math.max(presentedSequence, snapshotCursor),
  };
}

export function houseDepartureMatchesVisit(
  learnerStudentProfileId: string,
  learnerVisitId: string,
  departureStudentProfileId: string,
  departureVisitId: string,
) {
  return learnerStudentProfileId === departureStudentProfileId && learnerVisitId === departureVisitId;
}
