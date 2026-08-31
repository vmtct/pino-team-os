export type SequencedHouseEvent = { sequence: number };

export function selectUnseenHouseEvents<T extends SequencedHouseEvent>(
  events: readonly T[],
  afterSequence: number,
): { events: T[]; lastSequence: number } {
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) throw new Error("INVALID_HOUSE_EVENT_CURSOR");
  const bySequence = new Map<number, T>();
  for (const event of events) {
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) throw new Error("INVALID_HOUSE_EVENT_SEQUENCE");
    if (event.sequence <= afterSequence || bySequence.has(event.sequence)) continue;
    bySequence.set(event.sequence, event);
  }
  const unseen = [...bySequence.values()].sort((a, b) => a.sequence - b.sequence);
  return {
    events: unseen,
    lastSequence: unseen.at(-1)?.sequence ?? afterSequence,
  };
}
