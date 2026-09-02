export type BoStudentActionIntent =
  | { kind: "add" }
  | { kind: "renew"; subscriptionId?: string }
  | { kind: "place"; subscriptionId?: string }
  | { kind: "transfer"; enrollmentId?: string };

export function initialSubscriptionId(action: BoStudentActionIntent, activeIds: string[]) {
  const requested = action.kind === "renew" || action.kind === "place" ? action.subscriptionId : undefined;
  return requested && activeIds.includes(requested) ? requested : activeIds[0] ?? "";
}

export function initialEnrollmentId(action: BoStudentActionIntent, enrollmentIds: string[]) {
  const requested = action.kind === "transfer" ? action.enrollmentId : undefined;
  return requested && enrollmentIds.includes(requested) ? requested : enrollmentIds[0] ?? "";
}

export class LatestRequestFence {
  private sequence = 0;
  begin() { return ++this.sequence; }
  isCurrent(sequence: number) { return sequence === this.sequence; }
}

export class RetryKeyStore {
  private keys = new Map<string, string>();

  getOrCreate(target: string, create: () => string) {
    const existing = this.keys.get(target);
    if (existing) return existing;
    const created = create();
    this.keys.set(target, created);
    return created;
  }

  clear(target: string) {
    this.keys.delete(target);
  }
}
