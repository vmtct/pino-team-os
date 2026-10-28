"use client";
import { useEffect, useRef, useState } from "react";
import { BoDataTable } from "../../bo/components/registration/BoDataTable";
import { BoTableSettings, type BoSavedView } from "../../bo/components/registration/BoTableSettings";
import type { BoField, BoRecord, BoTableState } from "@/lib/bo-registration";
import { allows, allowsField, fromLegacyTableState, toLegacyModule, toLegacyTableState, type AuthorizationContext, type FieldSchema, type ModuleRow, type ModuleSchema, type MutationAdapter, type TableQuery, type TddRegistry } from "@/lib/workspace-schema";
import { registeredSchema, RecordState } from "./Record";
import { recordProjection, renderScope } from "./projection";
import { latestRequest } from "./resource";
import type { TablePolicy } from "./TablePolicy";
import { dispatchCellEdit } from "./editing";
import { PropertyEditor } from "./Editor";

export type SavedTddView<F extends readonly FieldSchema[]> = { readonly id: string; readonly name: string; readonly state: TableQuery<F>; readonly version?: string };
export type ViewTransport<F extends readonly FieldSchema[]> = {
  readonly views: readonly SavedTddView<F>[];
  /** Existing service must apply owner/scope/version ACL and return authoritative versions. */
  readonly write: (views: readonly SavedTddView<F>[], context: AuthorizationContext, signal: AbortSignal) => Promise<readonly SavedTddView<F>[]>;
};
export type TableWrites<F extends readonly FieldSchema[]> = {
  readonly adapter: MutationAdapter<F>; readonly versionForRow: (id: string) => string;
  readonly onSaved: (record: ModuleRow<F>, version: string) => void;
};
export type TddTableProps<F extends readonly FieldSchema[]> = {
  readonly registry: TddRegistry; readonly schema: ModuleSchema<F>; readonly context: AuthorizationContext;
  readonly rows: readonly ModuleRow<F>[]; readonly query: TableQuery<F>; readonly onQueryChange: (query: TableQuery<F>) => void;
  readonly onOpen: (record: BoRecord) => void; readonly status: "ready" | "loading" | "error" | "denied";
  readonly onRetry?: () => void; readonly total?: number; readonly viewTransport?: ViewTransport<F>;
  readonly writes?: TableWrites<F>;
};
export function TddTable<F extends readonly FieldSchema[]>(props: TddTableProps<F>) {
  const schema = registeredSchema(props.registry, props.schema);
  if (!allows(schema, props.context, "read") || props.status === "denied") return <RecordState status="denied" />;
  // Erasure is limited to the existing scalar Table bridge; all transitions revalidate.
  return <TableContents key={renderScope(schema, props.context, "table")} {...props as unknown as TddTableProps<readonly FieldSchema[]>} schema={schema} />;
}
function TableContents({ schema, context, rows, query, onQueryChange, onOpen, status, onRetry, total, viewTransport, writes }: TddTableProps<readonly FieldSchema[]>) {
  const [settings, setSettings] = useState<string | null>(null), [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<{ source: typeof query; state: BoTableState } | null>(null), [message, setMessage] = useState("");
  const [localViews, setLocalViews] = useState<BoSavedView[]>([]), [active, setActive] = useState<string | null>(null);
  const [authoritativeViews, setAuthoritativeViews] = useState<{ source: typeof viewTransport; views: readonly SavedTddView<readonly FieldSchema[]>[] } | null>(null);
  type UiSnapshot = { table: BoTableState; views: BoSavedView[]; active: string | null };
  const [undo, setUndo] = useState<UiSnapshot[]>([]);
  const [future, setFuture] = useState<UiSnapshot[]>([]);
  const [edit, setEdit] = useState<{ record: ModuleRow<readonly FieldSchema[]>; field: BoField; anchor: HTMLButtonElement; version: string } | null>(null);
  const request = useRef(latestRequest<readonly SavedTddView<readonly FieldSchema[]>[]>());
  useEffect(() => { const current = request.current; return () => current.cancel(); }, [schema, context, viewTransport]);
  let state: BoTableState;
  try { state = draft?.source === query ? draft.state : toLegacyTableState(schema, query, context); }
  catch { return <RecordState status="denied" />; }
  if (schema.table.pagination.mode === "server" && (!Number.isInteger(total) || total! < 0)) throw Error("Server TDD Table requires an authoritative total");
  const projected = rows.map(row => recordProjection(schema, context, row));
  if (projected.some(p => !p)) return <RecordState status="denied" />;
  const fields = schema.fields.filter(f => allowsField(schema, context, f.key, "display"));
  const legacyFields = toLegacyModule(schema).fields.filter(f => allowsField(schema, context, f.key, "display"));
  const policy: TablePolicy = {
    identity: schema.table.identity.field,
    search: schema.table.search.fields.filter(k => allowsField(schema, context, k, "search")),
    filter: schema.table.filters.fields.filter(k => allowsField(schema, context, k, "filter")),
    sort: schema.table.sort.fields.filter(k => allowsField(schema, context, k, "sort")),
    group: schema.table.group.fields.filter(k => allowsField(schema, context, k, "group")),
    edit: schema.table.inlineEdit.enabled && writes ? schema.table.inlineEdit.fields.filter(k => allowsField(schema, context, k, "inlineEdit")) : [],
    viewActions: schema.table.views.actions,
  };
  const update = (patch: Partial<BoTableState>) => {
    const next = { ...state, ...patch };
    try {
      const typed = fromLegacyTableState(schema, next, context, 1);
      if (schema.table.interaction.undo === "local-ui-only") { setUndo(items => [...items.slice(-19), { table: state, views: localViews, active }]); setFuture([]); }
      setDraft({ source: query, state: next }); setMessage(""); onQueryChange(typed);
    } catch (error) {
      // A half-entered operand stays local; no invalid query reaches a data adapter.
      if (error instanceof Error && /invalid filter operand|between requires typed upper bound|invalid legacy boolean/.test(error.message)) setDraft({ source: query, state: next });
      setMessage("Hãy hoàn tất giá trị bộ lọc hợp lệ.");
    }
  };
  const saved = schema.table.views.saved;
  const canWriteViews = saved.kind === "local-ui" || Boolean(viewTransport && context.authorize(saved.source.permission) && (!saved.scopes.includes("shared") || allows(schema, context, "manageSharedViews")));
  const externalViews = viewTransport && saved.kind === "authorized-service" && context.authorize(saved.source.permission) ? authoritativeViews?.source === viewTransport ? authoritativeViews.views : viewTransport.views : [];
  const views = saved.kind === "local-ui" ? localViews : externalViews.map(v => ({ id: v.id, name: v.name, state: toLegacyTableState(schema, v.state, context) }));
  const renderedPolicy = { ...policy, viewActions: canWriteViews ? policy.viewActions : policy.viewActions.filter(a => a === "apply") };
  const changeViews = (next: BoSavedView[]) => {
    if (!canWriteViews) return;
    try {
      const permits = (action: string) => schema.table.views.actions.includes(action as typeof schema.table.views.actions[number]);
      if (next.some(v => !views.some(p => p.id === v.id)) && !permits("add")) return;
      if (views.some(v => !next.some(p => p.id === v.id)) && !permits("delete")) return;
      if (next.some(v => views.some(p => p.id === v.id && p.name !== v.name)) && !permits("rename")) return;
      if (next.length === views.length && next.some((v, i) => v.id !== views[i].id) && !permits("reorder")) return;
      const converted = next.map(v => ({ id: v.id, name: v.name, state: fromLegacyTableState(schema, v.state, context), version: externalViews.find(p => p.id === v.id)?.version }));
      if (saved.kind === "local-ui") {
        if (schema.table.interaction.undo === "local-ui-only") { setUndo(items => [...items.slice(-19), { table: state, views: localViews, active }]); setFuture([]); }
        setLocalViews(next);
      }
      else {
        if (externalViews.some(v => !v.version)) throw Error("Missing saved view version");
        void request.current.run(async signal => {
          const result = await viewTransport!.write(converted, context, signal);
          if (!context.authorize(saved.source.permission) || (saved.scopes.includes("shared") && !allows(schema, context, "manageSharedViews"))) throw Error("View permission changed");
          if (!Array.isArray(result) || new Set(result.map(v => v.id)).size !== result.length) throw Error("Invalid saved view response");
          for (const view of result) { if (!view.id?.trim() || !view.name?.trim() || !view.version?.trim()) throw Error("Invalid saved view version"); toLegacyTableState(schema, view.state, context); }
          return result;
        }, result => { setAuthoritativeViews({ source: viewTransport, views: result }); setMessage(""); }, () => setMessage("Không thể lưu Quick View. Kiểm tra quyền hoặc phiên bản và thử lại."));
      }
    } catch { setMessage("Không thể lưu Quick View không hợp lệ."); }
  };
  const initial: BoTableState = { ...state, search: "", rules: [], sort: "", desc: false, group: "", collapsed: [], hiddenGroups: [], hideEmpty: true, groupDesc: false, order: schema.table.columns.map(c => c.field), visible: schema.table.columns.filter(c => c.visible).map(c => c.field), pageSize: schema.table.pagination.defaultSize };
  const restore = (redo: boolean) => {
    const previous = (redo ? future : undo).at(-1); if (!previous) return;
    try {
      onQueryChange(fromLegacyTableState(schema, previous.table, context)); setDraft({ source: query, state: previous.table }); setActive(previous.active);
      if (saved.kind === "local-ui") setLocalViews(previous.views);
      const current = { table: state, views: localViews, active };
      if (redo) { setUndo([...undo, current]); setFuture(future.slice(0, -1)); } else { setFuture([...future, current]); setUndo(undo.slice(0, -1)); }
    } catch { setMessage("Không thể khôi phục cấu hình không hợp lệ."); }
  };
  return <div data-tdd-shell="table" data-tdd-surface={schema.surface} onKeyDown={event => {
    if (event.target instanceof Element && event.target.closest("input,textarea,select")) return;
    if (event.key === "/" && policy.search.length) { event.preventDefault(); event.currentTarget.querySelector<HTMLInputElement>("#search")?.focus(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && schema.table.interaction.undo === "local-ui-only") { event.preventDefault(); event.stopPropagation(); restore(event.shiftKey); }
  }}>
    <BoDataTable module={{ label: schema.label, group: schema.group, fields: legacyFields.filter(f => fields.some(p => p.key === f.key)) }} rows={projected.map(p => p!.record)}
      loadState={status === "ready" ? "ready" : status === "loading" ? "loading" : "Không thể tải dữ liệu."}
      value={state} update={update} page={query.page} setPage={page => { try { onQueryChange(fromLegacyTableState(schema, state, context, page)); } catch { setMessage("Bộ lọc chưa hợp lệ."); } }}
      onOpen={onOpen} onCellEdit={writes ? (record, key, anchor) => { dispatchCellEdit(schema, context, key, () => {
        const field = legacyFields.find(f => f.key === key), version = writes.versionForRow(record.id);
        if (!field || !version.trim()) { setMessage("Tải lại phiên bản bản ghi trước khi chỉnh sửa."); return; }
        setEdit({ record, field, anchor, version });
      }); } : undefined} policy={renderedPolicy} serverTotal={schema.table.pagination.mode === "server" ? total : undefined}
      onSettings={setSettings} filterOpen={filterOpen} setFilterOpen={setFilterOpen} minimal
      views={views} changeViews={changeViews} activeView={active} applyView={view => { if (view && !schema.table.views.actions.includes("apply")) return; update(view?.state ?? initial); setActive(view?.id ?? null); }}
      reset={() => update(initial)} undo={() => restore(false)} canUndo={undo.length > 0}
      builtInViews={schema.table.views.builtIn.map(view => <button type="button" className={"view-tab " + (active === view.id ? "active" : "")} key={view.id} onClick={() => { try { toLegacyTableState(schema, view.state, context); onQueryChange(view.state); setActive(view.id); } catch { setMessage("Không có quyền áp dụng Quick View."); } }}>{view.label}</button>)} />
    {status === "error" && onRetry ? <button type="button" onClick={onRetry}>Thử lại</button> : null}
    {message ? <p role="alert">{message}</p> : null}
    {settings ? <BoTableSettings screen={settings} setScreen={setSettings} onClose={() => setSettings(null)} fields={legacyFields} rows={projected.map(p => p!.record)} value={state} update={update} views={views} setViews={changeViews} applyView={view => { if (schema.table.views.actions.includes("apply")) update(view.state); }} policy={renderedPolicy} /> : null}
    {edit && writes && rows.some(row => row.id === edit.record.id) ? <PropertyEditor key={JSON.stringify([edit.record.id, edit.field.key, edit.version])} schema={schema} context={context} record={edit.record} writes={{ adapter: writes.adapter, version: edit.version, onSaved: writes.onSaved }} selection={edit} onClose={() => setEdit(null)} /> : null}
  </div>;
}
