import { BoPublicViewCoreClient } from "../bo-public-view-core-client";
import { validateBoViewConfig, type BoPublicView, type BoViewConfig, type BoViewOperator } from "../bo-public-view-state";
import { allows, validateQuery, type FieldSchema, type ModuleSchema, type TableQuery } from "../workspace-schema";
import type { AdapterViews, TypedSavedView } from "./contracts";
import { adapterError, type SurfaceSession } from "./session";

const toService: Readonly<Record<string, BoViewOperator>> = { eq: "equals", neq: "is_not", contains: "contains", not_contains: "not_contains", empty: "empty", not_empty: "not_empty", gt: "gt", gte: "gte", lt: "lt", lte: "lte", between: "between", before: "before", after: "after" };
const fromService: Readonly<Record<string, string>> = { ...Object.fromEntries(Object.entries(toService).map(([k, v]) => [v, k])), is: "eq", on: "eq" };
export function toSharedConfig<F extends readonly FieldSchema[]>(schema: ModuleSchema<F>, query: TableQuery<F>): BoViewConfig {
  validateQuery(schema, query);
  if (query.group && (query.group.direction !== "asc" || query.group.collapsed.length || query.group.hidden.length)) throw Error("Shared View cannot persist this grouping state");
  return validateBoViewConfig({ search: query.search, sort: query.sort, logic: query.filters.logic === "AND" ? "and" : "or",
    filters: query.filters.rules.map(rule => {
      const operator = toService[rule.op]; if (!operator) throw Error("Shared View cannot represent this filter operator");
      return { field: rule.field, operator, ...("value" in rule ? { value: rule.value } : {}), ...("second" in rule ? { end: rule.second } : {}) };
    }), groupBy: query.group?.field ?? null, hideEmptyGroups: query.group?.hideEmpty ?? true,
    columns: { order: [...query.order], visible: [...query.visible] } }, schema.fields.map(f => f.key));
}
export function fromSharedConfig<F extends readonly FieldSchema[]>(schema: ModuleSchema<F>, config: BoViewConfig): TableQuery<F> {
  const valid = validateBoViewConfig(config, schema.fields.map(f => f.key));
  const query: unknown = { search: valid.search, sort: valid.sort,
    filters: { logic: valid.logic === "and" ? "AND" : "OR", rules: valid.filters.map(rule => {
      const op = fromService[rule.operator]; if (!op) throw Error("Shared View has an incompatible filter operator");
      return { field: rule.field, op, ...(rule.value !== undefined ? { value: rule.value } : {}), ...(rule.end !== undefined ? { second: rule.end } : {}) };
    }) }, group: valid.groupBy ? { field: valid.groupBy, direction: "asc", collapsed: [], hidden: [], hideEmpty: valid.hideEmptyGroups } : null,
    order: valid.columns.order, visible: valid.columns.visible, page: 1, pageSize: schema.table.pagination.defaultSize };
  validateQuery(schema, query); return query;
}
type Guard = <T>(action: (signal: AbortSignal) => Promise<T>, signal: AbortSignal, check?: () => void) => Promise<T>;
/** Existing Core PAP-886 service is organization-shared only, not personal.
 * HO host has no Views endpoint. Neither limitation is bypassed by this adapter. */
