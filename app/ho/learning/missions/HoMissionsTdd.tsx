"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BoActionButton, BoActionGroup } from "@pino/design-system/react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import type { TableQuery } from "@/lib/workspace-schema";
import { createHoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry, type TddActionBindings } from "@/lib/workspace-schema";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { TddRenderer } from "@/app/components/workspace-renderer/Renderer";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { missionDefinition, missionFields, missionProvider, missionQuery, missionIntegratedDefinition, missionIntegratedProvider, missionCategoryQuery } from "./schema";
import { submitHoMission, type MissionInput } from "./command";
import { loadMissionForEdit } from "./read-edit";
import { createMissionMetadataBinding } from "./mission-metadata-binding";
import { MissionMetadataPropertyHost } from "./MissionMetadataPropertyHost";
import { MISSION_METADATA_COMMAND, type MissionMetadataPresentation } from "./mission-inline-presentation";
import { emptyMission, MissionCreateFields, validateMissionCreate } from "./MissionCreateFields";
import { loadMissionPathChoices, validateMissionSelectedPath, type MissionPathChoice } from "./mission-path-options";

type F = typeof missionFields;
type Ready = { adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
type EditTarget = { id: string; version: number; status: MissionInput["status"]; originalCategory: MissionInput["category"] };
export type MissionBoundary = {
  readonly preview: boolean;
  readonly integratedMetadata?: true;
  readonly query: TableQuery<F>;
  readonly open: (signal: AbortSignal) => Promise<Ready>;
  readonly load: (id:string,signal?:AbortSignal)=>ReturnType<typeof loadMissionForEdit>;
  readonly paths: (signal?: AbortSignal) => Promise<readonly MissionPathChoice[]>;
  readonly submit: (command: Parameters<typeof submitHoMission>[0],signal?:AbortSignal) => ReturnType<typeof submitHoMission>;
  readonly key: (prefix:string)=>string;
};
const liveBoundary: MissionBoundary = {
  preview:false,query:missionQuery,
  async open(signal) {
    const adapter = await createHoTddAdapter({ registry: new TddRegistry(), definition: missionDefinition, provider: missionProvider },signal);
    try { return {adapter,navigation:browserTddNavigation("HO","missions",missionQuery)}; }
    catch (error) { adapter.dispose(); throw error; }
  },
  load:(id,signal)=>loadMissionForEdit(id,fetch,signal), paths:signal=>loadMissionPathChoices(fetch,signal),
  submit:(command,signal)=>submitHoMission(command,fetch,signal), key:prefix=>prefix+crypto.randomUUID(),
};
/** PAP-2394: integrated boundary for the canonical authenticated Staging route. */
export const integratedMissionBoundary: MissionBoundary = {
  ...liveBoundary, integratedMetadata:true,query:missionCategoryQuery,
  async open(signal) {
    const adapter=await createHoTddAdapter({registry:new TddRegistry(),definition:missionIntegratedDefinition,provider:missionIntegratedProvider},signal);
    try { return {adapter,navigation:browserTddNavigation("HO","missions",missionCategoryQuery)}; }
    catch(error){adapter.dispose();throw error;}
  },
};
type PathState =
  | { state: "idle" | "loading" | "error"; message?: string }
  | { state: "ready"; choices: readonly MissionPathChoice[] };
/** PAP-1207: Create/Edit/Archive use canonical TDD Action Host; no local mutation buttons. */
export function HoMissionsContent({boundary=liveBoundary}:{boundary?:MissionBoundary} = {}) {
  const [scopedReady, setReady] = useState<(Ready & {boundary:MissionBoundary}) | null>(null);
  const ready=scopedReady?.boundary===boundary?scopedReady:null;
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [draft, setDraft] = useState<MissionInput>(emptyMission);
  const [pathState, setPathState] = useState<PathState>({ state: "idle" });
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [formError, setFormError] = useState("");
  const [editLoadError, setEditLoadError] = useState("");
  const [confirmed, setConfirmed] = useState("");
  const [archiveAvailable, setArchiveAvailable] = useState(false);
  const [archivePreview, setArchivePreview] = useState<{id:string;version:number;name:string}|null>(null);
  const idempotency = useRef<string | null>(null);
  const writing = useRef(false);
  const inlineWriting = useRef(false);
  const readingAction = useRef(false);
  const latest = useRef({ready,boundary,mode,pending,uncertain,archivePreview});
  useLayoutEffect(()=>{latest.current={ready,boundary,mode,pending,uncertain,archivePreview};},[ready,boundary,mode,pending,uncertain,archivePreview]);
  const [inlineScope,setInlineScope]=useState<{ready:Ready;boundary:MissionBoundary;presentation:MissionMetadataPresentation}|null>(null);
  useLayoutEffect(()=>{
    if (!ready || boundary.preview || boundary.integratedMetadata!==true) return;
    let active=true;
    const allowed=()=>{
      if(!active)return false;
      const current=latest.current;
      return current.ready===ready&&current.boundary===boundary&&!current.mode&&!current.archivePreview&&!current.uncertain&&
        (!current.pending||inlineWriting.current)&&!readingAction.current&&(!writing.current||inlineWriting.current)&&
        ready.adapter.context.authorize("catalog.learning.view")&&ready.adapter.context.authorize("learning.mission.manage");
    };
    const binding=createMissionMetadataBinding({
      read:(id,signal)=>boundary.load(id,signal),paths:signal=>boundary.paths(signal),
      submit:(command,signal)=>boundary.submit(command,signal),key:()=>boundary.key("mission-inline-"),
      canEdit:request=>{const selected=ready.navigation.read();return allowed()&&(selected.kind==="table"||selected.recordId===request.id);},
      acquireActionLock:()=>{
        if (!allowed()||writing.current) return null;
        writing.current=true;inlineWriting.current=true;setPending(true);
        return ()=>{inlineWriting.current=false;writing.current=false;setPending(false);};
      },
      onUncertain:()=>setUncertain(true),
    });
    const presentation:MissionMetadataPresentation={command:MISSION_METADATA_COMMAND,render:input=><MissionMetadataPropertyHost host={input.host} row={input.row} version={input.version} field={input.field} anchor={input.anchor} onClose={input.onClose} onSaved={input.onSaved} schema={ready.adapter.schema}
      context={ready.adapter.context} binding={binding} hasGenericWrites={false}/>};
    queueMicrotask(()=>{if(active)setInlineScope({ready,boundary,presentation});});
    return ()=>{active=false;};
  },[ready,boundary]);
  const missionMetadata=!uncertain&&inlineScope?.ready===ready&&inlineScope.boundary===boundary?inlineScope.presentation:undefined;
  useEffect(() => {
    const controller = new AbortController();
    let bound: AuthenticatedSurfaceAdapter<F> | null = null;
    void boundary.open(controller.signal)
      .then(result => {
        bound = result.adapter;
        if (controller.signal.aborted) { bound.dispose(); return; }
        setReady({...result,boundary});
      })
      .catch(() => { if (!controller.signal.aborted) setError("Không thể xác thực quyền xem Mission trên HO."); });
    return () => { controller.abort(); bound?.dispose(); };
  }, [retry,boundary]);
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
      void boundary.load(selected.recordId).then(result => {
        if (!active || current !== sequence || ready.navigation.read().recordId !== selected.recordId) return;
        setArchiveAvailable(result.state === "ready" && result.data.status === "ACTIVE");
      }).catch(() => {
        if (active && current === sequence) setArchiveAvailable(false);
      });
    };
    const unsubscribe = ready.navigation.subscribe(refreshArchiveEligibility);
    refreshArchiveEligibility();
    return () => { active = false; sequence += 1; unsubscribe(); };
  }, [ready,boundary]);
  // PAP-1207 / MISSION S5: source-owned Core Path lookup for Create and Edit drawers.
  // Aborted requests never populate a closed/stale form.
  useEffect(() => {
    if (mode === null) return;
    const controller = new AbortController();
    void boundary.paths(controller.signal)
      .then(choices => { if (!controller.signal.aborted) setPathState({ state: "ready", choices }); })
      .catch(() => { if (!controller.signal.aborted) setPathState({ state: "error", message: "Không tải được bốn Path canonical từ Core. Đóng và mở lại form." }); });
    return () => controller.abort();
  }, [mode,boundary]);
  const pathChoices = pathState.state === "ready" ? pathState.choices : [];
  const metadataEnabled=boundary.preview||boundary.integratedMetadata===true;
  const allowUnclassified=boundary.integratedMetadata===true && mode==="edit" && editTarget?.originalCategory===null;
  const close = () => {
    if (writing.current || pending) return;
    setMode(null); setEditTarget(null); setFormError(""); setPathState({ state: "idle" });
  };
  const open = () => {
    if (writing.current || readingAction.current || pending || uncertain) return;
    idempotency.current = boundary.key("mission-create-");
    setDraft(emptyMission); setEditTarget(null); setPathState({ state: "loading" });
    setFormError(""); setEditLoadError(""); setConfirmed(""); setMode("create");
  };
  const openEdit = async () => {
    if (writing.current || readingAction.current || pending || uncertain || !ready || mode) return;
    if (!ready.adapter.context.authorize("learning.mission.manage")) return;
    const selected = ready.navigation.read();
    if (selected.kind !== "detail" || !selected.recordId) return;
    readingAction.current=true; setPending(true); setEditLoadError("");
    try {
      const result = await boundary.load(selected.recordId);
      if (result.state !== "ready") { setEditLoadError(result.message); return; }
      if (latest.current.ready!==ready || latest.current.boundary!==boundary || ready.navigation.read().recordId !== result.id) return; // stale selected row or scope
      setEditTarget({ id: result.id, version: result.version, status: result.data.status, originalCategory:result.data.category });
      setDraft(result.data); setPathState({ state: "loading" }); idempotency.current = boundary.key("mission-edit-");
      setFormError(""); setConfirmed(""); setMode("edit");
    } finally { readingAction.current=false; setPending(false); }
  };
  const archiveMission = async (confirmedPreview?: {id:string;version:number}) => {
    if (writing.current || readingAction.current || pending || uncertain || !ready || mode) return;
    if (!ready.adapter.context.authorize("learning.mission.manage")) return;
    const selected = ready.navigation.read();
    if (selected.kind !== "detail" || !selected.recordId) return;
    readingAction.current=true; setPending(true); setEditLoadError("");
    try {
      const loaded = await boundary.load(selected.recordId);
      if (loaded.state !== "ready") { setEditLoadError(loaded.message); return; }
      if (latest.current.ready!==ready || latest.current.boundary!==boundary || ready.navigation.read().recordId !== loaded.id) return;
      if (loaded.data.status !== "ACTIVE") {
        setEditLoadError("Mission đã ở trạng thái INACTIVE; không cần lưu trữ lại.");
        return;
      }
      if (boundary.preview && !confirmedPreview) {
        setArchivePreview({id:loaded.id,version:loaded.version,name:loaded.data.name}); return;
      }
      if (boundary.preview && (confirmedPreview?.id !== loaded.id || confirmedPreview.version !== loaded.version)) {
        setArchivePreview(null); setEditLoadError("Mission mẫu đã thay đổi. Mở lại xác nhận."); return;
      }
      setArchivePreview(null);
      const accepted = boundary.preview || (typeof window !== "undefined" && window.confirm(
        "Lưu trữ Mission " + loaded.data.code + " — " + loaded.data.name +
        "? Mission sẽ chuyển sang INACTIVE và không còn được giao mới. Assignment và Nhật Ký hiện có vẫn được giữ nguyên; thao tác này không xóa dữ liệu.",
      ));
      if (!accepted || latest.current.ready!==ready || latest.current.boundary!==boundary || ready.navigation.read().recordId !== loaded.id || writing.current || uncertain) return;
      writing.current = true;
      idempotency.current = boundary.key("mission-archive-");
      const result = await boundary.submit({
        kind: "archive", id: loaded.id, expectedVersion: loaded.version,
        data: loaded.data, idempotencyKey: idempotency.current,
      });
      if (result.state === "verified") {
        ready.navigation.change({ kind: "table", tab: "overview", query: boundary.query });
        setConfirmed(boundary.preview ? "M1 · Đã lưu trữ Mission mẫu." : "Đã xác minh lưu trữ Mission " + result.record.code + " trên Core (INACTIVE).");
        setReady(null); setRetry(n => n + 1);
      } else {
        setEditLoadError(result.message);
        if (result.state === "unverified") setUncertain(true);
      }
    } catch {
      setEditLoadError("Không xác minh được thao tác lưu trữ. Đọc lại Core trước khi thử lại.");
    } finally { readingAction.current=false; writing.current = false; setPending(false); }
  };
  const submit = async () => {
    if (!mode) return { state: "invalid" as const };
    const invalid = validateMissionCreate(draft,metadataEnabled,allowUnclassified) ||
      validateMissionSelectedPath(draft, pathChoices);
    if (invalid) { setFormError(invalid); return { state: "invalid" as const }; }
    if (mode === "edit" && (!editTarget || editTarget.status !== draft.status)) {
      setFormError("Không đổi trạng thái tại Sửa Mission. Lưu trữ cần thao tác xác nhận riêng.");
      return { state: "invalid" as const };
    }
    if (writing.current || readingAction.current || uncertain || !idempotency.current) return { state: "unverified" as const };
    if (!ready?.adapter.context.authorize("learning.mission.manage")) return { state: "denied" as const };
    writing.current = true; setPending(true); setFormError("");
    try {
      if (mode === "create" || mode === "edit") {
        // Re-read the authorized Core canon immediately before any Create/Edit write.
        // An inactive/renamed/replaced Path never proceeds to POST.
        try {
          const fresh = await boundary.paths();
          const changed = validateMissionSelectedPath(draft, fresh);
          if (changed) { setFormError(changed); return { state: "invalid" as const }; }
        } catch {
          setFormError("Không thể xác minh Path từ Core trước khi lưu. Chưa gửi Mission.");
          return { state: "invalid" as const };
        }
      }
      const command = mode === "create"
        ? { kind: "create" as const, data: draft, idempotencyKey: idempotency.current }
        : { kind: "update" as const, id: editTarget!.id, expectedVersion: editTarget!.version,
            data: draft, idempotencyKey: idempotency.current };
      const result = await boundary.submit(command);
      if (result.state === "verified") {
        setConfirmed(boundary.preview ? "M1 · Đã cập nhật Mission mẫu." : "Đã xác minh Mission " + result.record.code + " trên Core.");
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
    archiveMission: { kind: "mutation", disabled: pending || uncertain || mode !== null, visible: archiveAvailable, run: () => archiveMission() },
    ...(boundary.preview ? {archiveMission:{kind:"navigation" as const,disabled:pending || uncertain || mode !== null || archivePreview !== null,visible:archiveAvailable,run:()=>archiveMission()}} : {}),
    cancelCreate: { kind: "navigation", disabled: pending, run: close },
    saveCreate: { kind: "mutation", disabled: pending || uncertain ||
      Boolean(validateMissionCreate(draft,metadataEnabled,false) || validateMissionSelectedPath(draft, pathChoices)), run: submit },
    cancelEdit: { kind: "navigation", disabled: pending, run: close },
    saveEdit: { kind: "mutation", disabled: pending || uncertain ||
      Boolean(validateMissionCreate(draft,metadataEnabled,allowUnclassified) || validateMissionSelectedPath(draft, pathChoices)) ||
      !editTarget || editTarget.status !== draft.status, run: submit },
  };
  const content = <section data-testid="ho-missions-tdd" aria-label="Danh mục Mission toàn hệ thống">
    {boundary.preview ? <p role="status">M1 · Dữ liệu mô phỏng, không lưu vào hệ thống.</p> : null}
    {boundary.preview && archivePreview ? <DrawerFrame title="Xác nhận lưu trữ" path="Mission" onClose={()=>{if(!writing.current&&!pending)setArchivePreview(null);}} footer={<BoActionGroup>
      <BoActionButton type="button" variant="secondary" disabled={pending} onClick={()=>setArchivePreview(null)}>Hủy</BoActionButton>
      <BoActionButton type="button" variant="danger" disabled={pending} onClick={()=>void archiveMission(archivePreview)}>Xác nhận lưu trữ</BoActionButton>
    </BoActionGroup>}><p>Lưu trữ {archivePreview.name}? Mission chuyển sang INACTIVE và không còn được giao mới. Assignment và Nhật Ký hiện có vẫn được giữ nguyên; không xóa dữ liệu.</p></DrawerFrame> : null}
    {confirmed ? <p role="status">{confirmed}</p> : null}
    {editLoadError ? <p role="alert">{editLoadError}</p> : null}
    {uncertain ? <p role="alert">Lệnh ghi chưa được xác minh. Không gửi lại thao tác hoặc mở form mới trước khi đối chiếu Mission trên Core.</p> : null}
    {error ? <p role="alert">{error} <button type="button" onClick={() => { setReady(null); setError(""); setRetry(n => n + 1); }}>Thử lại</button></p> :
      ready ? <>
        <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={boundary.query} actionBindings={actions} missionMetadata={missionMetadata} />
        {mode ? <TddRenderer view={{ kind: "form", props: {
          registry: ready.adapter.registry, schema: ready.adapter.schema, context: ready.adapter.context,
          mode, ...(mode === "edit" ? { recordId: editTarget?.id } : {}),
          title: mode === "create" ? "Tạo Mission" : "Sửa Mission", onClose: close, actionBindings: actions,
          content: <>
            <MissionCreateFields value={draft} setValue={setDraft} disabled={pending || uncertain}
               editing={mode === "edit"} pathChoices={pathChoices} requireCategory={metadataEnabled} allowUnclassified={allowUnclassified}
               pathState={pathState.state} pathError={pathState.state === "error" ? pathState.message : ""} />
            {formError ? <p role="alert">{formError}</p> : null}
          </>,
        } }} /> : null}
      </> : <p role="status">Đang xác thực HO và tải Mission từ Core…</p>}
  </section>;
  return content;
}
export function HoMissionsTdd() {
  return <HoWorkspace module="missions" content={<HoMissionsContent boundary={integratedMissionBoundary}/>} />;
}
