import type { FieldKey, FieldSchema, FilterRule, ModuleRow } from "./fields";

export type Surface = "BO" | "HO";
/** Supplied by the authenticated adapter. These values never infer a role or grant. */
export type AuthorizationContext =
  | { readonly surface: "BO"; readonly centerId: string; readonly authorize: (permission: string) => boolean }
  | { readonly surface: "HO"; readonly authorize: (permission: string) => boolean };
export type Capability = "read" | "create" | "edit" | "history" | "manageSharedViews";
export type CapabilityBindings = Readonly<{ read: string } & Partial<Record<Exclude<Capability, "read">, string>>>;
export type Source = { readonly adapter: string; readonly permission: string };
export type Sections<K extends string> = readonly { readonly id: string; readonly label: string; readonly fields: readonly K[] }[];

type SlotBase = { readonly id: string; readonly label: string; readonly source: Source };
export type BusinessSlot<K extends string> = SlotBase & (
  | { readonly kind: "field-group"; readonly sections: Sections<K> }
  | { readonly kind: "relation-grid" | "data-grid"; readonly relatedModule: string }
  | { readonly kind: "form"; readonly fields: readonly K[]; readonly submitPermission: string }
  | { readonly kind: "timeline"; readonly dateField: K }
  | { readonly kind: "media"; readonly fields: readonly K[] }
  | { readonly kind: "metric-cards"; readonly fields: readonly K[] }
  | { readonly kind: "audit-events"; readonly subjectType: string }
  | { readonly kind: "approved-extension"; readonly extensionId: string; readonly approval: Approval }
);
export type Approval = {
  readonly jira: string; readonly owner: string; readonly designAuthority: string;
  readonly files: readonly string[]; readonly tests: readonly string[]; readonly reviewBy: string;
};
export type TableQuery<F extends readonly FieldSchema[]> = {
  readonly search: string;
  readonly filters: { readonly logic: "AND" | "OR"; readonly rules: readonly FilterRule<F>[] };
  readonly sort: { readonly field: FieldKey<F>; readonly direction: "asc" | "desc" } | null;
  readonly group: { readonly field: FieldKey<F>; readonly direction: "asc" | "desc"; readonly collapsed: readonly string[]; readonly hidden: readonly string[]; readonly hideEmpty: boolean } | null;
  readonly order: readonly FieldKey<F>[];
  readonly visible: readonly FieldKey<F>[];
  readonly page: number;
  /** Optional frozen boundary; protected Identity and Quick View opener stay pinned. */
  readonly frozenThrough?: FieldKey<F> | null;
  readonly pageSize: 8 | 15 | 30;
};
export type TableSchema<F extends readonly FieldSchema[]> = {
  readonly identity: { readonly field: FieldKey<F>; readonly pinned: "left"; readonly hideable: false; readonly reorderable: false };
  readonly columns: readonly { readonly field: FieldKey<F>; readonly visible: boolean }[];
  readonly search: { readonly fields: readonly FieldKey<F>[]; readonly normalization: "vi-diacritic-insensitive" };
  readonly filters: { readonly fields: readonly FieldKey<F>[]; readonly mode: "flat"; readonly logic: "AND" | "OR" };
  readonly sort: { readonly fields: readonly FieldKey<F>[]; readonly mode: "single"; readonly nulls: "last"; readonly tieBreak: "record-id" };
  readonly group: { readonly fields: readonly FieldKey<F>[]; readonly mode: "single" };
  readonly views: {
    readonly builtIn: readonly { readonly id: string; readonly label: string; readonly state: TableQuery<F> }[];
    readonly saved: { readonly kind: "local-ui" } | { readonly kind: "authorized-service"; readonly source: Source; readonly scopes: readonly ("personal" | "shared")[]; readonly conflict: "version" };
    readonly actions: readonly ("add" | "apply" | "rename" | "delete" | "reorder")[];
  };
  readonly pagination: { readonly sizes: readonly [8, 15, 30]; readonly defaultSize: 8 | 15 | 30; readonly mode: "server" | "local-ui" };
  readonly inlineEdit: { readonly fields: readonly FieldKey<F>[]; readonly enabled: boolean };
  readonly interaction: {
    readonly settings: readonly ["properties", "grouping", "filters", "quick-views"];
    readonly quickView: "separate-opener"; readonly keyboard: "canonical";
    readonly undo: "local-ui-only" | "disabled";
  };
};
export type HistorySubject = { readonly type: string; readonly id: string };
export type HistoryEvent = {
  readonly id: string; readonly at: string; readonly actor: string; readonly action: string;
  readonly outcome: "succeeded" | "failed" | "denied"; readonly source: string;
  readonly subject: HistorySubject;
  /** Adapter supplies an authorized, redacted projection, never raw audit payload. */
  readonly redacted: true;
  readonly changes?: readonly { readonly field: string; readonly before: string | number | boolean | readonly string[] | null; readonly after: string | number | boolean | readonly string[] | null }[];
};
export type HistoryResult =
  | { readonly status: "authorized"; readonly events: readonly HistoryEvent[]; readonly nextCursor: string | null }
  | { readonly status: "unavailable"; readonly reason: string }
  | { readonly status: "denied" };
