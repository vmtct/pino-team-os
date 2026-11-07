"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  loadAuthorizedDirectoryCenters,
  type DirectoryCenter,
  type DirectoryCenterSource,
} from "../../pinoria-avatars/centers";
import { parentCenterUrl } from "../../parents/navigation";
import { BO_ACTIVE_CENTER_SESSION_KEY, restoreBoAuthorizedCenter } from "./BoGlobalCenterPolicy";

export type BoCenterSelectionState = {
  centers: readonly DirectoryCenter[];
  source: DirectoryCenterSource;
  selected: string;
  loading: boolean;
  error: string;
  selectCenter: (centerId: string) => void;
};
const Context = createContext<BoCenterSelectionState | null>(null);

/** PAP-1316/PAP-1327: Global authenticated BO shell context.
 * A session hint is never an ACL grant; every load validates it against the current Core Center list.
 * Domain modules still must explicitly admit Core-scoped read/write contracts. */
export function BoCenterSelectionProvider({ children }: { children: React.ReactNode }) {
  // App Router transitions can change query without remounting the authenticated layout.
  const routeQuery = useSearchParams().toString();
  const [centers, setCenters] = useState<readonly DirectoryCenter[]>([]);
  const [source, setSource] = useState<DirectoryCenterSource>("centers");
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const ctl = new AbortController();
    void loadAuthorizedDirectoryCenters(fetch, ctl.signal).then(result => {
      if (ctl.signal.aborted) return;
      const locationUrl = new URL(location.href);
      const candidate = restoreBoAuthorizedCenter(result.centers.map(c => c.id), locationUrl.search, safeRecentCenter());
      const current = candidate.selected;
      setCenters(result.centers);
      setSource(result.source);
      setSelected(current);
      setLoading(false);
      if (current) { try { saveRecentCenter(current); } catch { /* unavailable */ } }
      setError(candidate.invalidExplicit ? "Cơ sở trong liên kết không được cấp quyền." :
        !result.centers.length ? "Không có cơ sở được cấp quyền." : "");
    }).catch((cause: unknown) => {
      if (ctl.signal.aborted) return;
      setLoading(false);
      // Preserve explicit Core 401/403 capability failures from authorized discovery.
      setError(cause instanceof Error ? cause.message : "Không thể tải cơ sở được cấp quyền.");
    });
    return () => ctl.abort();
  }, []);
  useEffect(() => {
    const restore = () => {
      // Back/Forward must not erase a loading, 401/403, or empty-authority error.
      if (loading || !centers.length) return;
      const candidate = restoreBoAuthorizedCenter(centers.map(c => c.id), new URL(location.href).search, safeRecentCenter());
      const center = candidate.selected;
      if (center) { try { saveRecentCenter(center); } catch { /* unavailable */ } }
      setSelected(center);
      setError(candidate.invalidExplicit ?
        "Cơ sở trong liên kết không được cấp quyền." : "");
    };
    // Next App Router may change search params without a popstate event.
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [centers, loading, routeQuery]);
  const selectCenter = (centerId: string) => {
    // A stale or arbitrary Center ID must never be published as a new scope.
    if (!centers.some(c => c.id === centerId)) return;
    // A previous Center\'s record/tab selection must not survive a scope change.
    const url = new URL(location.href);
    url.searchParams.delete("record");
    url.hash = "";
    const state = { ...history.state };
    delete state["pino:tdd:BO:parents"];
    // PAP-1458/PAP-1316: clear every BO TDD navigation snapshot from the old Center.
    // This is browser history UI state only; Core authorization remains authoritative.
    for (const key of Object.keys(state)) if (key.startsWith("pino:tdd:BO:")) delete state[key];
    history.replaceState(state, "", parentCenterUrl(url, centerId));
    try { saveRecentCenter(centerId); } catch { /* session storage unavailable */ }
    setSelected(centerId);
    setError("");
  };
  return <Context.Provider value={{ centers, source, selected, loading, error, selectCenter }}>
    {children}
  </Context.Provider>;
}
function safeRecentCenter(): string | null {
  try { return localStorage.getItem(BO_ACTIVE_CENTER_SESSION_KEY) || sessionStorage.getItem(BO_ACTIVE_CENTER_SESSION_KEY); } catch { return null; }
}
function saveRecentCenter(centerId: string): void {
  try { localStorage.setItem(BO_ACTIVE_CENTER_SESSION_KEY, centerId); } catch { /* unavailable */ }
  try { sessionStorage.setItem(BO_ACTIVE_CENTER_SESSION_KEY, centerId); } catch { /* unavailable */ }
}
/** Presentation may share the Center control without opting Production's
 * retained content into Staging-only data adapters. */
export function BoContentCenterBoundary({ staging, children }: { staging: boolean; children: React.ReactNode }) {
  const selection = useContext(Context);
  return <Context.Provider value={staging ? selection : null}>{staging ? children : <div data-bo-design-system="v23" style={{ display: "contents" }}>{children}</div>}</Context.Provider>;
}
export const useBoCenterSelection = () => useContext(Context);
