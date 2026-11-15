export type SequencedHouseEvent = { sequence: number };

// House event pages carry JSON values. Object property order is immaterial.
function sameEventPayload(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length
      && a.every((value, index) => sameEventPayload(value, b[index]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(right, key) && sameEventPayload(left[key], right[key]));
}


export function selectUnseenHouseEvents<T extends SequencedHouseEvent>(
  events: readonly T[],
  afterSequence: number,
  pageCursor?: number,
): { events: T[]; lastSequence: number; hasGap: boolean } {
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) throw new Error("INVALID_HOUSE_EVENT_CURSOR");
  const bySequence = new Map<number, T>();
  let hasGap = false;
  for (const event of events) {
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) throw new Error("INVALID_HOUSE_EVENT_SEQUENCE");
    if (event.sequence <= afterSequence) continue;
    const previous = bySequence.get(event.sequence);
    if (previous !== undefined) {
      if (!sameEventPayload(previous, event)) hasGap = true;
      continue;
    }
    bySequence.set(event.sequence, event);
  }
  const unseen = [...bySequence.values()].sort((a, b) => a.sequence - b.sequence);
  let expected = afterSequence + 1;
  for (const event of unseen) {
    if (event.sequence !== expected) { hasGap = true; break; }
    expected += 1;
  }
  const lastSequence = unseen.at(-1)?.sequence ?? afterSequence;
  if (pageCursor !== undefined) {
    if (!Number.isSafeInteger(pageCursor) || pageCursor < afterSequence) throw new Error("INVALID_HOUSE_EVENT_CURSOR");
    if (pageCursor !== lastSequence) hasGap = true;
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

export function housePresenceSceneIsCurrent(
  kind: "arrival" | "departure",
  sameActorPresent: boolean,
  matchingSourcePresent: boolean,
): boolean {
  return kind === "arrival" ? matchingSourcePresent : !sameActorPresent || matchingSourcePresent;
}