export type HistoryBinding =
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "provider"; readonly source: Source; readonly load: (subject: HistorySubject, context: AuthorizationContext, cursor: string | null, signal: AbortSignal) => Promise<HistoryResult> };
export type DataAdapter<F extends readonly FieldSchema[]> = {
  readonly id: string;
  readonly list: (query: TableQuery<F>, context: AuthorizationContext, signal: AbortSignal) => Promise<{ readonly rows: readonly ModuleRow<F>[]; readonly total: number }>;
  readonly detail: (id: string, context: AuthorizationContext, signal: AbortSignal) => Promise<ModuleRow<F> | null>;
};
export type NavigationAdapter = { readonly openDetail: (id: string) => void; readonly returnToTable: () => void };
/** Future adapters must preserve optimistic concurrency; UI undo is not a backend rollback. */
type EditableKey<F extends readonly FieldSchema[]> = Extract<F[number], { readonly readOnly: false; readonly capabilities: { readonly inlineEdit: true } }>["key"];
export type EditablePatch<F extends readonly FieldSchema[]> = Partial<Pick<ModuleRow<F>, EditableKey<F>>> & {
  readonly [K in Exclude<FieldKey<F>, EditableKey<F>>]?: never;
};
export type MutationAdapter<F extends readonly FieldSchema[]> = {
  readonly update: (id: string, patch: EditablePatch<F>, expectedVersion: string, context: AuthorizationContext, signal: AbortSignal) => Promise<
    | { readonly status: "saved"; readonly row: ModuleRow<F>; readonly version: string }
    | { readonly status: "conflict" | "denied" }
    | { readonly status: "invalid"; readonly fields: readonly FieldKey<F>[] }
  >;
};
export type ModuleSchema<F extends readonly FieldSchema[] = readonly FieldSchema[]> = {
  readonly version: 1; readonly classification: "TDD_DEFAULT";
  readonly key: string; readonly label: string; readonly group: string; readonly surface: Surface;
  readonly fields: F; readonly capabilities: CapabilityBindings; readonly data: DataAdapter<F>;
  readonly table: TableSchema<F>;
  readonly drawer: { readonly density: "one-column"; readonly sections: Sections<FieldKey<F>>; readonly actions: readonly { readonly id: string; readonly label: string; readonly capability: "create" | "edit" }[] };
  readonly detail: { readonly overview: { readonly sections: Sections<FieldKey<F>> }; readonly businessTabs: readonly BusinessSlot<FieldKey<F>>[]; readonly history: HistoryBinding };
};
/** Classification only; no route creation or self-authorized exception. */
export type CompatibilityScreen =
  | { readonly classification: "GRANDFATHERED"; readonly key: string; readonly surface: Surface; readonly route: string; readonly owner: string; readonly evidence: string; readonly migrationTask: string }
  | { readonly classification: "FOUNDER_APPROVED_SPECIAL"; readonly key: string; readonly surface: Surface; readonly route: string; readonly approval: Approval };
