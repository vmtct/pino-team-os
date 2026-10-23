/**
 * PAP-887 follow-up: optional Team-side update transport for shared BO saved views.
 *
 * Serializes writes across modules/records, coalesces rapid changes to a view,
 * and sends only Core-versioned Manager intents. This does NOT authorize anyone
 * to write: the caller must use the PAP-887 role-aware state model and Core must
 * enforce scope/ACL/version + audit on every request.
 *
 * There is intentionally NO automatic retry after a rejected request / 409.
 */
import {
  validateBoViewConfig,
  type BoPublicView,
  type BoViewConfig,
  type BoViewWrite,
} from "./bo-public-view-state";

export type BoViewUpdateIntent = Extract<BoViewWrite, { kind: "update" }>;
export type BoViewUpdateTransport = (command: BoViewUpdateIntent) => Promise<BoPublicView>;
export type BoViewUpdateIssue = {
  id: string;
  moduleKey: string;
  kind: "version_conflict" | "rejected";
  error: unknown;
};
export type BoViewUpdateEntry = {
  id: string;
  moduleKey: string;
  expectedVersion: number;
  revision: number;
  acknowledgedRevision: number;
  status: "idle" | "pending" | "sending" | "conflict" | "failed";
};
type Entry = BoViewUpdateEntry & {
  desired: BoViewConfig;
  timer: ReturnType<typeof setTimeout> | null;
  lastError: unknown;
};
export type BoViewUpdateQueueOptions = {
  moduleKey: string;
  allowedFields: readonly string[];
  send: BoViewUpdateTransport;
  debounceMs?: number;
  onAcknowledged?: (view: BoPublicView, acknowledgedRevision: number) => void;
  onIssue?: (issue: BoViewUpdateIssue) => void;
  /** Observer errors are UI faults, never proof that the Core write failed. */
  onObserverError?: (error: unknown) => void;
};

function isConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: unknown; statusCode?: unknown; code?: unknown };
  return value.status === 409 || value.statusCode === 409 || value.code === "VERSION_CONFLICT";
}
function assertVersion(n: number): void {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("Invalid Core view version");
}
function assertId(id: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/.test(id)) throw new Error("Invalid view ID");
}
function cloneConfig(config: BoViewConfig): BoViewConfig {
  return {
    search: config.search,
    sort: config.sort ? { ...config.sort } : null,
    filters: config.filters.map(filter => ({
      ...filter,
      ...(Array.isArray(filter.value) ? { value: [...filter.value] } : {}),
      ...(Array.isArray(filter.end) ? { end: [...filter.end] } : {}),
    })),
    logic: config.logic,
    groupBy: config.groupBy,
    hideEmptyGroups: config.hideEmptyGroups,
    columns: { order: [...config.columns.order], visible: [...config.columns.visible] },
  };
}

/**
 * One queue per module/BO component instance. All requests are globally
 * single-flight, including different view IDs, to avoid in-client write races.
 * Exactly-once delivery still belongs to the Core service; a lost response
 * cannot be blindly replayed by the browser.
 */
export class BoPublicViewUpdateQueue {
  private readonly options: BoViewUpdateQueueOptions;
  private readonly entries = new Map<string, Entry>();
  private running: Promise<void> | null = null;
  private closed = false;

  constructor(options: BoViewUpdateQueueOptions) {
    if (!options.moduleKey || !Array.isArray(options.allowedFields) || !options.allowedFields.length) {
      throw new Error("Public view queue requires a module and its allowed fields");
    }
    if (!Number.isFinite(options.debounceMs ?? 120) || (options.debounceMs ?? 120) < 0 ||
      (options.debounceMs ?? 120) > 5000) {
      throw new Error("Invalid debounce interval");
    }
    this.options = options;
  }

  /** From an authorized Manager update result, never directly from Staff drafts. */
  enqueue(intent: BoViewUpdateIntent): void {
    if (this.closed) throw new Error("View queue is closed");
    if (intent.kind !== "update" || intent.moduleKey !== this.options.moduleKey) {
      throw new Error("View update module mismatch");
    }
    assertId(intent.id);
    assertVersion(intent.expectedVersion);
    const desired = validateBoViewConfig(intent.config, this.options.allowedFields);
    const prior = this.entries.get(intent.id);
    if (prior) {
      if (prior.status === "conflict" || prior.status === "failed") {
        throw new Error("Resolve current view write issue before editing shared configuration");
      }
      // Caller may be holding an old local version while a request is in flight.
      // Never lower the authoritative version already acknowledged by Core.
      if (intent.expectedVersion > prior.expectedVersion) prior.expectedVersion = intent.expectedVersion;
      prior.desired = cloneConfig(desired);
      prior.revision += 1;
      if (prior.status !== "sending") prior.status = "pending";
      this.schedule(prior);
    } else {
      const entry: Entry = {
        id: intent.id,
        moduleKey: intent.moduleKey,
        desired: cloneConfig(desired),
        expectedVersion: intent.expectedVersion,
        revision: 1,
        acknowledgedRevision: 0,
        status: "pending",
        timer: null,
        lastError: null,
      };
      this.entries.set(intent.id, entry);
      this.schedule(entry);
    }
  }

