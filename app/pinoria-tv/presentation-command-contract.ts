/**
 * PAP-665 preparatory command contract. This is a pure presentation-state
 * reducer: callers must enforce permissions, persistent CAS, audit and
 * idempotency receipts before applying any returned transition.
 * It never executes domain events, purchases, rewards or other side effects.
 */
export type PresentationQueueState = {
  currentPresentationId: string | null;
  /** Persisted queue revision, incremented atomically by Core. */
  revision: number;
  queuedPresentationIds: readonly string[];
  /** IDs proven completed by canonical persistent receipts, not mere absence. */
  completedPresentationIds?: readonly string[];
};

export type PresentationOperatorCommand =
  | { op: "RETURN_TO_AMBIENT"; presentationId: string; expectedRevision: number }
  | { op: "REPLAY_SNAPSHOT"; presentationId: string; expectedRevision: number }
  | { op: "CLOSE_PRESENTATION"; presentationId: string; expectedRevision: number };

export type PresentationCommandDecision =
  | { kind: "APPLY"; next: PresentationQueueState; replayPresentationId?: string }
  | { kind: "NOOP"; next: PresentationQueueState }
  | { kind: "REJECT"; reason: "INVALID_ID" | "NOT_ACTIVE" | "STALE_REVISION" };

export function decidePresentationCommand(
  state: PresentationQueueState,
  command: PresentationOperatorCommand,
): PresentationCommandDecision {
  if (!command.presentationId.trim()) return { kind: "REJECT", reason: "INVALID_ID" };
  if (!Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0 ||
      command.expectedRevision !== state.revision) {
    return { kind: "REJECT", reason: "STALE_REVISION" };
  }
  const active = state.currentPresentationId === command.presentationId;
  if (command.op === "REPLAY_SNAPSHOT") {
    if (!active) {
      return { kind: "REJECT", reason: "NOT_ACTIVE" };
    }
    // Only the active singleton can replay; queued events must not leapfrog.
    // A replay is only the immutable snapshot. It does not dequeue/claim the
    // event, trigger original domain effects, or mutate the active singleton.
    return { kind: "APPLY", next: state, replayPresentationId: command.presentationId };
  }
  if (!active) {
    // Repeated close/return after a successful completion is safe, but an
    // unrelated queued presentation must never be closed by accident.
    if (state.currentPresentationId !== null || state.queuedPresentationIds.includes(command.presentationId)) {
      return { kind: "REJECT", reason: "NOT_ACTIVE" };
    }
    return state.completedPresentationIds?.includes(command.presentationId)
      ? { kind: "NOOP", next: state }
      : { kind: "REJECT", reason: "NOT_ACTIVE" };
  }
  if (state.revision === Number.MAX_SAFE_INTEGER) return { kind: "REJECT", reason: "STALE_REVISION" };
  return {
    kind: "APPLY",
    next: {
      ...state,
      currentPresentationId: null,
      revision: state.revision + 1,
      completedPresentationIds: [...new Set([...(state.completedPresentationIds ?? []), command.presentationId])],
    },
  };
}