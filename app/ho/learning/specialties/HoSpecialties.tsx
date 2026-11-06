"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useRef, useState } from "react";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { createHoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { BoApiError } from "@/lib/bo-api-error";
import { HoSpecialtyMissionsTab } from "./HoSpecialtyMissionsTab";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { specialtyDefinition, specialtyFields, specialtyProvider, specialtyQuery, verifySpecialtyExtension, specialtyVisualPaths, validateSpecialtyDraft, type SpecialtyDraft } from "./schema";

type F = typeof specialtyFields;
type Ready = {adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
const rejectWrite = async (): Promise<never> => { throw new Error("SPECIALTY_WRITER_UNAVAILABLE"); };

/** PAP-1495: one HO host, standard TDD/property grid, read-only until V2 readback. */
export function HoSpecialties() {
  const [ready,setReady]=useState<Ready|null>(null);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  const [createOpen,setCreateOpen]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
    void createHoTddAdapter({registry:new TddRegistry(verifySpecialtyExtension),
      definition:specialtyDefinition,provider:specialtyProvider},controller.signal).then(result=>{
        adapter=result;
        if(controller.signal.aborted){result.dispose();return;}
        setReady({adapter:result,navigation:browserTddNavigation("HO","specialties",specialtyQuery)});
      }).catch(error=>{if(!controller.signal.aborted)setError(error instanceof BoApiError && [401,403].includes(error.status)
        ?"Bạn không có quyền xem Chuyên đề.":"Chưa tải được danh mục Chuyên đề.");});
    return ()=>{controller.abort();adapter?.dispose();};
  },[retry]);
  const content=error?<p role="alert">{error} <button type="button" onClick={()=>{setReady(null);setError("");setRetry(n=>n+1);}}>Thử lại</button></p>
    :ready?<><SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={specialtyQuery}
      tableHeaderActions={<button className="primary-btn" type="button" onClick={()=>setCreateOpen(true)}>＋ Tạo chuyên đề</button>}
      detailApprovedExtension={(_row,_context,tab)=>tab==="missions"?<>
        <p role="status">Chưa tải được nhiệm vụ liên kết.</p>
        <HoSpecialtyMissionsTab pathProgramId="" levels={[]} missionCatalog={[]} disabled
          onLink={rejectWrite} onUnlink={rejectWrite} onOpenMission={()=>{}} />
      </>:null}/>
      {createOpen ? <SpecialtyCreateDrawer onClose={()=>setCreateOpen(false)} /> : null}
    </>:<p role="status">Đang tải Chuyên đề…</p>;
  return <HoWorkspace module="specialties" content={content}/>;
}
export function SpecialtyCreateDrawer({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<SpecialtyDraft>({ name: "", pathCode: "", description: "" });
  const inputRef = useRef<HTMLInputElement>(null);
  const invalid = validateSpecialtyDraft(draft);
  // PAP-1495: shared DrawerFrame traps Tab and restores the invoker on close.
  // Its dialog effect starts on the close icon; return to the approved first field afterwards.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return <DrawerFrame title="Tạo chuyên đề" path="Learning / Chuyên đề" onClose={onClose} footer={<>
    <button type="button" className="secondary-btn" onClick={onClose}>Hủy</button>
    <button type="submit" form="ho-spec-create-form" className="primary-btn" disabled aria-disabled="true"
      title="Chưa thể tạo chuyên đề">Tạo chuyên đề</button>
  </>}>
    <form id="ho-spec-create-form" className="ho-spec-form" data-ho-specialty-create
      aria-label="Thông tin chuyên đề mới" onSubmit={event => event.preventDefault()}>
      <label className="ho-spec-field">
        <span>Tên chuyên đề <span aria-hidden="true">*</span></span>
        <input ref={inputRef} required minLength={3} maxLength={160} autoComplete="off"
          value={draft.name} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))}
          placeholder="Tên chuyên đề" />
      </label>
      <label className="ho-spec-field">
        <span>Path</span>
        <select required aria-label="Path" value={draft.pathCode}
          onChange={event => setDraft(value => ({ ...value, pathCode: event.target.value }))}>
          <option value="">Chọn Path</option>
          {specialtyVisualPaths.map(path => <option key={path.code} value={path.code}>{path.label}</option>)}
        </select>
      </label>
      <label className="ho-spec-field">
        <span>Mô tả</span>
        <textarea rows={4} maxLength={4000} value={draft.description}
          onChange={event => setDraft(value => ({ ...value, description: event.target.value }))}
          placeholder="Mô tả chuyên đề" />
      </label>
      {invalid && (draft.name || draft.pathCode) ? <p className="ho-spec-create-status" role="status">{invalid}</p> : null}
      <p className="ho-spec-create-status" role="status">Chưa thể tạo chuyên đề.</p>
    </form>
  </DrawerFrame>;
}
