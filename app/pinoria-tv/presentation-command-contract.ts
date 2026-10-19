/**
 * PAP-665 preparatory command contract. This is a pure presentation-state
 * reducer: callers must enforce permissions, persistent CAS, audit and
 * idempotency receipts before applying any returned transition.
 * It never executes domain events, purchases, rewards or other side effects.
 */
export type PresentationQueueState = {
  currentPresentationId: string | null;
  queuedPresentationIds: readonly string[];
};

export type PresentationOperatorCommand =
  | { op: "RETURN_TO_AMBIENT"; presentationId: string }
  | { op: "REPLAY_SNAPSHOT"; presentationId: string }
  | { op: "CLOSE_PRESENTATION"; presentationId: string };

export type PresentationCommandDecision =
  | { kind: "APPLY"; next: PresentationQueueState; replayPresentationId?: string }
  | { kind: "NOOP"; next: PresentationQueueState }
  | { kind: "REJECT"; reason: "INVALID_ID" | "NOT_ACTIVE" | "NOT_QUEUED" };

export function decidePresentationCommand(
  state: PresentationQueueState,
  command: PresentationOperatorCommand,
): PresentationCommandDecision {
  if (!command.presentationId.trim()) return { kind: "REJECT", reason: "INVALID_ID" };
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
    return { kind: "NOOP", next: state };
  }
  return {
    kind: "APPLY",
    next: { currentPresentationId: null, queuedPresentationIds: state.queuedPresentationIds },
  };
}