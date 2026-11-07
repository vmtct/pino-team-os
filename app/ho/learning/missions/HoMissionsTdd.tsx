"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useRef, useState } from "react";
import { createHoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry, type TddActionBindings } from "@/lib/workspace-schema";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { TddRenderer } from "@/app/components/workspace-renderer/Renderer";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { missionDefinition, missionFields, missionProvider, missionQuery } from "./schema";
import { submitHoMission, type MissionInput } from "./command";
import { loadMissionForEdit } from "./read-edit";
import { emptyMission, MissionCreateFields, validateMissionCreate } from "./MissionCreateFields";

type F = typeof missionFields;
type Ready = { adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
type EditTarget = { id: string; version: number; status: MissionInput["status"] };
/** PAP-1207: Create/Edit/Archive use canonical TDD Action Host; no local mutation buttons. */
export function HoMissionsTdd() {
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [draft, setDraft] = useState<MissionInput>(emptyMission);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [formError, setFormError] = useState("");
  const [editLoadError, setEditLoadError] = useState("");
  const [confirmed, setConfirmed] = useState("");
  const [archiveAvailable, setArchiveAvailable] = useState(false);
  const idempotency = useRef<string | null>(null);
  const writing = useRef(false);
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
  useEffect(() => {
    if (!ready) return;
    let active = true;
    let sequence = 0;
    const refreshArchiveEligibility = () => {
      const selected = ready.navigation.read();
      const current = ++sequence;
      setArchiveAvailable(false);
      if (selected.kind !== "detail" || !selected.recordId ||
          !ready.adapter.context.authorize("learning.mission.manage")) return;
      void loadMissionForEdit(selected.recordId).then(result => {
        if (!active || current !== sequence || ready.navigation.read().recordId !== selected.recordId) return;
        setArchiveAvailable(result.state === "ready" && result.data.status === "ACTIVE");
      }).catch(() => {
        if (active && current === sequence) setArchiveAvailable(false);
      });
    };
    const unsubscribe = ready.navigation.subscribe(refreshArchiveEligibility);
    refreshArchiveEligibility();
    return () => { active = false; sequence += 1; unsubscribe(); };
  }, [ready]);
  const close = () => {
    if (writing.current || pending) return;
    setMode(null); setEditTarget(null); setFormError("");
  };
  const open = () => {
    if (writing.current || pending || uncertain) return;
    idempotency.current = "mission-create-" + crypto.randomUUID();
    setDraft(emptyMission); setEditTarget(null); setFormError(""); setEditLoadError(""); setConfirmed(""); setMode("create");
  };
  const openEdit = async () => {
    if (writing.current || pending || uncertain || !ready || mode) return;
    if (!ready.adapter.context.authorize("learning.mission.manage")) return;
    const selected = ready.navigation.read();
    if (selected.kind !== "detail" || !selected.recordId) return;
    setPending(true); setEditLoadError("");
    try {
      const result = await loadMissionForEdit(selected.recordId);
      if (result.state !== "ready") { setEditLoadError(result.message); return; }
      if (ready.navigation.read().recordId !== result.id) return; // stale selected row
      setEditTarget({ id: result.id, version: result.version, status: result.data.status });
      setDraft(result.data); idempotency.current = "mission-edit-" + crypto.randomUUID();
      setFormError(""); setConfirmed(""); setMode("edit");
    } finally { setPending(false); }
  };
  const archiveMission = async () => {
    if (writing.current || pending || uncertain || !ready || mode) return;
    if (!ready.adapter.context.authorize("learning.mission.manage")) return;
    const selected = ready.navigation.read();
    if (selected.kind !== "detail" || !selected.recordId) return;
    setPending(true); setEditLoadError("");
    try {
      const loaded = await loadMissionForEdit(selected.recordId);
      if (loaded.state !== "ready") { setEditLoadError(loaded.message); return; }
      if (ready.navigation.read().recordId !== loaded.id) return;
      if (loaded.data.status !== "ACTIVE") {
        setEditLoadError("Mission đã ở trạng thái INACTIVE; không cần lưu trữ lại.");
        return;
      }
      const accepted = typeof window !== "undefined" && window.confirm(
        "Lưu trữ Mission " + loaded.data.code + " — " + loaded.data.name +
        "? Mission sẽ chuyển sang INACTIVE và không còn được giao mới. Assignment và Nhật Ký hiện có vẫn được giữ nguyên; thao tác này không xóa dữ liệu.",
      );
      if (!accepted || ready.navigation.read().recordId !== loaded.id || writing.current || uncertain) return;
      writing.current = true;
      idempotency.current = "mission-archive-" + crypto.randomUUID();
      const result = await submitHoMission({
        kind: "archive", id: loaded.id, expectedVersion: loaded.version,
        data: loaded.data, idempotencyKey: idempotency.current,
      });
      if (result.state === "verified") {
        ready.navigation.change({ kind: "table", tab: "overview", query: missionQuery });
        setConfirmed("Đã xác minh lưu trữ Mission " + result.record.code + " trên Core (INACTIVE).");
        setReady(null); setRetry(n => n + 1);
      } else {
        setEditLoadError(result.message);
        if (result.state === "unverified") setUncertain(true);
      }
    } catch {
      setEditLoadError("Không xác minh được thao tác lưu trữ. Đọc lại Core trước khi thử lại.");
    } finally { writing.current = false; setPending(false); }
  };
  const submit = async () => {
    if (!mode) return { state: "invalid" as const };
    const invalid = validateMissionCreate(draft);
    if (invalid) { setFormError(invalid); return { state: "invalid" as const }; }
    if (mode === "edit" && (!editTarget || editTarget.status !== draft.status)) {
      setFormError("Không đổi trạng thái tại Sửa Mission. Lưu trữ cần thao tác xác nhận riêng.");
      return { state: "invalid" as const };
    }
    if (writing.current || uncertain || !idempotency.current) return { state: "unverified" as const };
    if (!ready?.adapter.context.authorize("learning.mission.manage")) return { state: "denied" as const };
    writing.current = true; setPending(true); setFormError("");
    try {
      const command = mode === "create"
        ? { kind: "create" as const, data: draft, idempotencyKey: idempotency.current }
        : { kind: "update" as const, id: editTarget!.id, expectedVersion: editTarget!.version,
            data: draft, idempotencyKey: idempotency.current };
      const result = await submitHoMission(command);
      if (result.state === "verified") {
        setConfirmed("Đã xác minh Mission " + result.record.code + " trên Core.");
        setMode(null); setEditTarget(null); setReady(null); setRetry(n => n + 1);
      } else {
        setFormError(result.message);
        if (result.state === "unverified") setUncertain(true);
      }
      return result;
    } finally { writing.current = false; setPending(false); }
  };
  const actions: TddActionBindings = {
    openCreate: { kind: "navigation", disabled: pending || uncertain || mode !== null, run: open },
    openEdit: { kind: "navigation", disabled: pending || uncertain || mode !== null, run: openEdit },
    archiveMission: { kind: "mutation", disabled: pending || uncertain || mode !== null, visible: archiveAvailable, run: archiveMission },
    cancelCreate: { kind: "navigation", disabled: pending, run: close },
    saveCreate: { kind: "mutation", disabled: pending || uncertain || Boolean(validateMissionCreate(draft)), run: submit },
    cancelEdit: { kind: "navigation", disabled: pending, run: close },
    saveEdit: { kind: "mutation", disabled: pending || uncertain || Boolean(validateMissionCreate(draft)) ||
      !editTarget || editTarget.status !== draft.status, run: submit },
  };
  const content = <section data-testid="ho-missions-tdd" aria-label="Danh mục Mission toàn hệ thống">
    {confirmed ? <p role="status">{confirmed}</p> : null}
    {editLoadError ? <p role="alert">{editLoadError}</p> : null}
    {uncertain ? <p role="alert">Lệnh ghi chưa được xác minh. Không gửi lại thao tác hoặc mở form mới trước khi đối chiếu Mission trên Core.</p> : null}
    {error ? <p role="alert">{error} <button type="button" onClick={() => { setReady(null); setError(""); setRetry(n => n + 1); }}>Thử lại</button></p> :
      ready ? <>
        <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={missionQuery} actionBindings={actions} />
        {mode ? <TddRenderer view={{ kind: "form", props: {
          registry: ready.adapter.registry, schema: ready.adapter.schema, context: ready.adapter.context,
          mode, ...(mode === "edit" ? { recordId: editTarget?.id } : {}),
          title: mode === "create" ? "Tạo Mission" : "Sửa Mission", onClose: close, actionBindings: actions,
          content: <>
            <MissionCreateFields value={draft} setValue={setDraft} disabled={pending || uncertain} editing={mode === "edit"} />
            {formError ? <p role="alert">{formError}</p> : null}
          </>,
        } }} /> : null}
      </> : <p role="status">Đang xác thực HO và tải Mission từ Core…</p>}
  </section>;
  return <HoWorkspace module="missions" content={content} />;
}