/**
 * PAP-887: adapter-neutral state transitions for organization/module-shared BO Views.
 *
 * Team OS owns view interaction and temporary drafts. Core (PAP-886) is the only
 * authority for durable public view definitions, permissions, audit and versions.
 *
 * No browser storage, network calls or per-user private view representations.
 * Callers must serialize returned writes per view, debounce rapid configuration
 * changes and treat a 409 as an explicit conflict, never a blind retry.
 */
export type BoViewRole = "manager" | "staff";
export type BoViewDirection = "asc" | "desc";
export type BoViewValue = string | number | boolean | null | readonly string[];
export type BoViewOperator =
  | "contains" | "not_contains" | "is" | "is_not" | "empty" | "not_empty"
  | "equals" | "gt" | "gte" | "lt" | "lte" | "between" | "before" | "after" | "on";

export type BoViewFilter = {
  field: string;
  operator: BoViewOperator;
  value?: BoViewValue;
  end?: BoViewValue;
};

export type BoViewConfig = {
  search: string;
  sort: { field: string; direction: BoViewDirection } | null;
  filters: BoViewFilter[];
  logic: "and" | "or";
  groupBy: string | null;
  hideEmptyGroups: boolean;
  columns: { order: string[]; visible: string[] };
};

export type BoPublicView = {
  id: string;
  moduleKey: string;
  name: string;
  position: number;
  version: number;
  config: BoViewConfig;
};

export type BoViewConflict = { viewId: string; server: BoPublicView; reason: "version_conflict" };
export type BoViewState = {
  moduleKey: string;
  role: BoViewRole;
  views: BoPublicView[];
  activeId: string | null;
  effective: BoViewConfig;
  localDraft: boolean;
  conflict: BoViewConflict | null;
};

export type BoViewWrite =
  | { kind: "create"; moduleKey: string; id: string; name: string; position: number; config: BoViewConfig }
  | { kind: "update"; moduleKey: string; id: string; expectedVersion: number; config: BoViewConfig }
  | { kind: "rename"; moduleKey: string; id: string; expectedVersion: number; name: string }
  | { kind: "delete"; moduleKey: string; id: string; expectedVersion: number }
  | { kind: "reorder"; moduleKey: string; positions: Array<{ id: string; position: number; expectedVersion: number }> };

export type BoViewResult = { state: BoViewState; write: BoViewWrite | null };
const KEY = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/;
const NAME_LIMIT = 80;
const FIELD_LIMIT = 120;
const FILTER_LIMIT = 40;
const SEARCH_LIMIT = 500;
const ALLOWED_OPERATORS: ReadonlySet<string> = new Set([
  "contains", "not_contains", "is", "is_not", "empty", "not_empty",
  "equals", "gt", "gte", "lt", "lte", "between", "before", "after", "on",
]);

function assertKey(key: string, name: string) {
  if (!KEY.test(key)) throw new Error(`Invalid ${name}`);
}
function cloneValue(value: BoViewValue): BoViewValue {
  return Array.isArray(value) ? [...value] : value;
}
function cloneConfig(config: BoViewConfig): BoViewConfig {
  return {
    search: config.search,
    sort: config.sort ? { ...config.sort } : null,
    filters: config.filters.map(filter => ({
      field: filter.field, operator: filter.operator,
      ...(filter.value !== undefined ? { value: cloneValue(filter.value) } : {}),
      ...(filter.end !== undefined ? { end: cloneValue(filter.end) } : {}),
    })),
    logic: config.logic,
    groupBy: config.groupBy,
    hideEmptyGroups: config.hideEmptyGroups,
    columns: { order: [...config.columns.order], visible: [...config.columns.visible] },
  };
}
function cloneView(view: BoPublicView): BoPublicView {
  return { ...view, config: cloneConfig(view.config) };
}
function normalizedName(name: string): string {
  const result = name.trim();
  if (!result || result.length > NAME_LIMIT) throw new Error("View name is required (max 80 characters)");
  return result;
}
function safeValue(value: BoViewValue | undefined): BoViewValue | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length <= SEARCH_LIMIT) return value;
  if (Array.isArray(value) && value.length <= FIELD_LIMIT && value.every(x => typeof x === "string" && x.length <= SEARCH_LIMIT)) return [...value];
  throw new Error("Unsupported filter value");
}

