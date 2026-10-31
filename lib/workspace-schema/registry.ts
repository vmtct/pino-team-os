import { isFieldValue, type FieldSchema, type FieldKey } from "./fields";
import type { Approval, AuthorizationContext, BusinessSlot, CompatibilityScreen, HistoryResult, HistorySubject, ModuleSchema } from "./schema";
import { allows, allowsField, validateApproval, validateModule } from "./validate";
import type { TddActionDescriptor } from "./schema";

/** Snapshot at admission: later author mutations cannot change a registered contract. */
function snapshot<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(snapshot)) as T;
  if (value && typeof value === "object") return Object.freeze(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, snapshot(v)]))) as T;
  return value;
}
export function defineTddModule<const F extends readonly FieldSchema[]>(module: ModuleSchema<F>): ModuleSchema<F> {
  validateModule(module);
  return snapshot(module);
}
export type ComposedTab<K extends string> =
  | { readonly owner: "system"; readonly id: "overview"; readonly label: "Tổng quan" }
  | { readonly owner: "business"; readonly slot: BusinessSlot<K>; readonly id: string; readonly label: string }
  | { readonly owner: "system"; readonly id: "history"; readonly label: "Lịch sử" };
export function composeTabs<F extends readonly FieldSchema[]>(module: ModuleSchema<F>): readonly ComposedTab<FieldKey<F>>[] {
  validateModule(module);
  return snapshot([
    { owner: "system", id: "overview", label: "Tổng quan" },
    ...module.detail.businessTabs.map(slot => ({ owner: "business" as const, id: slot.id, label: slot.label, slot })),
    { owner: "system", id: "history", label: "Lịch sử" },
  ] as ComposedTab<FieldKey<F>>[]);
}
/** Permission filtering never removes the visible system History tab. */
export function authorizedTabs<F extends readonly FieldSchema[]>(module: ModuleSchema<F>, context: AuthorizationContext) {
  if (!allows(module, context, "read")) return [];
  return composeTabs(module).filter(tab => tab.owner === "system" || context.authorize(tab.slot.source.permission));
}
export async function loadHistory(module: ModuleSchema, subject: HistorySubject, context: AuthorizationContext, signal: AbortSignal, cursor: string | null = null): Promise<HistoryResult> {
  validateModule(module);
  if (!allows(module, context, "read")) return { status: "denied" };
  const binding = module.detail.history;
  if (binding.kind === "unavailable") return { status: "unavailable", reason: binding.reason };
  if (!allows(module, context, "history") || !context.authorize(binding.source.permission)) return { status: "denied" };
  if (!subject.id.trim() || !subject.type.trim()) throw Error("TDD contract: invalid history subject");
  signal.throwIfAborted();
  const result = await binding.load(subject, context, cursor, signal);
  signal.throwIfAborted();
  if (result.status === "denied") {
    if (Object.keys(result).some(k => k !== "status")) throw Error("TDD contract: denied history payload");
    return { status: "denied" };
  }
  if (result.status === "unavailable") {
    if (typeof result.reason !== "string" || !result.reason.trim() || Object.keys(result).some(k => !["status", "reason"].includes(k))) throw Error("TDD contract: invalid unavailable history");
    return { status: "unavailable", reason: result.reason };
  }
  if (result.status !== "authorized" || !Array.isArray(result.events) || !(result.nextCursor === null || (typeof result.nextCursor === "string" && result.nextCursor.length > 0)) || Object.keys(result).some(k => !["status", "events", "nextCursor"].includes(k))) throw Error("TDD contract: invalid history response");
  const ids = new Set<string>();
  for (const event of result.events) {
    if (!event || Object.keys(event).some(k => !["id", "at", "actor", "action", "outcome", "source", "subject", "redacted", "changes"].includes(k)) ||
      !event.subject || Object.keys(event.subject).some(k => !["type", "id"].includes(k)) || event.subject.id !== subject.id || event.subject.type !== subject.type ||
      ![event.id, event.actor, event.action, event.source].every(v => typeof v === "string" && v.trim()) || ids.has(event.id) ||
      typeof event.at !== "string" || !Number.isFinite(Date.parse(event.at)) || event.redacted !== true || !["succeeded", "failed", "denied"].includes(event.outcome)) throw Error("TDD contract: unauthorized or malformed history event");
    ids.add(event.id);
    if (event.changes !== undefined) {
      if (!Array.isArray(event.changes)) throw Error("TDD contract: invalid history diff");
      const seen = new Set<string>();
      for (const change of event.changes) {
        const field = module.fields.find(f => f.key === change?.field);
        if (!change || Object.keys(change).some(k => !["field", "before", "after"].includes(k)) ||
          !Object.hasOwn(change, "before") || !Object.hasOwn(change, "after") || change.before === undefined || change.after === undefined || !field || seen.has(field.key) ||
          !allowsField(module, context, field.key, "display") ||
          (field.sensitive && (change.before !== null || change.after !== null)) ||
          !isFieldValue(field.type, change.before) || !isFieldValue(field.type, change.after)) throw Error("TDD contract: unauthorized history diff");
        seen.add(field.key);
      }
    }
  }
  return snapshot(result);
}

