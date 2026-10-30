"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useMemo, useState } from "react";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { BusinessDataGrid, type SlotLoaders } from "@/app/components/workspace-renderer/Slots";
import { createBoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { loadAuthorizedDirectoryCenters, type DirectoryCenter, type DirectoryCenterSource } from "../pinoria-avatars/centers";
import { parentDefinition, parentFields, parentProvider, parentQuery } from "./schema";
import { readScopedParentDetail } from "./provider";
import { parentCenterUrl, restoreParentCenter } from "./navigation";

type Fields = typeof parentFields;
type Ready = { adapter: AuthenticatedSurfaceAdapter<Fields>; navigation: AdapterNavigation<Fields> };

export function parentBusinessLoaders(adapter: AuthenticatedSurfaceAdapter<Fields>): SlotLoaders {
  return {
    "bo-parent-detail": async (slot, record, context, signal) => {
      if (context !== adapter.context || !context.authorize("identity.parent_directory.view") ||
          !["students", "contacts"].includes(slot.id)) throw Error("Unregistered or unauthorized Parent slot");
      // Authenticated TDD controller revalidates the actor before and after the
      // Center-scoped Core read. Stale/changed sessions cannot commit slot data.
      if (!await adapter.detail(record.id, signal)) throw Error("Parent no longer authorized");
      const detail = await readScopedParentDetail(record.id, adapter.scope, fetch, signal);
      if (!await adapter.detail(record.id, signal)) throw Error("Parent authorization changed");
      signal.throwIfAborted();
      if (slot.id === "students") {
        const rows = detail.students.map(r => ({ id: String(r.id), name: String(r.name), relationship: String(r.relationship), linkedAt: String(r.linkedAt) }));
        return <BusinessDataGrid rows={rows} columns={[
          { key: "name", header: "Học viên", render: r => r.name },
          { key: "relationship", header: "Quan hệ", render: r => r.relationship },
          { key: "linkedAt", header: "Liên kết từ", render: r => r.linkedAt.slice(0, 10) },
        ]} rowKey={r => r.id} caption="Học viên liên kết hiện tại" emptyTitle="Chưa có liên kết" emptyMessage="Không có học viên được cấp quyền trong cơ sở này." showToolbar={false} />;
      }
      const rows = detail.contacts.map(r => ({ id: String(r.id), type: String(r.type), maskedValue: String(r.maskedValue), primary: Boolean(r.primary), verified: Boolean(r.verified) }));
      return <BusinessDataGrid rows={rows} columns={[
        { key: "type", header: "Loại", render: r => r.type },
        { key: "maskedValue", header: "Liên hệ (đã che)", render: r => r.maskedValue },
        { key: "primary", header: "Chính", render: r => r.primary ? "Có" : "Không" },
        { key: "verified", header: "Xác minh", render: r => r.verified ? "Đã xác minh" : "Chưa xác minh" },
      ]} rowKey={r => r.id} caption="Liên hệ đã che" emptyTitle="Không có liên hệ" emptyMessage="Không có liên hệ đang hoạt động." showToolbar={false} />;
    },
  };
}

/** Staging-only source seam; intentionally NOT mounted by BO RuntimeEntry until
 * exact Core+Team CD, five-viewport parity, and Founder visual acceptance. */
export function ParentTdd() {
  const [centers, setCenters] = useState<readonly DirectoryCenter[]>([]);
  const [source, setSource] = useState<DirectoryCenterSource>("centers");
  const [selected, setSelected] = useState("");
  const [centerError, setCenterError] = useState("");
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    void loadAuthorizedDirectoryCenters(fetch, ctl.signal).then(({ centers: results, source: kind }) => {
      if (ctl.signal.aborted) return;
      setCenters(results); setSource(kind);
      setSelected(restoreParentCenter(results, new URL(location.href)));
      if (!results.length) setCenterError("Không có cơ sở được cấp quyền.");
    }).catch(() => { if (!ctl.signal.aborted) setCenterError("Không thể tải cơ sở được cấp quyền."); });
    return () => ctl.abort();
  }, []);
  useEffect(() => {
    setReady(null); setError("");
    if (!selected) return;
    const ctl = new AbortController();
    let active: AuthenticatedSurfaceAdapter<Fields> | null = null;
    void createBoTddAdapter({ registry: new TddRegistry(), definition: parentDefinition, provider: parentProvider, centerId: selected, centerSource: source }, ctl.signal)
      .then(adapter => {
        active = adapter;
        if (ctl.signal.aborted) { adapter.dispose(); return; }
        setReady({ adapter, navigation: browserTddNavigation("BO", "parents", parentQuery) });
      }).catch(() => { if (!ctl.signal.aborted) setError("Không có quyền hoặc chưa thể tải Parent TDD trong cơ sở này."); });
    return () => { ctl.abort(); active?.dispose(); };
  }, [selected, source, retry]);
  // Preserve the existing TDD record/tab history entry when remembering its Center.
  // On Back/Forward, validate the URL context against the current authorized choices.
  useEffect(() => {
    const restore = () => setSelected(restoreParentCenter(centers, new URL(location.href)));
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [centers]);
  const selectCenter = (centerId: string) => {
    history.replaceState(history.state, "", parentCenterUrl(new URL(location.href), centerId));
    setSelected(centerId);
  };
  const loaders = useMemo(() => ready ? parentBusinessLoaders(ready.adapter) : undefined, [ready]);
  return <section aria-label="Parents & Guardians">
    <label htmlFor="tdd-parent-center">Cơ sở</label>{" "}
    <select id="tdd-parent-center" value={selected} onChange={e => selectCenter(e.target.value)}>
      <option value="">Chọn cơ sở được cấp quyền</option>
      {centers.map(c => <option value={c.id} key={c.id}>{c.displayName}</option>)}
    </select>
    {centerError ? <p role="alert">{centerError}</p> : null}
    {selected ? error ? <p role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Thử lại</button></p> :
      ready ? <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={parentQuery} businessLoaders={loaders} /> :
      <p role="status">Đang xác thực quyền Parents theo cơ sở…</p> : null}
  </section>;
}
