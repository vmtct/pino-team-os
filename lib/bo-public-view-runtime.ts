/**
 * PAP-924 — BO public Saved Views orchestration (no React/DOM coupling).
 *
 * Combines PAP-887 state/queue/Core client into one durable action boundary.
 * A UI owns its lifecycle and subscribes for state; Core owns auth, versions,
 * audit and every persisted definition. No personal views and no blind retry.
 */
import {
  createBoPublicView, defaultBoViewConfig, deleteBoPublicView, editBoViewConfig,
  loadBoPublicViews, renameBoPublicView, reorderBoPublicViews, selectBoPublicView,
  acknowledgeBoPublicView, conflictBoPublicView, discardBoViewConflict,
  type BoPublicView, type BoViewConfig, type BoViewState,
} from "./bo-public-view-state";
import { BoPublicViewCoreClient, BoPublicViewHttpError } from "./bo-public-view-core-client";
import { BoPublicViewUpdateQueue, type BoViewUpdateIssue } from "./bo-public-view-update-queue";

export type BoPublicViewRuntimeStatus = "unloaded" | "loading" | "ready" | "mutating" | "error";
export type BoPublicViewRuntimeSnapshot = {
  state: BoViewState | null;
  status: BoPublicViewRuntimeStatus;
  error: { kind: "version_conflict" | "rejected" | "unauthorized" | "synchronization"; message: string } | null;
};
export type BoPublicViewRuntimeOptions = {
  moduleKey: string;
  allowedFields: readonly string[];
  role: "manager" | "staff";
  client: Pick<BoPublicViewCoreClient, "list" | "create" | "update" | "rename" | "remove" | "reorder">;
  debounceMs?: number;
};

type Listener = (snapshot: BoPublicViewRuntimeSnapshot) => void;
const copy = (state: BoPublicViewStateInternal): BoPublicViewRuntimeSnapshot => ({
  // Snapshots are detached so a consumer cannot corrupt our internal state.
  state: state.state ? structuredClone(state.state) : null,
  status: state.status,
  error: state.error ? { ...state.error } : null,
});
type BoPublicViewStateInternal = {
  state: BoViewState | null;
  status: BoPublicViewRuntimeStatus;
  error: BoPublicViewRuntimeSnapshot["error"];
};
function issueToError(error: unknown): NonNullable<BoPublicViewRuntimeSnapshot["error"]> {
  if (error instanceof BoPublicViewHttpError) {
    return { kind: error.status === 409 ? "version_conflict" :
      error.status === 401 || error.status === 403 ? "unauthorized" : "rejected",
      message: error.message };
  }
  return { kind: "rejected", message: error instanceof Error ? error.message : "Public view write was rejected" };
}
function assertLoaded(state: BoViewState | null): BoViewState {
  if (!state) throw new Error("Load shared views before operating");
  return state;
}
function assertManager(state: BoViewState): void {
  if (state.role !== "manager") throw new Error("Only a BO Manager can change shared views");
}
function sameModule(view: BoPublicView, moduleKey: string): boolean { return view.moduleKey === moduleKey; }

export class BoPublicViewRuntime {
  private readonly options: BoPublicViewRuntimeOptions;
  private readonly observers = new Set<Listener>();
  private readonly queue: BoPublicViewUpdateQueue;
  private snapshotData: BoPublicViewStateInternal = { state: null, status: "unloaded", error: null };
  private commandActive = false;
  private disposed = false;
  private loadNumber = 0;
  private nextLocalId = 0;

  constructor(options: BoPublicViewRuntimeOptions) {
    if (!options.allowedFields.length) throw new Error("Missing module schema");
    if (!options.moduleKey) throw new Error("Missing module");
    this.options = { ...options, allowedFields: [...options.allowedFields] };
    this.queue = new BoPublicViewUpdateQueue({
      moduleKey: options.moduleKey,
      allowedFields: options.allowedFields,
      send: write => options.client.update(write),
      debounceMs: options.debounceMs,
      onAcknowledged: (view) => {
        if (this.disposed || !this.snapshotData.state || !sameModule(view,options.moduleKey)) return;
        this.set({state: acknowledgeBoPublicView(this.snapshotData.state, view, options.allowedFields)});
      },
      onIssue: issue => { void this.handleQueueIssue(issue); },
      onObserverError: error => this.set({ error: issueToError(error) }),
    });
  }
  getSnapshot(): BoPublicViewRuntimeSnapshot { return copy(this.snapshotData); }
  subscribe(listener: Listener): () => void {
    if (this.disposed) throw new Error("Runtime disposed");
    this.observers.add(listener);
    return () => { this.observers.delete(listener); };
  }
  private set(partial: Partial<BoPublicViewStateInternal>): void {
    if (this.disposed) return;
    this.snapshotData = { ...this.snapshotData, ...partial };
    const current = this.getSnapshot();
    for (const fn of this.observers) {
      try { fn(current); } catch { /* UI observer must not affect Core write receipts. */ }
    }
  }
  private requireAlive(): void { if (this.disposed) throw new Error("Runtime disposed"); }
  private idle(): void {
    this.requireAlive();
    if (this.commandActive || this.snapshotData.status === "loading") {
      throw new Error("Another public view command is in progress");
    }
  }
  private selected(): string | null { return this.snapshotData.state?.activeId ?? null; }