export function validateBoViewConfig(config: BoViewConfig, allowedFields: readonly string[]): BoViewConfig {
  if (!config || !Array.isArray(config.filters) || !config.columns) throw new Error("Malformed view config");
  const allowed = new Set(allowedFields);
  if (!allowed.size || allowed.size > FIELD_LIMIT) throw new Error("Invalid module fields");
  for (const key of allowed) assertKey(key, "field key");
  const validField = (field: string) => typeof field === "string" && allowed.has(field);
  if (typeof config.search !== "string" || config.search.length > SEARCH_LIMIT) throw new Error("Search too long");
  if (config.logic !== "and" && config.logic !== "or") throw new Error("Invalid filter logic");
  if (typeof config.hideEmptyGroups !== "boolean") throw new Error("Invalid group flag");
  if (config.sort && (!validField(config.sort.field) || !["asc", "desc"].includes(config.sort.direction))) throw new Error("Invalid sort");
  if (config.groupBy !== null && !validField(config.groupBy)) throw new Error("Invalid group field");
  if (config.filters.length > FILTER_LIMIT || config.filters.some(f => !validField(f.field) || !ALLOWED_OPERATORS.has(f.operator))) {
    throw new Error("Invalid filter");
  }
  const values = config.filters.map(f => ({
    field: f.field, operator: f.operator,
    ...(f.value !== undefined ? { value: safeValue(f.value) } : {}),
    ...(f.end !== undefined ? { end: safeValue(f.end) } : {}),
  }));
  const { order, visible } = config.columns;
  if (!Array.isArray(order) || !Array.isArray(visible) || order.length > FIELD_LIMIT || visible.length > FIELD_LIMIT ||
    new Set(order).size !== order.length || new Set(visible).size !== visible.length ||
    order.some(key => !validField(key)) || visible.some(key => !validField(key) || !order.includes(key))) {
    throw new Error("Invalid column visibility or order");
  }
  return cloneConfig({ search: config.search, sort: config.sort, filters: values, logic: config.logic,
    groupBy: config.groupBy, hideEmptyGroups: config.hideEmptyGroups, columns: { order, visible } });
}

export function defaultBoViewConfig(fields: readonly string[]): BoViewConfig {
  const order = [...fields];
  for (const field of order) assertKey(field, "field key");
  if (!order.length || new Set(order).size !== order.length) throw new Error("Invalid default fields");
  return { search: "", sort: null, filters: [], logic: "and", groupBy: null,
    hideEmptyGroups: true, columns: { order, visible: [...order] } };
}

