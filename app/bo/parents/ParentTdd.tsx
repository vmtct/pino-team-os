"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useContext, useEffect, useMemo, useState } from "react";
import { SurfaceWorkspace, TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { BusinessDataGrid, type SlotLoaders } from "@/app/components/workspace-renderer/Slots";
import { createBoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { useBoCenterSelection } from "../components/registration/BoCenterSelection";
import { parentDefinition, parentFields, parentProvider, parentQuery } from "./schema";
import { readScopedParentDetail } from "./provider";

type Fields = typeof parentFields;
type Ready = { centerId: string; adapter: AuthenticatedSurfaceAdapter<Fields>; navigation: AdapterNavigation<Fields> };

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

/** PAP-1301: the BO shell alone owns Center selection; no inline dropdown.
 * The TDD Parent adapter independently checks actor, scope and Core permissions. */
export function ParentTdd() {
  const mobileMenu = useContext(TddHostMenu);
  const center = useBoCenterSelection();
  const selected = center?.selected ?? "";
  const source = center?.source ?? "centers";
  const [ready, setReady] = useState<Ready | null>(null);
  const [failure, setFailure] = useState<{ centerId: string; retry: number; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!selected) return;
    const ctl = new AbortController();
    let active: AuthenticatedSurfaceAdapter<Fields> | null = null;
    void createBoTddAdapter({ registry: new TddRegistry(), definition: parentDefinition, provider: parentProvider, centerId: selected, centerSource: source }, ctl.signal)
      .then(adapter => {
        active = adapter;
        if (ctl.signal.aborted) { adapter.dispose(); return; }
        setReady({ centerId: selected, adapter, navigation: browserTddNavigation("BO", "parents", parentQuery) });
      }).catch(() => { if (!ctl.signal.aborted) setFailure({ centerId: selected, retry, message: "Không có quyền hoặc chưa thể tải Parent TDD trong cơ sở này." }); });
    return () => { ctl.abort(); active?.dispose(); };
  }, [selected, source, retry]);
  const current = ready?.centerId === selected ? ready : null;
  const loaders = useMemo(() => current ? parentBusinessLoaders(current.adapter) : undefined, [current]);
  const error = failure?.centerId === selected && failure.retry === retry ? failure.message : "";
  return <section aria-label="Parents & Guardians">
    {/* Before Center authorization resolves there is no SurfaceWorkspace to host the mobile menu. */}
    {!current ? mobileMenu("parent-pilot-menu-btn") : null}
    {!center ? <p role="alert">Không tìm thấy Center context của BO.</p> :
      center.loading ? <p role="status">Đang tải cơ sở được cấp quyền…</p> :
      center.error ? <p role="alert">{center.error}</p> : null}
    {selected ? error ? <p role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Thử lại</button></p> :
      current ? <SurfaceWorkspace key={selected} adapter={current.adapter} navigation={current.navigation} initialQuery={parentQuery} businessLoaders={loaders} /> :
      <p role="status">Đang xác thực quyền Parents theo cơ sở…</p> :
      !center?.loading && !center?.error ? <p role="status">Chọn trung tâm tại góc trên trái để xem Parents.</p> : null}
  </section>;
}