export async function sharedViews<F extends readonly FieldSchema[]>(schema: ModuleSchema<F>, session: SurfaceSession, guarded: Guard, signal: AbortSignal): Promise<AdapterViews<F>> {
  const saved = schema.table.views.saved;
  if (saved.kind !== "authorized-service") return { unavailable: [] };
  if (session.scope.surface !== "BO" || saved.scopes.length !== 1 || saved.scopes[0] !== "shared") throw adapterError(404);
  const check = () => { if (!allows(schema, session.context, "read") || !session.context.authorize(saved.source.permission)) throw adapterError(403); };
  const client = (signal: AbortSignal) => new BoPublicViewCoreClient({ baseUrl: session.origin,
    moduleKey: schema.key, allowedFields: schema.fields.map(f => f.key), role: allows(schema, session.context, "manageSharedViews") ? "manager" : "staff", authMode: "team_cookie",
    fetchImpl: (input, init) => session.transport(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal }) });
  let source = await guarded(signal => client(signal).list(), signal, check);
  const project = (source: readonly BoPublicView[]) => {
    const views: TypedSavedView<F>[] = [], unavailable: { id: string; name: string }[] = [];
    for (const row of source) {
      try { const state = fromSharedConfig(schema, row.config); validateQuery(schema, state, session.context); views.push({ id: row.id, name: row.name, version: String(row.version), state }); }
      catch { unavailable.push({ id: row.id, name: row.name }); }
    }
    return { views, unavailable };
  };
  const initial = project(source);
  let busy = false;
  return { unavailable: initial.unavailable, transport: { views: initial.views, write: async (next, context, signal) => {
    if (context !== session.context || busy) throw adapterError(409);
    const checkWrite = () => { check(); if (!allows(schema, context, "manageSharedViews")) throw adapterError(403); };
    checkWrite(); busy = true;
    try {
      const usable = project(source).views;
      if (new Set(next.map(v => v.id)).size !== next.length || next.some(v => source.some(s => s.id === v.id) && !usable.some(u => u.id === v.id))) throw adapterError(400);
      for (const v of next) { validateQuery(schema, v.state, context); if (source.some(s => s.id === v.id && String(s.version) !== v.version)) throw adapterError(409); }
      const added = next.filter(v => !source.some(s => s.id === v.id)), removed = usable.filter(v => !next.some(n => n.id === v.id));
      const renamed = next.filter(v => source.some(s => s.id === v.id && s.name !== v.name));
      const changed = next.filter(v => source.some(s => s.id === v.id && JSON.stringify(fromSharedConfig(schema, s.config)) !== JSON.stringify(v.state)));
      const beforeOrder = usable.map(v => v.id), afterOrder = next.filter(v => source.some(s => s.id === v.id)).map(v => v.id);
      const reorder = !added.length && !removed.length && beforeOrder.some((id, i) => id !== afterOrder[i]);
      const count = added.length + removed.length + renamed.length + changed.length + Number(reorder);
      if (count === 0) return project(source).views;
      if (count !== 1) throw adapterError(409); // No pretend atomic bulk API or automatic retries.
      const action = added.length ? "add" : removed.length ? "delete" : renamed.length ? "rename" : reorder ? "reorder" : null;
      if (action && !schema.table.views.actions.includes(action)) throw adapterError(403);
      const nextSource = await guarded(async signal => {
        const api = client(signal);
        if (added[0]) return [...source, await api.create({ kind: "create", moduleKey: schema.key, id: added[0].id, name: added[0].name, position: source.length, config: toSharedConfig(schema, added[0].state) })];
        if (removed[0]) { await api.remove({ kind: "delete", moduleKey: schema.key, id: removed[0].id, expectedVersion: Number(removed[0].version) }); return source.filter(v => v.id !== removed[0].id); }
        if (renamed[0]) { const row = await api.rename({ kind: "rename", moduleKey: schema.key, id: renamed[0].id, name: renamed[0].name, expectedVersion: Number(renamed[0].version) }); return source.map(v => v.id === row.id ? row : v); }
        if (changed[0]) { const row = await api.update({ kind: "update", moduleKey: schema.key, id: changed[0].id, expectedVersion: Number(changed[0].version), config: toSharedConfig(schema, changed[0].state) }); return source.map(v => v.id === row.id ? row : v); }
        let index = 0; const order = source.map(v => usable.some(u => u.id === v.id) ? next[index++].id : v.id);
        return api.reorder({ kind: "reorder", moduleKey: schema.key, positions: order.map((id, position) => ({ id, position, expectedVersion: source.find(v => v.id === id)!.version })) });
      }, signal, checkWrite);
      source = nextSource; return project(source).views;
    } finally { busy = false; }
  } } };
}