  snapshot(id: string): BoViewUpdateEntry | null {
    const entry = this.entries.get(id);
    if (!entry) return null;
    const { moduleKey, expectedVersion, revision, acknowledgedRevision, status } = entry;
    return { id, moduleKey, expectedVersion, revision, acknowledgedRevision, status };
  }

  /** Flushes pending changes without a UI timer, useful for navigation and tests. */
  async flush(): Promise<void> {
    if (this.closed) return;
    for (const entry of this.entries.values()) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = null;
    }
    if (this.running) return this.running;
    const work = this.process();
    this.running = work;
    try {
      await work;
    } finally {
      if (this.running === work) this.running = null;
    }
  }

  private observe(run: () => void): void {
    try { run(); } catch (error) {
      // Core may have committed already: do not classify an observer exception
      // as a failed request or retry the write. The UI can record this fault.
      try { this.options.onObserverError?.(error); } catch { /* non-fatal observer */ }
    }
  }

  private schedule(entry: Entry): void {
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      entry.timer = null;
      void this.flush();
    }, this.options.debounceMs ?? 120);
  }

  private async process(): Promise<void> {
    while (!this.closed) {
      const entry = [...this.entries.values()].find(value =>
        value.status !== "failed" && value.status !== "conflict" &&
        value.revision > value.acknowledgedRevision);
      if (!entry) break;

      const revision = entry.revision;
      const expectedVersion = entry.expectedVersion;
      const desired = cloneConfig(entry.desired);
      entry.status = "sending";

      try {
        const response = await this.options.send({
          kind: "update",
          moduleKey: this.options.moduleKey,
          id: entry.id,
          expectedVersion,
          config: desired,
        });
        if (response.id !== entry.id || response.moduleKey !== this.options.moduleKey ||
          !Number.isSafeInteger(response.version) || response.version <= expectedVersion) {
          throw new Error("Core acknowledgement does not match versioned view intent");
        }
        if (this.closed) return;
        entry.expectedVersion = response.version;
        entry.acknowledgedRevision = revision;
        entry.lastError = null;
        entry.status = entry.revision > revision ? "pending" : "idle";
        this.observe(() => this.options.onAcknowledged?.(response, revision));
      } catch (error) {
        if (this.closed) return;
        const kind = isConflict(error) ? "version_conflict" : "rejected";
        entry.lastError = error;
        entry.status = kind === "version_conflict" ? "conflict" : "failed";
        this.observe(() => this.options.onIssue?.({ id: entry.id, moduleKey: this.options.moduleKey, kind, error }));
        // Do not retry. Other view IDs may proceed independently.
      }
    }
  }

  /** Explicit action after showing the server's conflict to the Manager. */
  resolveConflict(input: {
    id: string;
    serverVersion: number;
    action: "discard" | "reapply";
  }): void {
    if (this.closed) throw new Error("View queue is closed");
    assertVersion(input.serverVersion);
    const entry = this.entries.get(input.id);
    if (!entry || entry.status !== "conflict") throw new Error("View is not waiting for a 409 resolution");
    entry.expectedVersion = input.serverVersion;
    entry.lastError = null;
    if (input.action === "discard") {
      entry.acknowledgedRevision = entry.revision;
      entry.status = "idle";
    } else if (input.action === "reapply") {
      entry.status = "pending";
      this.schedule(entry);
    } else {
      throw new Error("Invalid conflict resolution");
    }
  }

  /** Explicit action for a transport/network failure; no automatic retry. */
  retryRejected(id: string): void {
    if (this.closed) throw new Error("View queue is closed");
    const entry = this.entries.get(id);
    if (!entry || entry.status !== "failed") throw new Error("View has no rejected update");
    entry.lastError = null;
    entry.status = "pending";
    this.schedule(entry);
  }

  dispose(): void {
    this.closed = true;
    for (const entry of this.entries.values()) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = null;
    }
  }
}
