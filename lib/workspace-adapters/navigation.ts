import { HO_PAGE_PATHS, hoRecordId } from "../ho-routes";
import { BO_LEGACY_QUERY_MODULES, BO_TARGET_ROUTES, currentBoModuleHref } from "../bo-url-contract";
import { decideHostBoundary, HO_STAGING_HOSTNAME, isBoHostname } from "../host-boundary";
import type { TableQuery, FieldSchema } from "../workspace-schema";

export type AdapterLocation<F extends readonly FieldSchema[]> = { readonly kind: "table" | "drawer" | "detail"; readonly recordId?: string; readonly tab: string; readonly query: TableQuery<F> };
export type AdapterNavigation<F extends readonly FieldSchema[]> = {
  readonly read: () => AdapterLocation<F>;
  readonly change: (state: AdapterLocation<F>, replace?: boolean) => void;
  readonly subscribe: (listener: () => void) => () => void;
  readonly capture: (recordId: string) => void; readonly restore: () => void;
};
/** URL keeps existing record links; owned history state carries tab/query/stage.
 * No route creation, redirect, cross-surface navigation or auth inference. */
export function browserTddNavigation<F extends readonly FieldSchema[]>(surface: "BO" | "HO", moduleKey: string, initialQuery: TableQuery<F>): AdapterNavigation<F> {
  const known = surface === "HO" ? Object.hasOwn(HO_PAGE_PATHS, moduleKey) : BO_TARGET_ROUTES.some(v => v.key === moduleKey) || BO_LEGACY_QUERY_MODULES.some(key => key === moduleKey);
  if (!known || (surface === "BO" ? !isBoHostname(location.hostname) : location.hostname !== HO_STAGING_HOSTNAME)) throw Error("TDD navigation route mismatch");
  const route = surface === "HO" ? HO_PAGE_PATHS[moduleKey as keyof typeof HO_PAGE_PATHS]
    : BO_TARGET_ROUTES.find(v => v.key === moduleKey)?.path;
  const expected = new URL(surface === "BO" ? (route && location.pathname === route ? route : currentBoModuleHref(moduleKey, {})) : route ?? "/invalid", location.origin);
  const currentModule = new URLSearchParams(location.search).get("module");
  if (location.pathname !== expected.pathname || (surface === "BO" && expected.pathname === "/bo" && (currentModule ?? "students") !== (expected.searchParams.get("module") ?? "students")) ||
      decideHostBoundary(location.host, expected.pathname).action !== "next") throw Error("TDD navigation route mismatch");
  const key = "pino:tdd:" + surface + ":" + moduleKey;
  let focused: HTMLElement | null = null, recordId: string | null = null, scroll = { x: 0, y: 0, left: 0, top: 0 };
  return {
    read() {
      const selected = hoRecordId(new URLSearchParams(location.search).get("record"));
      // Reload/deep links have no captured opener. Remember the selected row for
      // Back's DOM fallback, and discard an opener from a different record.
      if (selected && selected !== recordId) { recordId = selected; focused = null; }
      const owned = history.state?.[key] as AdapterLocation<F> | undefined;
      return { kind: selected ? owned?.recordId === selected && owned.kind === "detail" ? "detail" : "drawer" : "table", ...(selected ? { recordId: selected } : {}),
        tab: owned?.recordId === selected && typeof owned.tab === "string" ? owned.tab : "overview", query: owned?.query ?? initialQuery };
    },
    change(state, replace = false) {
      if (!["table", "drawer", "detail"].includes(state.kind) || (state.kind !== "table" && !hoRecordId(state.recordId ?? null))) throw Error("Invalid selected record");
      const url = new URL(location.href);
      if (state.kind === "table") url.searchParams.delete("record"); else url.searchParams.set("record", state.recordId!);
      history[replace ? "replaceState" : "pushState"]({ ...history.state, [key]: state }, "", url.pathname + url.search + url.hash);
      window.dispatchEvent(new Event(key));
    },
    subscribe(listener) { window.addEventListener("popstate", listener); window.addEventListener(key, listener); return () => { window.removeEventListener("popstate", listener); window.removeEventListener(key, listener); }; },
    capture(id) { recordId = id; focused = document.activeElement instanceof HTMLElement ? document.activeElement : null; const table = document.getElementById("table-scroll"); scroll = { x: window.scrollX, y: window.scrollY, left: table?.scrollLeft ?? 0, top: table?.scrollTop ?? 0 }; },
    restore() { requestAnimationFrame(() => { window.scrollTo(scroll.x, scroll.y); const table = document.getElementById("table-scroll"); if (table) { table.scrollLeft = scroll.left; table.scrollTop = scroll.top; }
      const target = focused?.isConnected ? focused : [...document.querySelectorAll<HTMLElement>("button[data-open]")].find(node => node.dataset.open === recordId); target?.focus({ preventScroll: true }); }); },
  };
}