  /** A read-only refresh always uses Core as canonical list; selected tab is kept when still available. */
  async load(selectedId?: string | null): Promise<BoPublicViewRuntimeSnapshot> {
    this.idle();
    const serial = ++this.loadNumber;
    this.set({ status: "loading", error: null });
    try {
      const rows = await this.options.client.list();
      if (this.disposed || serial !== this.loadNumber) return this.getSnapshot();
      const wanted = selectedId === undefined ? this.selected() : selectedId;
      const valid = wanted && rows.some(x=>x.id===wanted) ? wanted : null;
      const state = loadBoPublicViews({ moduleKey: this.options.moduleKey,
        role: this.options.role, allowedFields: this.options.allowedFields,
        views: rows, selectedId: valid });
      this.set({state,status:"ready",error:null});
      return this.getSnapshot();
    } catch (error) {
      this.set({status:"error",error:issueToError(error)});
      throw error;
    }
  }

  select(id: string | null): void {
    this.idle();
    this.set({state:selectBoPublicView(assertLoaded(this.snapshotData.state),id,this.options.allowedFields).state,
      error:null});
  }
  /** Does not emit a Core write when Staff or editing the unsaved All view. */
  edit(config: BoViewConfig): void {
    this.idle();
    const change=editBoViewConfig(assertLoaded(this.snapshotData.state),config,this.options.allowedFields);
    if (change.write?.kind==="update") this.queue.enqueue(change.write);
    this.set({state:change.state,error:null});
  }
  async flush(): Promise<void> {
    this.requireAlive();
    await this.queue.flush();
  }

  private async handleQueueIssue(issue:BoViewUpdateIssue): Promise<void> {
    if (this.disposed) return;
    if (issue.kind!=="version_conflict") {
      this.set({error:issueToError(issue.error)});
      return;
    }
    this.set({error:{kind:"version_conflict",message:"Shared view changed on another device; resolve before saving"}});
    try {
      const rows=await this.options.client.list();
      const remote=rows.find(row=>row.id===issue.id);
      if (this.disposed || !remote || !this.snapshotData.state) return;
      this.set({state:conflictBoPublicView(this.snapshotData.state,remote,this.options.allowedFields)});
    } catch {
      // Failure to fetch server version must not clear the 409 hold.
    }
  }

  async resolveUpdateConflict(action:"discard" | "reapply"):Promise<void> {
    this.requireAlive();
    const conflict=this.snapshotData.state?.conflict;
    if (!conflict) throw new Error("No view conflict to resolve");
    this.queue.resolveConflict({id:conflict.viewId,serverVersion:conflict.server.version,action});
    if (action==="discard") {
      this.set({state:discardBoViewConflict(assertLoaded(this.snapshotData.state)),error:null});
    } else {
      const current=assertLoaded(this.snapshotData.state);
      this.set({state:{...current, conflict:null},error:null});
    }
  }

  /**
   * Non-update writes are serialized against pending update writes, avoiding
   * stale expectedVersion and ordering races. Network ambiguity is surfaced —
   * callers MUST NOT silently retry creates/deletes after an unknown response.
   */
  private async mutate<T>(command:()=>Promise<T>):Promise<T> {
    this.idle();
    assertManager(assertLoaded(this.snapshotData.state));
    this.commandActive=true;
    this.set({status:"mutating",error:null});
    try {
      await this.queue.flush();
      const conflicts=this.snapshotData.state?.conflict;
      if (conflicts) throw new Error("Resolve update conflict before changing view structure");
      const result=await command();
      this.set({status:"ready",error:null});
      return result;
    } catch (error) {
      this.set({status:"ready",error:issueToError(error)});
      throw error;
    } finally { this.commandActive=false; }
  }
  /** Core assigns the durable view ID; transient local ID never escapes to persistence. */
  create(name:string):Promise<BoPublicView> {
    return this.mutate(async()=>{
      const before=assertLoaded(this.snapshotData.state);
      const provisional="temp-"+(++this.nextLocalId);
      const planned=createBoPublicView(before,{id:provisional,name});
      const write=planned.write;
      if (!write || write.kind!=="create") throw new Error("Create view did not produce a persistence intent");
      const created=await this.options.client.create(write);
      // Prefer verified server list after mutation, with Core ID now selected.
      await this.refreshAfterMutation(created.id);
      return created;
    });
  }
  rename(id:string,name:string):Promise<BoPublicView> {
    return this.mutate(async()=>{
      const planned=renameBoPublicView(assertLoaded(this.snapshotData.state),id,name);
      const write=planned.write;
      if (!write || write.kind!=="rename") return assertLoaded(this.snapshotData.state).views.find(x=>x.id===id)!;
      const changed=await this.options.client.rename(write);
      await this.refreshAfterMutation(this.selected());
      return changed;
    });
  }
  remove(id:string):Promise<void> {
    return this.mutate(async()=>{
      const planned=deleteBoPublicView(assertLoaded(this.snapshotData.state),id,this.options.allowedFields);
      if (planned.write?.kind!=="delete") throw new Error("Delete view did not produce an intent");
      await this.options.client.remove(planned.write);
      await this.refreshAfterMutation(this.selected()===id?null:this.selected());
    });
  }
  reorder(ids:readonly string[]):Promise<void> {
    return this.mutate(async()=>{
      const planned=reorderBoPublicViews(assertLoaded(this.snapshotData.state),ids);
      if (planned.write?.kind!=="reorder") return;
      await this.options.client.reorder(planned.write);
      await this.refreshAfterMutation(this.selected());
    });
  }
  private async refreshAfterMutation(id:string|null):Promise<void> {
    const rows=await this.options.client.list();
    if (this.disposed) return;
    this.set({state:loadBoPublicViews({
      moduleKey:this.options.moduleKey,role:this.options.role,allowedFields:this.options.allowedFields,
      views:rows,selectedId:id && rows.some(v=>v.id===id)?id:null,
    })});
  }
  dispose():void {
    if (this.disposed) return;
    this.disposed=true;
    this.queue.dispose();
    this.observers.clear();
  }
}
