"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { createHoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { BoApiError } from "@/lib/bo-api-error";
import { readSpecialtyV2PathOptions, createSpecialtyV2Draft, type SpecialtyV2PathOption } from "@/lib/ho-specialty-v2-reader";
import { HoSpecialtyMissionsEdit } from "./HoSpecialtyMissionsEdit";
import { HoSpecialtyOverviewEdit } from "./HoSpecialtyOverviewEdit";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import createStyles from "./HoSpecialtyCreate.module.css";
import { specialtyDefinition, specialtyFields, specialtyProvider, specialtyQuery, verifySpecialtyExtension, validateSpecialtyDraft, shouldPrimeSpecialtyS4Detail, type SpecialtyDraft } from "./schema";

type F = typeof specialtyFields;
type Ready = {adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
/** PAP-1495 / PAP-1491: same HO PINO DS TDD shell, real Core Catalog source. */
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
        const navigation=browserTddNavigation("HO","specialties",specialtyQuery);
        const initial=navigation.read();
        const owned=window.history.state?.["pino:tdd:HO:specialties"] as {recordId?:string}|undefined;
        if(shouldPrimeSpecialtyS4Detail(initial.kind,initial.recordId,owned?.recordId))
          navigation.change({...initial,kind:"detail",tab:"overview"},true);
        setReady({adapter:result,navigation});
      }).catch(error=>{if(!controller.signal.aborted)setError(error instanceof BoApiError && [401,403].includes(error.status)
        ?"Bạn không có quyền xem Chuyên đề.":"Chưa tải được danh mục Chuyên đề.");});
    return ()=>{controller.abort();adapter?.dispose();};
  },[retry]);
  const content=error?<p role="alert">{error} <button type="button" onClick={()=>{setReady(null);setError("");setRetry(n=>n+1);}}>Thử lại</button></p>
    :ready?<><SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={specialtyQuery}
      tableHeaderActions={<button className="primary-btn" type="button" onClick={()=>setCreateOpen(true)}>＋ Tạo chuyên đề</button>}
      detailProperties={(properties,context,_actor,onSaved)=><HoSpecialtyOverviewEdit key={properties.record.id}
        properties={properties} canManage={context.authorize("catalog.learning.manage")} onSaved={onSaved}/>}
      detailApprovedExtension={(row,context,tab,_actor,onSaved)=>tab==="missions"?
        <HoSpecialtyMissionsEdit key={row.id} specialtyId={row.id}
          canManage={context.authorize("catalog.learning.manage")} onSaved={onSaved}/>:null}/>
      {createOpen ? <SpecialtyCreateDrawer onClose={()=>setCreateOpen(false)}
        onCreated={()=>{setCreateOpen(false);setRetry(n=>n+1);}} /> : null}
    </>:<p role="status">Đang tải Chuyên đề…</p>;
  return <HoWorkspace module="specialties" content={content}/>;
}
export function SpecialtyCreateDrawer({onClose,onCreated}:{
 onClose:()=>void;onCreated:()=>void;
}){
 const [draft,setDraft]=useState<SpecialtyDraft>({name:"",pathCode:"",description:""});
 const [paths,setPaths]=useState<SpecialtyV2PathOption[]|null>(null);
 const [pathError,setPathError]=useState("");
 const [pathRetry,setPathRetry]=useState(0);
 const [saveError,setSaveError]=useState("");
 const [saving,setSaving]=useState(false);
 const inputRef=useRef<HTMLInputElement>(null);
 const submitController=useRef<AbortController|null>(null);
 const attempt=useRef<{signature:string;key:string}|null>(null);
 const invalid=validateSpecialtyDraft(draft);
 useEffect(()=>{
  const controller=new AbortController();
  void readSpecialtyV2PathOptions(window.fetch.bind(window),controller.signal)
   .then(setPaths).catch(error=>{
    if(!controller.signal.aborted)setPathError(error instanceof BoApiError&&error.status===403
      ?"Bạn không có quyền xem Path.":"Chưa tải được danh sách Path.");
   });
  return ()=>controller.abort();
 },[pathRetry]);
 useEffect(()=>{
  const frame=window.requestAnimationFrame(()=>inputRef.current?.focus());
  return ()=>{window.cancelAnimationFrame(frame);submitController.current?.abort();};
 },[]);
 const change=(next:SpecialtyDraft)=>{attempt.current=null;setSaveError("");setDraft(next);};
 const close=()=>{if(!saving)onClose();};
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(saving||invalid||!paths)return;
  const selected=paths.find(path=>path.code===draft.pathCode);
  if(!selected){setSaveError("Path không hợp lệ.");return;}
  const payload={name:draft.name.trim(),pathProgramId:selected.id,
   description:draft.description.trim()||null};
  const signature=JSON.stringify(payload);
  if(!attempt.current||attempt.current.signature!==signature)
   attempt.current={signature,key:"spec_create_"+crypto.randomUUID().replace(/-/g,"")};
  const controller=new AbortController();
  submitController.current=controller;
  setSaving(true);setSaveError("");
  try{
   await createSpecialtyV2Draft(payload,attempt.current.key,window.fetch.bind(window),controller.signal);
   onCreated();
  }catch(error){
   if(!controller.signal.aborted)setSaveError(error instanceof BoApiError?error.message:"Không thể tạo Chuyên đề.");
  }finally{submitController.current=null;setSaving(false);}
 }
 return <DrawerFrame title="Tạo chuyên đề" path="Learning / Chuyên đề" onClose={close} footer={<>
  <button type="button" className="secondary-btn" onClick={close} disabled={saving}>Hủy</button>
  <button type="submit" form="ho-spec-create-form" className="primary-btn"
   disabled={Boolean(invalid)||!paths||saving}>{saving?"Đang tạo…":"Tạo chuyên đề"}</button>
 </>}>
  <form id="ho-spec-create-form" className={createStyles.createForm} data-ho-specialty-create
   aria-label="Thông tin chuyên đề mới" onSubmit={event=>{void submit(event);}}>
   <label className={createStyles.field}>
    <span className="pds-property-label">Tên chuyên đề <span aria-hidden="true">*</span></span>
    <input ref={inputRef} className="pds-property-input" required minLength={3} maxLength={160} autoComplete="off"
     value={draft.name} disabled={saving}
     onChange={event=>change({...draft,name:event.target.value})} placeholder="Tên chuyên đề"/>
   </label>
   <label className={createStyles.field}>
    <span className="pds-property-label">Path <span aria-hidden="true">*</span></span>
    <select className="pds-property-input" required aria-label="Path" value={draft.pathCode}
     disabled={saving||!paths} onChange={event=>change({...draft,pathCode:event.target.value})}>
     <option value="">Chọn Path</option>
     {(paths??[]).map(path=><option key={path.id} value={path.code}>{path.label}</option>)}
    </select>
   </label>
   <label className={createStyles.field}>
    <span className="pds-property-label">Mô tả</span>
    <textarea className="pds-property-input" rows={4} maxLength={4000} value={draft.description}
     disabled={saving} onChange={event=>change({...draft,description:event.target.value})}
     placeholder="Mô tả chuyên đề"/>
   </label>
   {!paths&&!pathError?<p role="status">Đang tải Path…</p>:null}
   {pathError?<p role="alert">{pathError} <button type="button" onClick={()=>{setPaths(null);setPathError("");setPathRetry(n=>n+1);}}>Thử lại</button></p>:null}
   {invalid&&(draft.name||draft.pathCode)?<p role="status">{invalid}</p>:null}
   {saveError?<p role="alert">{saveError}</p>:null}
  </form>
 </DrawerFrame>;
}
