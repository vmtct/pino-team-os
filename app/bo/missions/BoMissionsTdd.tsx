"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoCenter } from "@/lib/bo-model";
import { assignmentUuid } from "@/lib/bo-mission-assignments";
import { createBoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import type { SlotLoaders } from "@/app/components/workspace-renderer/Slots";
import { BoRegistrationWorkspace } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { useBoStagingUser } from "@/app/bo/components/registration/BoRuntimeBoundary";
import { unifiedBoWorkspaceSource } from "@/app/bo/architecture/bo-unified-workspace-source";
import { assignmentDefinition, assignmentFields, assignmentProvider, assignmentQuery } from "./schema";
import { missionCenterFromUrl, missionCenterUrl } from "./navigation";

type F = typeof assignmentFields;
type Ready = { centerId: string; adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
export const assignmentUnavailable = {
  results: "Kết quả chưa khả dụng: nguồn kết quả học viên chưa được kết nối. Trạng thái giao nhiệm vụ không phải kết quả hoàn tất.",
  diary: "Nhật Ký chưa khả dụng: cần nguồn liên kết trực tiếp với nhiệm vụ được giao. Không suy diễn từ Student hoặc Mission.",
  create: "Giao nhiệm vụ chưa khả dụng trong lát cắt chỉ đọc này: chưa xác minh đầy đủ nguồn chọn Student hiện hành của Center và Mission ACTIVE được cấp quyền. Không thể nhập ID để bỏ qua kiểm tra.",
} as const;
const businessLoaders: SlotLoaders = {
  results: async () => <p role="status">{assignmentUnavailable.results}</p>,
  diary: async () => <p role="status">{assignmentUnavailable.diary}</p>,
};
/** PAP-1210 Team Surface Decision:
 * surface: BO; primary_device: DESKTOP; tos: {app_family: NONE, footer_items: []}
 * bo: {sidebar_group: SCHOOL, subnavigation: missions, primary_layout: TABLE}
 * shared: {permission_context: student.mission_assignment.view CENTER, cross_domain_links: []}
 * founder_layout_review: APPROVED (PAP-1190, existing BO shell slot).
 */
export function BoMissionsTdd() {
  const user = useBoStagingUser();
  const [centers, setCenters] = useState<readonly BoCenter[]>([]);
  const [centerId, setCenterId] = useState("");
  const [centerError, setCenterError] = useState("");
  const [centerRetry, setCenterRetry] = useState(0);
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void boApi.centers().then(rows => {
      if (!active) return;
      const allowed = rows.filter(c => assignmentUuid.test(c.id) && c.status === "active");
      setCenters(allowed);
      setCenterId(missionCenterFromUrl(allowed, new URL(window.location.href)));
      setCenterError(allowed.length ? "" : "Không có Center đang hoạt động được cấp quyền.");
    }).catch(() => { if (active) setCenterError("Không tải được danh sách Center."); });
    return () => { active = false; };
  }, [centerRetry]);
  useEffect(() => {
    const sync = () => {
      const next = missionCenterFromUrl(centers, new URL(window.location.href));
      if (next !== centerId) { setCenterId(next); setReady(null); setError(""); }
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [centers, centerId]);
  useEffect(() => {
    if (!centerId) return;
    const controller = new AbortController();
    let adapter: AuthenticatedSurfaceAdapter<F> | null = null;
    void createBoTddAdapter({ registry: new TddRegistry(), definition: assignmentDefinition, provider: assignmentProvider, centerId, centerSource: "centers" }, controller.signal)
      .then(bound => {
        adapter = bound;
        if (controller.signal.aborted) { bound.dispose(); return; }
        const navigation = browserTddNavigation("BO", "missions", assignmentQuery);
        setReady({ centerId, adapter: bound, navigation });
      }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Không đủ quyền đọc Nhiệm vụ."); });
    return () => { controller.abort(); adapter?.dispose(); };
  }, [centerId, retry]);
  function selectCenter(id: string) {
    setReady(null); setError(""); setCenterId(id);
    // A selected assignment belongs to its original Center; don't carry it to another scope.
    window.history.pushState(null, "", missionCenterUrl(new URL(window.location.href), id));
  }
  const content = <section data-testid="bo-missions-tdd" aria-label="Nhiệm vụ tại Center">
    <div className="property-row"><label htmlFor="bo-mission-center">Center</label>
      <select id="bo-mission-center" value={centerId} onChange={e => selectCenter(e.target.value)}>
        <option value="">Chọn Center</option>{centers.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
      </select>
    </div>
    <p role="note">{assignmentUnavailable.create}</p>
    {!centerId ? <p role="status">{centerError || "Chọn Center để đọc Nhiệm vụ."} {centerError ? <button type="button" onClick={() => { setCenterError(""); setCenterRetry(n => n + 1); }}>Thử lại</button> : null}</p> :
      error ? <p role="alert">{error} <button type="button" onClick={() => { setError(""); setRetry(n => n + 1); }}>Thử lại</button></p> :
      ready?.centerId === centerId ? <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={assignmentQuery} businessLoaders={businessLoaders} /> :
      <p role="status">Đang xác thực Center và quyền đọc Nhiệm vụ…</p>}
  </section>;
  return <BoRegistrationWorkspace source={unifiedBoWorkspaceSource} moduleKey="missions" currentUser={user ?? { displayName: null }} content={content} />;
}
