"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useState } from "react";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { createHoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { BoApiError } from "@/lib/bo-api-error";
import { centerDefinition, centerFields, centerProvider, centerQuery } from "./schema";
type F = typeof centerFields;
type Ready = { adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
export function HoCenters() {
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState<"denied" | "error" | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let adapter: AuthenticatedSurfaceAdapter<F> | null = null;
    void createHoTddAdapter({ registry: new TddRegistry(), definition: centerDefinition, provider: centerProvider }, controller.signal)
      .then(result => {
        adapter = result;
        if (controller.signal.aborted) { result.dispose(); return; }
        setReady({ adapter: result, navigation: browserTddNavigation("HO", "centers", centerQuery) });
      }).catch(error => { if (!controller.signal.aborted) setError(error instanceof BoApiError && [401, 403].includes(error.status) ? "denied" : "error"); });
    return () => { controller.abort(); adapter?.dispose(); };
  }, [retry]);
  const content = error ? <p role="alert">{error === "denied" ? "Không có quyền xem Centers." : "Không tải được danh sách Centers."} <button type="button" onClick={() => { setReady(null); setError(null); setRetry(x => x + 1); }}>Thử lại</button></p>
    : ready ? <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={centerQuery} /> : <p role="status">Đang tải Centers…</p>;
  return <HoWorkspace module="centers" content={content} />;
}