export type ApprovalVerifier = (approval: Approval, scope: { readonly surface: "BO" | "HO"; readonly key: string; readonly route?: string; readonly extensionId?: string }) => boolean;
/** Heterogeneous lookup exposes metadata; use register's typed return for data calls. */
export type RegisteredModule = Omit<ModuleSchema, "data"> & { readonly data: unknown };
export type LegacyVerifier = (screen: Extract<CompatibilityScreen, { readonly classification: "GRANDFATHERED" }>) => boolean;
/** Registry is opt-in. It does not scan API fields, routes, files or deployed modules. */
export class TddRegistry {
  readonly version = 1;
  private readonly entries = new Map<string, RegisteredModule | CompatibilityScreen>();
  constructor(private readonly verifyApproval: ApprovalVerifier = () => false, private readonly verifyLegacy: LegacyVerifier = () => false) {}
  register<const F extends readonly FieldSchema[]>(module: ModuleSchema<F>): ModuleSchema<F> {
    const admitted = defineTddModule(module);
    for (const slot of admitted.detail.businessTabs) {
      if (slot.kind === "approved-extension" && !this.verifyApproval(slot.approval, { surface: admitted.surface, key: admitted.key, extensionId: slot.extensionId })) throw Error("TDD contract: extension approval not verified");
    }
    this.add(admitted);
    return admitted;
  }
  registerCompatibility(screen: CompatibilityScreen): CompatibilityScreen {
    const common = ["classification", "key", "surface", "route"];
    const required = screen.classification === "GRANDFATHERED" ? [...common, "owner", "evidence", "migrationTask"] : [...common, "approval"];
    if (!screen || Object.keys(screen).some(k => !required.includes(k)) || !required.every(k => Object.hasOwn(screen, k)) || !["BO", "HO"].includes(screen.surface) || !screen.key?.trim() || !screen.route?.startsWith(`/${screen.surface.toLowerCase()}/`) || /[*?#]/.test(screen.route)) throw Error("TDD contract: invalid compatibility classification");
    if (screen.classification === "GRANDFATHERED") {
      if (![screen.owner, screen.evidence, screen.migrationTask].every(v => typeof v === "string" && v.trim()) || !/^PAP-\d+$/.test(screen.migrationTask)) throw Error("TDD contract: legacy evidence/migration required");
      if (!this.verifyLegacy(screen)) throw Error("TDD contract: deployed legacy evidence not verified");
    } else if (screen.classification === "FOUNDER_APPROVED_SPECIAL") {
      validateApproval(screen.approval);
      if (!this.verifyApproval(screen.approval, { surface: screen.surface, key: screen.key, route: screen.route })) throw Error("TDD contract: special-screen approval not verified");
    } else throw Error("TDD contract: unknown classification");
    const admitted = snapshot(screen); this.add(admitted); return admitted;
  }
  get(surface: "BO" | "HO", key: string) { return this.entries.get(`${surface}:${key}`); }
  list(): readonly (RegisteredModule | CompatibilityScreen)[] { return Object.freeze([...this.entries.values()]); }
  private add(entry: RegisteredModule | CompatibilityScreen) {
    const key = `${entry.surface}:${entry.key}`;
    if (this.entries.has(key)) throw Error("TDD contract: duplicate module registration");
    if ("route" in entry && [...this.entries.values()].some(e => "route" in e && e.surface === entry.surface && e.route === entry.route)) throw Error("TDD contract: duplicate compatibility route");
    this.entries.set(key, entry);
  }
}
export type TddActionHandler = Readonly<{
  run: () => void | Promise<void>;
  disabled?: boolean;
}>;
export type TddActionBindings = Readonly<Record<string, TddActionHandler | undefined>>;
/** Server/client safe: check permission from an authenticated context and an actual handler. */
export function authorizedHostActions<F extends readonly FieldSchema[]>(
  schema: ModuleSchema<F>, context: AuthorizationContext,
  slot: TddActionDescriptor["slot"], bindings: TddActionBindings,
): readonly TddActionDescriptor[] {
  const eligible = (schema.actions ?? []).filter(action => action.slot === slot &&
    allows(schema, context, action.capability) && Boolean(bindings[action.handler]));
  return [...eligible.filter(action => action.variant !== "primary"),
    ...eligible.filter(action => action.variant === "primary")];
}
