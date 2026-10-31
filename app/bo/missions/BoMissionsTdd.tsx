"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useRef, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoCenter } from "@/lib/bo-model";
import { assignmentUuid, readMissionAssignment, type MissionAssignment } from "@/lib/bo-mission-assignments";
import { submitBoMissionAssignment, type AssignmentWrite } from "@/lib/bo-mission-assignment-command";
import { createBoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry, type TddActionBindings } from "@/lib/workspace-schema";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { TddRenderer } from "@/app/components/workspace-renderer/Renderer";
import type { SlotLoaders } from "@/app/components/workspace-renderer/Slots";
import { BoRegistrationWorkspace } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { useBoStagingUser } from "@/app/bo/components/registration/BoRuntimeBoundary";
import { unifiedBoWorkspaceSource } from "@/app/bo/architecture/bo-unified-workspace-source";
import { assignmentDefinition, assignmentFields, assignmentProvider, assignmentQuery } from "./schema";
import { AssignmentFields, assignmentFormError, emptyAssignmentDraft, type AssignmentDraft } from "./AssignmentFields";
import { missionCenterFromUrl, missionCenterUrl } from "./navigation";

type F = typeof assignmentFields;
type Ready = { centerId: string; adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
type FormMode = "create" | "edit" | "cancel";
export const assignmentUnavailable = {
  results: "Kết quả chưa khả dụng: nguồn kết quả học viên chưa được kết nối. Trạng thái giao nhiệm vụ không phải kết quả hoàn tất.",
  diary: "Nhật Ký chưa khả dụng: cần nguồn liên kết trực tiếp với nhiệm vụ được giao. Không suy diễn từ Student hoặc Mission.",
  create: "Giao nhiệm vụ dùng học viên thuộc Center được Core cấp quyền và Mission ACTIVE; không nhập ID tự do.",
} as const;
const businessLoaders: SlotLoaders = {
  results: async () => <p role="status">{assignmentUnavailable.results}</p>,
  diary: async () => <p role="status">{assignmentUnavailable.diary}</p>,
};
/** PAP-1210 / Epic PAP-1188: BO typed TDD and declared shared Action Host only.
 * Source-backed Student/Mission selectors; receipt/readback, no optimistic fake status.
 * Core independently owns every Center grant and mutation.
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
  const [mode, setMode] = useState<FormMode | null>(null);
  const [target, setTarget] = useState<MissionAssignment | null>(null);
  const [draft, setDraft] = useState<AssignmentDraft>(emptyAssignmentDraft);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [formError, setFormError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [confirmed, setConfirmed] = useState("");
  const commandKey = useRef<string | null>(null);
  const writing = useRef(false);
  const effectiveCenter = useRef(centerId);
  useEffect(() => { effectiveCenter.current = centerId; }, [centerId]);
  useEffect(() => {
    let active = true;
    void boApi.centers().then(rows => {
      if (!active) return;
      const allowed = rows.filter(c => assignmentUuid.test(c.id) && c.status === "active");
      setCenters(allowed);
      const selectedCenter = missionCenterFromUrl(allowed, new URL(window.location.href));
      effectiveCenter.current = selectedCenter;
      setCenterId(selectedCenter);
      setCenterError(allowed.length ? "" : "Không có Center đang hoạt động được cấp quyền.");
    }).catch(() => { if (active) setCenterError("Không tải được danh sách Center."); });
    return () => { active = false; };
  }, [centerRetry]);
  useEffect(() => {
    const sync = () => {
      const next = missionCenterFromUrl(centers, new URL(window.location.href));
      if (next !== centerId) { effectiveCenter.current = next; setCenterId(next); setReady(null); setError(""); setMode(null); setTarget(null); }
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [centers, centerId]);
  useEffect(() => {
    if (!centerId) return;
    const controller = new AbortController();
    let adapter: AuthenticatedSurfaceAdapter<F> | null = null;
    void createBoTddAdapter({ registry: new TddRegistry(), definition: assignmentDefinition,
      provider: assignmentProvider, centerId: centerId, centerSource: "centers" }, controller.signal)
      .then(bound => {
        adapter = bound;
        if (controller.signal.aborted) { bound.dispose(); return; }
        setReady({ centerId, adapter: bound, navigation: browserTddNavigation("BO", "missions", assignmentQuery) });
      }).catch(e => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Không đủ quyền đọc Nhiệm vụ.");
      });
    return () => { controller.abort(); adapter?.dispose(); };
  }, [centerId, retry]);
  function selectCenter(id: string) {
    if (writing.current || pending) return;
    effectiveCenter.current = id;
    setReady(null); setError(""); setCenterId(id); setMode(null); setTarget(null);
    setDraft(emptyAssignmentDraft); setLoadError(""); setConfirmed("");
    // A selected assignment belongs to its original Center; never reuse its identity.
    window.history.pushState(null, "", missionCenterUrl(new URL(window.location.href), id));
  }
  const close = () => {
    if (writing.current || pending) return;
    setMode(null); setTarget(null); setFormError("");
  };
  const openCreate = () => {
    if (!ready || ready.centerId !== centerId || writing.current || pending || uncertain || mode) return;
    if (!ready.adapter.context.authorize("student.mission_assignment.manage")) return;
    commandKey.current = "mission-assignment-create-" + crypto.randomUUID();
    setDraft(emptyAssignmentDraft); setTarget(null); setFormError(""); setLoadError(""); setConfirmed(""); setMode("create");
  };
  const openChange = async (kind: "edit" | "cancel") => {
    if (!ready || ready.centerId !== centerId || writing.current || pending || uncertain || mode) return;
    if (!ready.adapter.context.authorize("student.mission_assignment.manage")) return;
    const selected = ready.navigation.read();
    if (selected.kind !== "detail" || !selected.recordId) return;
    setPending(true);setLoadError("");
    try {
      const current = await readMissionAssignment(fetch, centerId, selected.recordId, new AbortController().signal);
      if (!current || current.status !== "ASSIGNED") {
        setLoadError("Nhiệm vụ không còn đang giao. Tải lại bản ghi trước khi thao tác.");
        return;
      }
      if (ready.centerId !== centerId || effectiveCenter.current !== centerId ||
          ready.navigation.read().recordId !== current.id) return;
      setTarget(current);
      setDraft({ ...emptyAssignmentDraft, studentId: current.studentId, missionId: current.missionId,
        contextLabel: current.contextLabel ?? "" });
      commandKey.current = "mission-assignment-" + kind + "-" + crypto.randomUUID();
      setFormError("");setConfirmed("");setMode(kind);
    } catch {
      setLoadError("Không đọc được bản ghi hiện tại từ Core; không thao tác trên bản cũ.");
    } finally { setPending(false); }
  };
  const submit = async () => {
    if (!mode || !ready || ready.centerId !== centerId || effectiveCenter.current !== centerId ||
        !commandKey.current || writing.current || uncertain || pending) return { state: "unverified" as const };
    if (!ready.adapter.context.authorize("student.mission_assignment.manage")) return { state: "denied" as const };
    const invalid = assignmentFormError(mode, draft);
    if (invalid) { setFormError(invalid); return { state: "invalid" as const }; }
    if (mode !== "create" && (!target || target.centerId !== centerId || target.status !== "ASSIGNED")) {
      setFormError("Nhiệm vụ đã thay đổi hoặc khác Center. Tải lại bản ghi.");
      return { state: "invalid" as const };
    }
    let command: AssignmentWrite;
    if (mode === "create") command = { kind: "create", centerId, studentId: draft.studentId,
      missionId: draft.missionId, contextLabel: draft.contextLabel.trim() || null, idempotencyKey: commandKey.current };
    else if (mode === "edit") command = { kind: "update", centerId, id: target!.id,
      expectedVersion: target!.version, contextLabel: draft.contextLabel.trim() || null, idempotencyKey: commandKey.current };
    else command = { kind: "cancel", centerId, id: target!.id, expectedVersion: target!.version,
      reason: draft.cancelReason.trim(), idempotencyKey: commandKey.current };
    writing.current = true;setPending(true);setFormError("");
    try {
      const result = await submitBoMissionAssignment(command);
      if (result.state === "verified") {
        if (effectiveCenter.current !== centerId) return result;
        setConfirmed("Đã đối chiếu giao Nhiệm vụ trên Core (" + result.record.missionCodeSnapshot + ").");
        setMode(null); setTarget(null); setReady(null); setRetry(n => n + 1);
      } else {
        setFormError(result.message);
        if (result.state === "unverified") setUncertain(true);
      }
      return result;
    } finally { writing.current = false;setPending(false); }
  };
  const actions: TddActionBindings = {
    openCreate: { kind: "navigation", disabled: pending || uncertain || mode !== null, run: openCreate },
    openEdit: { kind: "navigation", disabled: pending || uncertain || mode !== null, run: () => openChange("edit") },
    openCancel: { kind: "navigation", disabled: pending || uncertain || mode !== null, run: () => openChange("cancel") },
    cancelCreate: { kind: "navigation", disabled: pending, run: close },
    saveCreate: { kind: "mutation", disabled: pending || uncertain || mode !== "create" ||
      Boolean(assignmentFormError("create", draft)), run: submit },
    cancelEdit: { kind: "navigation", disabled: pending, run: close },
    saveEdit: { kind: "mutation", visible: mode === "edit", disabled: pending || uncertain ||
      Boolean(assignmentFormError("edit", draft)), run: submit },
    confirmCancel: { kind: "mutation", visible: mode === "cancel", disabled: pending || uncertain ||
      Boolean(assignmentFormError("cancel", draft)), run: submit },
  };
  const content = <section data-testid="bo-missions-tdd" aria-label="Nhiệm vụ tại Center">
    <div className="property-row"><label htmlFor="bo-mission-center">Center</label>
      <select id="bo-mission-center" value={centerId} disabled={pending} onChange={e => selectCenter(e.target.value)}>
        <option value="">Chọn Center</option>{centers.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
      </select>
    </div>
    <p role="note">{assignmentUnavailable.create}</p>
    {confirmed ? <p role="status">{confirmed}</p> : null}
    {loadError ? <p role="alert">{loadError}</p> : null}
    {uncertain ? <p role="alert">Kết quả ghi chưa xác minh. Đối chiếu Core trước khi gửi lại hoặc mở lệnh mới.</p> : null}
    {!centerId ? <p role="status">{centerError || "Chọn Center để đọc Nhiệm vụ."}
      {centerError ? <button type="button" onClick={() => { setCenterError("");setCenterRetry(n => n + 1); }}>Thử lại</button> : null}</p> :
      error ? <p role="alert">{error} <button type="button" onClick={() => { setError("");setRetry(n => n + 1); }}>Thử lại</button></p> :
      ready?.centerId === centerId ? <>
        <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={assignmentQuery}
          businessLoaders={businessLoaders} actionBindings={actions} />
        {mode ? <TddRenderer view={{ kind: "form", props: {
          registry: ready.adapter.registry, schema: ready.adapter.schema, context: ready.adapter.context,
          mode: mode === "create" ? "create" : "edit",
          ...(target ? { recordId: target.id } : {}),
          title: mode === "create" ? "Giao Nhiệm vụ" : mode === "edit" ? "Sửa Nhiệm vụ" : "Hủy giao Nhiệm vụ",
          onClose: close, actionBindings: actions,
          content: <>
            <AssignmentFields key={centerId + ":" + mode} centerId={centerId} mode={mode}
              value={draft} setValue={setDraft} disabled={pending || uncertain} target={target ?
                { studentId: target.studentId, missionName: target.missionNameSnapshot, status: target.status } : null} />
            {formError ? <p role="alert">{formError}</p> : null}
          </>,
        } }} /> : null}
      </> : <p role="status">Đang xác thực Center và quyền đọc Nhiệm vụ…</p>}
  </section>;
  return <BoRegistrationWorkspace source={unifiedBoWorkspaceSource} moduleKey="missions" currentUser={user ?? { displayName: null }} content={content} />;
}
