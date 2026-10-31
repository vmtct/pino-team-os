"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useState } from "react";
import { createHoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { missionDefinition, missionFields, missionProvider, missionQuery } from "./schema";

type F = typeof missionFields;
type Ready = { adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
export const missionWriteUnavailable =
  "Tạo, sửa, lưu trữ hoặc xóa Mission chưa khả dụng: Core GLOBAL Founder writer và HO gateway chưa được phê duyệt triển khai. Danh mục hiện tại chỉ đọc.";
/** PAP-1207: HO read-only typed MissionDefinition using the canonical shared TDD engine. */
export function HoMissionsTdd() {
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let bound: AuthenticatedSurfaceAdapter<F> | null = null;
    void createHoTddAdapter({ registry: new TddRegistry(), definition: missionDefinition, provider: missionProvider }, controller.signal)
      .then(adapter => {
        bound = adapter;
        if (controller.signal.aborted) { adapter.dispose(); return; }
        setReady({ adapter, navigation: browserTddNavigation("HO", "missions", missionQuery) });
      })
      .catch(() => { if (!controller.signal.aborted) setError("Không thể xác thực quyền xem Mission trên HO."); });
    return () => { controller.abort(); bound?.dispose(); };
  }, [retry]);
  const content = <section data-testid="ho-missions-tdd" aria-label="Danh mục Mission toàn hệ thống">
    <p role="note">{missionWriteUnavailable}</p>
    {error ? <p role="alert">{error} <button type="button" onClick={() => { setReady(null); setError(""); setRetry(n => n + 1); }}>Thử lại</button></p> :
      ready ? <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={missionQuery} /> :
      <p role="status">Đang xác thực HO và tải Mission từ Core…</p>}
  </section>;
  return <HoWorkspace module="missions" content={content} />;
}
