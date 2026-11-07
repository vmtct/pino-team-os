"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useState } from "react";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import type { AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { createHoPathTddAdapter } from "./transport";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { BoApiError } from "@/lib/bo-api-error";
import { pathDefinition, pathFields, pathProvider, pathQuery } from "./schema";
type F = typeof pathFields;
type Ready = { adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };

export function HoPaths() {
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState<"denied" | "error" | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let adapter: AuthenticatedSurfaceAdapter<F> | null = null;
    void createHoPathTddAdapter({ registry: new TddRegistry(), definition: pathDefinition, provider: pathProvider }, controller.signal)
      .then(result => {
        adapter = result;
        if (controller.signal.aborted) { result.dispose(); return; }
        setReady({ adapter: result, navigation: browserTddNavigation("HO", "paths", pathQuery) });
      }).catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof BoApiError && [401, 403].includes(cause.status) ? "denied" : "error");
      });
    return () => { controller.abort(); adapter?.dispose(); };
  }, [retry]);
  const content = error
    ? <p role="alert">{error === "denied" ? "Không có quyền xem Path." : "Không tải được danh sách Path."}{" "}
        <button type="button" onClick={() => { setReady(null); setError(null); setRetry(x => x + 1); }}>Thử lại</button></p>
    : ready ? <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={pathQuery} />
      : <p role="status">Đang tải Path…</p>;
  return <HoWorkspace module="paths" content={content} />;
}