function normalizeViews(moduleKey: string, views: readonly BoPublicView[], allowedFields: readonly string[]): BoPublicView[] {
  const seen = new Set<string>();
  return views.map(view => {
    assertKey(view.id, "view ID");
    if (view.moduleKey !== moduleKey || seen.has(view.id) || !Number.isSafeInteger(view.version) || view.version < 0 ||
        !Number.isSafeInteger(view.position) || view.position < 0) throw new Error("Invalid public view record");
    seen.add(view.id);
    return { ...cloneView(view), name: normalizedName(view.name),
      config: validateBoViewConfig(view.config, allowedFields) };
  }).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export function loadBoPublicViews(input: {
  moduleKey: string;
  role: BoViewRole;
  allowedFields: readonly string[];
  views: readonly BoPublicView[];
  selectedId?: string | null;
}): BoViewState {
  assertKey(input.moduleKey, "module key");
  if (!["manager", "staff"].includes(input.role)) throw new Error("Invalid role");
  const views = normalizeViews(input.moduleKey, input.views, input.allowedFields);
  const selected = views.find(view => view.id === input.selectedId) ?? null;
  return { moduleKey: input.moduleKey, role: input.role, views, activeId: selected?.id ?? null,
    effective: selected ? cloneConfig(selected.config) : defaultBoViewConfig(input.allowedFields),
    localDraft: false, conflict: null };
}

function result(state: BoViewState, write: BoViewWrite | null = null): BoViewResult { return { state, write }; }
function manager(state: BoViewState) {
  if (state.role !== "manager") throw new Error("Only an authorized manager can change shared views");
  if (state.conflict) throw new Error("Resolve public view conflict before updating");
}
function activeView(state: BoViewState): BoPublicView {
  const view = state.views.find(view => view.id === state.activeId);
  if (!view) throw new Error("Select a saved public view first");
  return view;
}

export function selectBoPublicView(state: BoViewState, id: string | null, allowedFields: readonly string[]): BoViewResult {
  const view = id === null ? null : state.views.find(x => x.id === id);
  if (id !== null && !view) throw new Error("Unknown public view");
  return result({ ...state, activeId: id, effective: view ? cloneConfig(view.config) : defaultBoViewConfig(allowedFields),
    localDraft: false, conflict: null });
}

/** Manager updates the active shared view; Staff changes remain transient and never emit a write. */
export function editBoViewConfig(state: BoViewState, config: BoViewConfig, allowedFields: readonly string[]): BoViewResult {
  const effective = validateBoViewConfig(config, allowedFields);
  if (!state.activeId || state.role === "staff") {
    return result({ ...state, effective, localDraft: true });
  }
  manager(state);
  const current = activeView(state);
  const updated = { ...current, config: cloneConfig(effective) };
  return result({ ...state, views: state.views.map(x => x.id === current.id ? updated : x), effective,
    localDraft: false }, { kind: "update", moduleKey: state.moduleKey, id: current.id,
    expectedVersion: current.version, config: cloneConfig(effective) });
}

/** Client-generated temporary IDs are accepted locally; Core must assign/reconcile durable identity. */
export function createBoPublicView(state: BoViewState, input: { id: string; name: string }): BoViewResult {
  manager(state);assertKey(input.id, "view ID");
  if (state.views.some(v => v.id === input.id)) throw new Error("Duplicate view ID");
  const name = normalizedName(input.name);
  const config = cloneConfig(state.effective),position = state.views.length;
  const view: BoPublicView = { id: input.id, name, position, moduleKey: state.moduleKey, version: 0, config };
  return result({ ...state, views: [...state.views.map(cloneView), view], activeId: input.id,
    effective: cloneConfig(config), localDraft: false }, { kind: "create", moduleKey: state.moduleKey,
    id: view.id, name, position, config: cloneConfig(config) });
}

export function renameBoPublicView(state: BoViewState, id: string, name: string): BoViewResult {
  manager(state);const current = state.views.find(v => v.id === id);
  if (!current) throw new Error("Unknown public view");
  const next = normalizedName(name);
  if (current.name === next) return result(state);
  return result({ ...state, views: state.views.map(v => v.id === id ? { ...cloneView(v), name: next } : cloneView(v)) },
    { kind: "rename", moduleKey: state.moduleKey, id, expectedVersion: current.version, name: next });
}

export function deleteBoPublicView(state: BoViewState, id: string, allowedFields: readonly string[]): BoViewResult {
  manager(state);const current=state.views.find(v=>v.id===id);
  if (!current) throw new Error("Unknown public view");
  const nextViews=state.views.filter(v=>v.id!==id).map((v,position)=>({...cloneView(v),position}));
  const wasActive=state.activeId===id;
  return result({ ...state, views: nextViews, activeId: wasActive ? null : state.activeId,
    effective: wasActive ? defaultBoViewConfig(allowedFields) : cloneConfig(state.effective),
    localDraft: wasActive ? false : state.localDraft },
    { kind:"delete",moduleKey:state.moduleKey,id,expectedVersion:current.version });
}

export function reorderBoPublicViews(state: BoViewState, orderedIds: readonly string[]): BoViewResult {
  manager(state);
  const currentIds = state.views.map(v=>v.id);
  if (orderedIds.length!==currentIds.length || new Set(orderedIds).size!==orderedIds.length ||
    orderedIds.some(id=>!currentIds.includes(id))) throw new Error("View order must be a permutation");
  if (orderedIds.every((id,i)=>id===currentIds[i])) return result(state);
  const existing = new Map(state.views.map(view=>[view.id,view]));
  const views=orderedIds.map((id,position)=>({...cloneView(existing.get(id)!),position}));
  return result({ ...state,views },
    {kind:"reorder",moduleKey:state.moduleKey,
      positions:views.map(view=>({id:view.id,position:view.position,expectedVersion:view.version}))});
}

/** Ack may update the durable version; a newer local config must not be overwritten by a stale ack. */
export function acknowledgeBoPublicView(state: BoViewState, server: BoPublicView, allowedFields: readonly string[]): BoViewState {
  const normalized=normalizeViews(state.moduleKey,[server],allowedFields)[0];
  const current=state.views.find(v=>v.id===server.id);
  if (!current) return state;
  if (normalized.version < current.version) return state;
  const sameConfig=JSON.stringify(normalized.config)===JSON.stringify(current.config);
  const next = sameConfig ? normalized : { ...current, version: normalized.version };
  return { ...state, views: state.views.map(v=>v.id===server.id?next:v),
    effective: state.activeId===server.id && sameConfig && !state.localDraft ? cloneConfig(next.config):state.effective };
}

/** 409 is a visible conflict, never silently overwrite another manager's global changes. */
export function conflictBoPublicView(state: BoViewState, server: BoPublicView, allowedFields: readonly string[]): BoViewState {
  const normalized=normalizeViews(state.moduleKey,[server],allowedFields)[0];
  if (!state.views.some(v=>v.id===normalized.id)) throw new Error("Unknown conflict view");
  return { ...state, conflict: {viewId:normalized.id,server:normalized,reason:"version_conflict"} };
}
export function discardBoViewConflict(state: BoViewState): BoViewState {
  if (!state.conflict) return state;
  const server=cloneView(state.conflict.server),isActive=state.activeId===server.id;
  return { ...state, views:state.views.map(v=>v.id===server.id?server:v),
    effective:isActive?cloneConfig(server.config):state.effective,localDraft:isActive?false:state.localDraft,conflict:null };
}
