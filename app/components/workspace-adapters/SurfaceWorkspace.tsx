"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthorizationContext } from "@/lib/workspace-schema";
import type { FieldSchema, ModuleRow, TableQuery } from "@/lib/workspace-schema";
import type { AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import type { AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRenderer } from "../workspace-renderer/Renderer";
import { latestRequest } from "../workspace-renderer/resource";
import type { TddTableProps } from "../workspace-renderer/Table";
import type { BusinessFormProvider, SlotLoaders } from "../workspace-renderer/Slots";
import type { OverviewProperties } from "../workspace-renderer/Properties";
import { BoApiError } from "@/lib/bo-api-error";
/** Host owns the existing sidebar trigger; domain slots cannot replace it. */
export const TddHostMenu = createContext<(id: string) => ReactNode>(() => null);

function useAdapterResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ load: typeof load; retry: number; value?: T; error?: unknown } | null>(null);
  useEffect(() => { const request = latestRequest<{ value?: T; error?: unknown }>(); void request.run(async signal => { try { return { value: await load(signal) }; } catch (error) { return { error }; } }, result => setState({ load, retry, ...result }), () => setState({ load, retry, error: Error("Unavailable") })); return () => request.cancel(); }, [load, retry]);
  return { state: state?.load === load && state.retry === retry ? state : null, retry: () => setRetry(n => n + 1) };
}
/** Shared controller only: every shell remains owned by the canonical renderer.
 * Keeping Table mounted also preserves active/saved views and local undo on Back. */
export type SurfaceWorkspaceProps<F extends readonly FieldSchema[]> = { readonly adapter: AuthenticatedSurfaceAdapter<F>; readonly navigation: AdapterNavigation<F>; readonly initialQuery: TableQuery<F>; readonly businessForms?: readonly BusinessFormProvider[]; readonly businessLoaders?: SlotLoaders; readonly detailProperties?: (properties: OverviewProperties, context: AuthorizationContext, principalId: string) => ReactNode; readonly detailOverview?: (row: ModuleRow<F>, context: AuthorizationContext, principalId: string) => ReactNode; readonly detailApprovedExtension?: (row: ModuleRow<F>, context: AuthorizationContext, activeTab: string, principalId: string) => ReactNode };
export function SurfaceWorkspace<F extends readonly FieldSchema[]>(props: SurfaceWorkspaceProps<F>) {
  const { adapter } = props;
  return <MountedSurfaceWorkspace key={JSON.stringify([adapter.scope.surface, adapter.schema.key, adapter.userId, adapter.scope.surface === "BO" ? adapter.scope.centerId : ""])} {...props} />;
}
/** Restore saved row focus/scroll only when returning to Table from an opened record.
 * Table-only query changes (search/filter/sort/View) must never jump to an old scroll position. */
export function shouldRestoreTableAfterNavigation(previous: "table" | "drawer" | "detail", next: "table" | "drawer" | "detail"): boolean {
  return previous !== "table" && next === "table";
}

