"use client";
// PAP-2353 · HO Manual Staff Creation: only dynamically loaded by the server-admitted preview page.
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useRef, useState } from "react";
import { createHoTddAdapter, type AuthenticatedSurfaceAdapter, type SurfaceProvider } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { TddPreferencePolicy } from "@/app/components/workspace-renderer/Record";
import { HoWorkspace } from "../HoWorkspace";
import { StaffManualWorkspace } from "./StaffManualWorkspace";
import { manualStaffDefinition, manualStaffQuery, type ManualStaffFields } from "./manual-create-contract";
import { newStaffPreview, readStaffPreview, createStaffPreviewRecord, staffPreviewCenter, projectStaffPreviewRow } from "./manual-create-preview";
type Ready = { adapter: AuthenticatedSurfaceAdapter<ManualStaffFields>; navigation: AdapterNavigation<ManualStaffFields> };
export function StaffManualPreview({ principalId }: { principalId: string }) {
  const state = useRef(newStaffPreview(principalId));
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let adapter: AuthenticatedSurfaceAdapter<ManualStaffFields> | undefined;
    const provider: SurfaceProvider<ManualStaffFields> = {
      pagination: "local-ui",
      async list(_query, scope, _fetcher, signal) {
        signal.throwIfAborted(); if (scope.surface !== "HO") throw Error("HO only");
        return { records: state.current.records.map(row => ({ row: projectStaffPreviewRow(row) })), total: state.current.records.length };
      },
      async detail(id, scope, _fetcher, signal) {
        signal.throwIfAborted(); if (scope.surface !== "HO") throw Error("HO only");
        const row = readStaffPreview(state.current, id); return row ? { row: projectStaffPreviewRow(row) } : null;
      },
    };
    void createHoTddAdapter({ registry: new TddRegistry(), definition: manualStaffDefinition, provider }, controller.signal).then(result => {
      adapter = result;
      if (controller.signal.aborted || result.userId !== principalId) { result.dispose(); if (!controller.signal.aborted) setError(true); return; }
      setReady({ adapter: result, navigation: browserTddNavigation("HO", "staffs", manualStaffQuery) });
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); adapter?.dispose(); };
  }, [principalId]);
  return <HoWorkspace module="staffs" content={error ? <p role="alert">Không thể mở M1 Staff.</p> : ready ? <TddPreferencePolicy.Provider value="ephemeral">
    <StaffManualWorkspace adapter={ready.adapter} navigation={ready.navigation} centers={[staffPreviewCenter]} onCreate={async command => {
      // Refresh the existing authorized session, never call a real mutation.
      await ready.adapter.list(manualStaffQuery, AbortSignal.timeout(10000));
      if (ready.adapter.userId !== principalId || !ready.adapter.context.authorize("team.bo.access")) throw Error("Preview denied");
      state.current = createStaffPreviewRecord(state.current, command);
    }} />
  </TddPreferencePolicy.Provider> : <p role="status">Đang tải Staff…</p>} />;
}
