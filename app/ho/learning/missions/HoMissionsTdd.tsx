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
import { emptyMission, MissionCreateFields, validateMissionCreate } from "./MissionCreateFields";

type F = typeof missionFields;
type Ready = { adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
export const missionWriteUnavailable =
  "Sửa, lưu trữ hoặc xóa Mission chưa khả dụng: chờ phê duyệt Core và nghiệm thu HO Staging.";
/** PAP-1207: Mission writer uses PAP-1247 declarative engine-hosted actions; no local action buttons. */
export function HoMissionsTdd() {
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<MissionInput>(emptyMission);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmed, setConfirmed] = useState("");
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
  const close = () => { if (writing.current) return; setFormOpen(false); setFormError(""); };
  const open = () => {
    if (writing.current || uncertain) return;
    idempotency.current = "mission-create-" + crypto.randomUUID();
    setDraft(emptyMission); setFormError(""); setConfirmed(""); setFormOpen(true);
  };
  const submit = async () => {
    const invalid = validateMissionCreate(draft);
    if (invalid) { setFormError(invalid); return { state: "invalid" as const }; }
    if (writing.current || uncertain || !idempotency.current) return { state: "unverified" as const };
    if (!ready?.adapter.context.authorize("learning.mission.manage")) return { state: "denied" as const };
    writing.current = true; setPending(true); setFormError("");
    try {
      const result = await submitHoMission({ kind: "create", data: draft, idempotencyKey: idempotency.current });
      if (result.state === "verified") {
        setConfirmed("Đã xác minh Mission " + result.record.code + " trên Core.");
        setFormOpen(false); setReady(null); setRetry(n => n + 1);
      } else {
        setFormError(result.message);
        if (result.state === "unverified") setUncertain(true);
      }
      return result;
    } finally { writing.current = false; setPending(false); }
  };
  const actions: TddActionBindings = {
    openCreate: { kind: "navigation", disabled: pending || uncertain, run: open },
    cancelCreate: { kind: "navigation", disabled: pending, run: close },
    saveCreate: { kind: "mutation", disabled: pending || uncertain || Boolean(validateMissionCreate(draft)), run: submit },
  };
  const content = <section data-testid="ho-missions-tdd" aria-label="Danh mục Mission toàn hệ thống">
    <p role="note">{missionWriteUnavailable}</p>
    {confirmed ? <p role="status">{confirmed}</p> : null}
    {uncertain ? <p role="alert">Lệnh ghi chưa được xác minh. Không gửi lại Create hoặc mở form mới trước khi đối chiếu Mission trên Core.</p> : null}
    {error ? <p role="alert">{error} <button type="button" onClick={() => { setReady(null); setError(""); setRetry(n => n + 1); }}>Thử lại</button></p> :
      ready ? <>
        <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={missionQuery} actionBindings={actions} />
        {formOpen ? <TddRenderer view={{ kind: "form", props: {
          registry: ready.adapter.registry, schema: ready.adapter.schema, context: ready.adapter.context,
          mode: "create", title: "Tạo Mission", onClose: close, actionBindings: actions,
          content: <>
            <MissionCreateFields value={draft} setValue={setDraft} disabled={pending || uncertain} />
            {formError ? <p role="alert">{formError}</p> : null}
          </>,
        } }} /> : null}
      </> : <p role="status">Đang xác thực HO và tải Mission từ Core…</p>}
  </section>;
  return <HoWorkspace module="missions" content={content} />;
}