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
      const candidate = restoreBoAuthorizedCenter(result.centers.map(c => c.id), locationUrl.search, safeSessionCenter());
      const current = candidate.selected;
      setCenters(result.centers);
      setSource(result.source);
      setSelected(current);
      setLoading(false);
      if (current) { try { sessionStorage.setItem(BO_ACTIVE_CENTER_SESSION_KEY, current); } catch { /* unavailable */ } }
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
      const candidate = restoreBoAuthorizedCenter(centers.map(c => c.id), new URL(location.href).search, safeSessionCenter());
      const center = candidate.selected;
      if (center) { try { sessionStorage.setItem(BO_ACTIVE_CENTER_SESSION_KEY, center); } catch { /* unavailable */ } }
      setSelected(center);
      setError(candidate.invalidExplicit ?
        "Cơ sở trong liên kết không được cấp quyền." : "");
    };
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
    history.replaceState(state, "", parentCenterUrl(url, centerId));
    try { sessionStorage.setItem(BO_ACTIVE_CENTER_SESSION_KEY, centerId); } catch { /* session storage unavailable */ }
    setSelected(centerId);
    setError("");
  };
  return <Context.Provider value={{ centers, source, selected, loading, error, selectCenter }}>
    {children}
  </Context.Provider>;
}
function safeSessionCenter(): string | null {
  try { return sessionStorage.getItem(BO_ACTIVE_CENTER_SESSION_KEY); } catch { return null; }
}
export const useBoCenterSelection = () => useContext(Context);
