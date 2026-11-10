"use client";
import { useCallback, useEffect, useState } from "react";
import type { AuthorizationContext, HistoryResult } from "@/lib/workspace-schema";
import { readMissionHistory } from "@/lib/mission-history";
import { readBoMissionCompletionHistory } from "@/lib/bo-mission-completion-client";
import { projectMissionC1History } from "@/lib/bo-mission-audit-projection";
import { BoApiError } from "@/lib/bo-api-error";
import { HistoryState } from "@/app/components/workspace-renderer/History";
import styles from "./MissionDetailEnhancements.module.css";
/** Independent read failure handling: generic Core 409 must retain its status,
 * and failed Assignment audit must not suppress valid C1 events. */
type ReadResult<T> = { status: "loading" } | { status: "ready"; value: T } | { status: "error"; error: unknown };
function useHistoryResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [token, setToken] = useState(0);
  const [state, setState] = useState<{ load: typeof load; token: number; result: ReadResult<T> } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then(value => {
      if (!controller.signal.aborted) setState({ load, token, result: { status: "ready", value } });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ load, token, result: { status: "error", error } });
    });
    return () => controller.abort();
  }, [load, token]);
  return { result: state?.load === load && state.token === token
    ? state.result : { status: "loading" } as ReadResult<T>,
    retry: () => setToken(x => x + 1) };
}

/** PAP-1792 S0-R3: one canonical TDD History tab; two independently authorized Core sources.
 * Neither generic provenance 409 nor C1 failures may hide the other source. */
export function BoMissionHistory({
  id, centerId, context,
}: { readonly id: string; readonly centerId: string; readonly context: AuthorizationContext }) {
  if (context.surface !== "BO" || context.centerId !== centerId ||
      !context.authorize("student.mission_assignment.view"))
    return <p role="status">Không có quyền xem lịch sử Nhiệm vụ tại Center này.</p>;
  return <section aria-label="Lịch sử Nhiệm vụ" data-pap1792-dual-history className={styles.missionHistory}>
    <p className="settings-hint">Hai nguồn lịch sử độc lập. Chỉ hiển thị tên người thực hiện khi Core cung cấp danh tính đã xác minh.</p>
    <section className="v24-prop-section" aria-label="Lịch sử Hoàn thành C1">
      <h3>Lịch sử Hoàn thành · C1</h3>
      <C1History id={id} centerId={centerId}/>
    </section>
    <section className="v24-prop-section" aria-label="Lịch sử giao nhiệm vụ Assignment">
      <h3>Lịch sử giao nhiệm vụ · Assignment</h3>
      <AssignmentHistory id={id} centerId={centerId}/>
    </section>
  </section>;
}
function C1History({ id, centerId }: { readonly id: string; readonly centerId: string }) {
  const load = useCallback((signal: AbortSignal) =>
    readBoMissionCompletionHistory(fetch, centerId, id, signal)
      .then(events => projectMissionC1History(events, centerId, id)), [id, centerId]);
  const { result, retry } = useHistoryResource<HistoryResult>(load);
  if (result.status === "loading") return <p role="status">Đang tải lịch sử C1…</p>;
  if (result.status === "error") {
    const e = result.error;
    const denied = e instanceof BoApiError && [401, 403, 404].includes(e.status);
    return <div role="alert">{
      denied ? "Không có quyền xem lịch sử C1." : "Lịch sử C1 chưa thể xác minh từ Core."
    } <button type="button" onClick={retry}>Thử lại</button></div>;
  }
  return <HistoryState value={result.value} fields={[
    { key: "executionStatus", label: "Trạng thái C1" },
    { key: "executionVersion", label: "Phiên bản" },
    { key: "reason", label: "Lý do" },
  ]}/>;
}
function AssignmentHistory({ id, centerId }: { readonly id: string; readonly centerId: string }) {
  const load = useCallback((signal: AbortSignal) =>
    readMissionHistory(fetch,
      "/api/bo/learning/mission-assignments/" + id + "/history?centerId=" + encodeURIComponent(centerId),
      { type: "student_mission_assignment", id }, null, signal),
    [id, centerId]);
  const { result, retry } = useHistoryResource<HistoryResult>(load);
  if (result.status === "loading") return <p role="status">Đang tải lịch sử giao nhiệm vụ…</p>;
  if (result.status === "error") {
    const e = result.error;
    const conflict = e instanceof BoApiError && e.status === 409;
    const denied = e instanceof BoApiError && [401, 403, 404].includes(e.status);
    return <div role="alert" data-pap1792-assignment-history-error>{
      conflict
        ? "409 · PLATFORM_CONFLICT — Không thể xác minh Center của lịch sử giao nhiệm vụ. Nguồn Assignment bị chặn; lịch sử C1 vẫn hiển thị độc lập."
        : denied ? "Không có quyền xem lịch sử giao nhiệm vụ." : "Không thể xác minh lịch sử giao nhiệm vụ từ Core."
    } <button type="button" onClick={retry}>Thử lại</button></div>;
  }
  return <HistoryState value={result.value}/>;
}
