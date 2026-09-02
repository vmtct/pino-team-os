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

export type RequestTicket = { sequence: number; target: string };
export class LatestRequestFence {
  private sequence = 0;
  begin(target: string): RequestTicket { return { sequence: ++this.sequence, target }; }
  invalidate() { this.sequence += 1; }
  isCurrent(ticket: RequestTicket, currentTarget: string | null) {
    return ticket.sequence === this.sequence && ticket.target === currentTarget;
  }
}
export async function collectPagedDirectory<T extends { id: string }>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  pageSize = 200,
  maxPages = 100,
): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < maxPages; page += 1) {
    const batch = await fetchPage(rows.length, pageSize);
    if (batch.length > pageSize) throw new Error("Learner directory page exceeded its requested bound.");
    for (const row of batch) {
      if (seen.has(row.id)) throw new Error("Learner directory pagination did not advance.");
      seen.add(row.id);
      rows.push(row);
    }
    if (batch.length < pageSize) return rows;
  }
  throw new Error("Learner directory exceeded the supported pagination safety bound.");
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export class RetryKeyStore {
  private keys = new Map<string, string>();
  constructor(private readonly storage?: StorageLike, private readonly namespace = "pino.bo.students.retry.") {}
  getOrCreate(target: string, create: () => string) {
    const memory = this.keys.get(target);
    if (memory) return memory;
    const persisted = this.read(target);
    if (persisted) { this.keys.set(target, persisted); return persisted; }
    const created = create();
    this.keys.set(target, created);
    this.write(target, created);
    return created;
  }

  clear(target: string) {
    this.keys.delete(target);
    try { this.storage?.removeItem(this.namespace + target); } catch { /* storage is best-effort */ }
  }

  private read(target: string) {
    try { return this.storage?.getItem(this.namespace + target) ?? null; } catch { return null; }
  }

  private write(target: string, value: string) {
    try { this.storage?.setItem(this.namespace + target, value); } catch { /* storage is best-effort */ }
  }
}

export type ReplayContext = { idempotencyKey: string; commandEffectiveLocalDate: string; policyEffectiveAt: string };
export function replayContext(
  store: RetryKeyStore,
  target: string,
  createKey: () => string,
  createDate: () => string,
  createInstant: () => string,
): ReplayContext {
  return {
    idempotencyKey: store.getOrCreate(`key:${target}`, createKey),
    commandEffectiveLocalDate: store.getOrCreate(`date:${target}`, createDate),
    policyEffectiveAt: store.getOrCreate(`instant:${target}`, createInstant),
  };
}

export function clearReplayContext(store: RetryKeyStore, target: string) {
  store.clear(`key:${target}`);
  store.clear(`date:${target}`);
  store.clear(`instant:${target}`);
}