function MountedSurfaceWorkspace<F extends readonly FieldSchema[]>({ adapter, navigation, initialQuery, businessForms, businessLoaders, detailOverview, detailProperties, detailApprovedExtension }: SurfaceWorkspaceProps<F>) {
  const menu = useContext(TddHostMenu);
  const [location, setLocation] = useState(() => navigation.read());
  const [query, setQuery] = useState(location.query ?? initialQuery);
  const tableRoot = useRef<HTMLDivElement>(null);
  const previousStage = useRef(location.kind);
  const previousRecord = useRef(location.recordId);
  const pendingTableRestore = useRef<string | null>(null);
  useEffect(() => navigation.subscribe(() => {
    const next = navigation.read();
    const shouldRestore = shouldRestoreTableAfterNavigation(previousStage.current, next.kind);
    const returnRecord = previousRecord.current;
    previousStage.current = next.kind;
    previousRecord.current = next.recordId;
    setLocation(next);
    setQuery(next.query);
    if (shouldRestore) pendingTableRestore.current = returnRecord ?? null;
    else if (next.kind !== "table") pendingTableRestore.current = null;
  }), [navigation]);
  const listLoad = useCallback((signal: AbortSignal) => adapter.list(query, signal), [adapter, query]);
  const list = useAdapterResource(listLoad);
  useEffect(() => {
    // history.state clones the query, which may refresh and replace Table rows.
    // Restore the opener only after those rows have committed to the DOM.
    if (pendingTableRestore.current && location.kind === "table" && list.state?.value) {
      const recordId = pendingTableRestore.current;
      pendingTableRestore.current = null;
      navigation.restore();
      // A reloaded Detail has no original DOM opener in its navigation instance.
      // Preserve normal focus/scroll restoration, then recover only an idle body
      // focus using the row actually rendered by this authorized Table.
      requestAnimationFrame(() => {
        if (document.activeElement === document.body) {
          [...(tableRoot.current?.querySelectorAll<HTMLButtonElement>('button[data-open]') ?? [])]
            .find(button => button.dataset.open === recordId)?.focus({ preventScroll: true });
        }
      });
    }
  }, [location.kind, list.state, navigation]);
  const detailLoad = useCallback((signal: AbortSignal) => location.recordId ? adapter.detail(location.recordId, signal) : Promise.resolve(null), [adapter, location.recordId]);
  const detail = useAdapterResource(detailLoad);
  const viewsLoad = useCallback((signal: AbortSignal) => adapter.views(signal), [adapter]);
  const views = useAdapterResource(viewsLoad);
  const status = (error: unknown) => error instanceof BoApiError && [401, 403].includes(error.status) ? "denied" as const : error instanceof BoApiError && error.status === 404 ? "not-found" as const : "error" as const;
  const move = (kind: "table" | "drawer" | "detail", recordId?: string, tab = "overview", replace = false) => navigation.change({ kind, ...(recordId ? { recordId } : {}), tab, query }, replace);
  const update = (query: TableQuery<F>) => { setQuery(query); navigation.change({ ...location, query }, true); };
  const common = { registry: adapter.registry, schema: adapter.schema, context: adapter.context };
  const table: TddTableProps<F> = { ...common, rows: list.state?.value?.rows ?? [], query, total: list.state?.value?.total ?? 0, onQueryChange: update,
    onOpen: row => { navigation.capture(row.id); move("drawer", row.id); }, status: list.state?.error ? status(list.state.error) === "denied" ? "denied" : "error" : list.state?.value ? "ready" : "loading", onRetry: list.retry,
    viewTransport: views.state?.value?.transport,
    writes: adapter.mutation ? { adapter: adapter.mutation, versionForRow: id => list.state?.value?.versions[id] ?? "", onSaved: () => { list.retry(); detail.retry(); } } : undefined };
  const selected = detail.state?.value;
  const record = selected?.row ?? { id: location.recordId ?? "" } as ModuleRow<F>;
  const recordStatus = !detail.state ? "loading" : detail.state.error ? status(detail.state.error) : selected ? "ready" : "not-found";
  const writes = adapter.mutation && selected?.version ? { adapter: adapter.mutation, version: selected.version, onSaved: () => { detail.retry(); list.retry(); } } : undefined;
  return <>
    <div ref={tableRoot} hidden={location.kind === "detail"}><TddRenderer view={{ kind: "table", props: table, mobileMenu: menu("menu-btn") }} /></div>
    {views.state?.error ? <p role="status">Quick Views chưa khả dụng. <button type="button" onClick={views.retry}>Thử lại</button></p> : null}
    {views.state?.value?.unavailable.map(view => <p role="status" key={view.id}>{view.name} — Quick View không tương thích; nhờ người quản lý sửa cấu hình gốc.</p>)}
    {location.kind === "drawer" ? <TddRenderer view={{ kind: "drawer", props: { ...common, record, status: recordStatus, writes, onRetry: detail.retry, onClose: () => move("table"), onDetail: () => move("detail", location.recordId) } }} /> : null}
    {location.kind === "detail" ? <TddRenderer view={{ kind: "detail", props: { ...common, record, status: recordStatus, onRetry: detail.retry, activeTab: location.tab, onTabChange: tab => move("detail", location.recordId, tab, true), subject: adapter.subject(record.id), renderOverviewProperties: detailProperties ? properties => detailProperties(properties, adapter.context, adapter.userId) : undefined, overviewAfter: recordStatus === "ready" && selected ? detailOverview?.(selected.row, adapter.context, adapter.userId) : undefined, renderApprovedExtension: detailApprovedExtension ? (row, context, tab) => detailApprovedExtension(row as ModuleRow<F>, context, tab, adapter.userId) : undefined, businessForms: businessForms ? { providers: businessForms, principalId: adapter.userId, subject: adapter.subject(record.id) } : undefined, loaders: businessLoaders, onBack: () => move("table"), mobileMenu: menu("detail-menu-btn") } }} /> : null}
  </>;
}
