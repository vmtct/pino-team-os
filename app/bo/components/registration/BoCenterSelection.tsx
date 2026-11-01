"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
  loadAuthorizedDirectoryCenters,
  type DirectoryCenter,
  type DirectoryCenterSource,
} from "../../pinoria-avatars/centers";
import { parentCenterUrl, restoreParentCenter } from "../../parents/navigation";

export type BoCenterSelectionState = {
  centers: readonly DirectoryCenter[];
  source: DirectoryCenterSource;
  selected: string;
  loading: boolean;
  error: string;
  selectCenter: (centerId: string) => void;
};
const Context = createContext<BoCenterSelectionState | null>(null);

/** PAP-1301: only opted-in BO Parents owns Center switching at present.
 * The shell displays authorized choices; Core/adapter authorizes actual data reads.
 * Never project this selection to legacy modules that lack Center-scope adapters. */
export function BoCenterSelectionProvider({ children }: { children: React.ReactNode }) {
  const [centers, setCenters] = useState<readonly DirectoryCenter[]>([]);
  const [source, setSource] = useState<DirectoryCenterSource>("centers");
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const ctl = new AbortController();
    void loadAuthorizedDirectoryCenters(fetch, ctl.signal).then(result => {
      if (ctl.signal.aborted) return;
      const current = restoreParentCenter(result.centers, new URL(location.href));
      setCenters(result.centers);
      setSource(result.source);
      setSelected(current);
      setLoading(false);
      const requested = new URL(location.href).searchParams.get("centerId");
      setError(requested && !current ? "Cơ sở trong liên kết không được cấp quyền." :
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
      const center = restoreParentCenter(centers, new URL(location.href));
      setSelected(center);
      setError(new URL(location.href).searchParams.has("centerId") && !center ?
        "Cơ sở trong liên kết không được cấp quyền." : "");
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [centers, loading]);
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
    setSelected(centerId);
    setError("");
  };
  return <Context.Provider value={{ centers, source, selected, loading, error, selectCenter }}>
    {children}
  </Context.Provider>;
}
export const useBoCenterSelection = () => useContext(Context);
