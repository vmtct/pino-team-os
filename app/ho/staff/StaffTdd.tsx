"use client";
import { useEffect, useState } from "react";
import { createHoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { HoWorkspace } from "../HoWorkspace";
import { staffRateProvider } from "./staff-rate-provider";
import { StaffPasswordReset } from "./StaffPasswordReset";
import { staffDefinition, staffFields, staffProvider, staffQuery } from "./schema";

type F = typeof staffFields;
type Ready = { adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
/** Existing HO host + TDD controller: Salary owns data and permission-bound provider only. */
export function StaffTdd() {
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let adapter: AuthenticatedSurfaceAdapter<F> | null = null;
    void createHoTddAdapter({ registry: new TddRegistry(), definition: staffDefinition, provider: staffProvider }, controller.signal)
      .then(result => {
        adapter = result;
        if (controller.signal.aborted) { result.dispose();return; }
        const navigation = browserTddNavigation("HO", "staffs", staffQuery);
        setReady({ adapter: result, navigation });
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort();adapter?.dispose(); };
  }, [retry]);
  const content = error
    ? <p role="alert">Không tải được danh sách Staff. <button type="button" onClick={() => { setReady(null);setError(false);setRetry(x => x + 1); }}>Thử lại</button></p>
    : ready
      ? <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={staffQuery} businessForms={[staffRateProvider]} detailOverview={(record, context, principalId) => <StaffPasswordReset staffId={record.id} displayName={String(record.name)} active={record.status === "Đang làm"} authorized={context.authorize("access.staff_password.reset")} principalId={principalId} />} />
      : <p role="status">Đang tải Staff…</p>;
  return <HoWorkspace module="staffs" content={content} />;
}
