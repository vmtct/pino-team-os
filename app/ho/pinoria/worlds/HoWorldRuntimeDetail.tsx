"use client";
/** PAP-2143 native HO World Detail, authoritative catalog and explicit commands. */
import {useContext,useEffect,useRef,useState,useCallback} from "react";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {DetailFrame} from "@/app/components/workspace-renderer/DetailFrame";
import {PropertySections} from "@/app/components/workspace-renderer/Properties";
import {BoTypedEditor} from "@/app/bo/components/registration/BoTypedEditor";
import type {BoField,BoRecord,BoValue} from "@/lib/bo-registration";
import {worldDrawerModule} from "./world-drawer-contract";
import {fetchWorldCatalog,patchWorld,type CoreWorld} from "./world-runtime-client";
import {projectRuntimeWorld,createRuntimeScene,saveRuntimeScene,WorldMutationJournal} from "./world-runtime-model";
import {SceneBuilder} from "./WorldDetailPanels";
import styles from "./WorldUiShell.module.css";
const fields:BoField[]=[...worldDrawerModule.fields,{key:"description",label:"Mô tả",type:"textarea",w:240,icon:"Aa",readonly:true}];

export function HoWorldRuntimeDetail({record,canManage,onBack,onConfirmed,tab,onTab}:{tab:string;onTab:(id:string)=>void;record:BoRecord;canManage:boolean;onBack:()=>void;onConfirmed:(row:BoRecord)=>void}){
 const menu=useContext(TddHostMenu),[sceneId,setScene]=useState(""),[retry,setRetry]=useState(0);
 const [result,setResult]=useState<{world:CoreWorld|null;error:string}>({world:null,error:""});
 const [edit,setEdit]=useState<{field:BoField;anchor:HTMLElement}|null>(null),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const journal=useRef(new WorldMutationJournal()),flight=useRef(false),mounted=useRef(false);
 const closeEdit=useCallback(()=>setEdit(null),[]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 useEffect(()=>{const ctl=new AbortController();void fetchWorldCatalog(fetch,ctl.signal).then(worlds=>{if(ctl.signal.aborted)return;const world=worlds.find(w=>w.id===record.id);setResult({world:world??null,error:world?"":"World không còn trong phạm vi được cấp."})}).catch(e=>{if(!ctl.signal.aborted)setResult({world:null,error:e instanceof Error?e.message:"Không thể tải World."})});return()=>ctl.abort()},[record.id,retry]);
 const world=result.world,model=world?projectRuntimeWorld(world):null;
 const mergeRow=(w:CoreWorld):BoRecord=>({...record,...projectRuntimeWorld(w).world,createdAt:w.createdAt??record.createdAt,createdByUser:w.createdByUser??"—",updatedAt:w.updatedAt??record.updatedAt,updatedByUser:w.updatedByUser??"—"});
 async function mutate(fn:()=>Promise<CoreWorld>){
  if(!canManage||flight.current)throw Error("Đang xử lý World.");
  flight.current=true;setBusy(true);setNotice("");
  try{const w=await fn();if(!mounted.current)return;setResult({world:w,error:""});onConfirmed(mergeRow(w))}
  catch(e){if(mounted.current)setNotice(e instanceof Error?e.message:"Core chưa xác nhận thao tác.");throw e}
  finally{flight.current=false;if(mounted.current)setBusy(false)}
 }
 function update(key:string,value:BoValue){if(!world||typeof value!=="string"||!["name","description","worldType"].includes(key))return;const patch=key==="name"?{displayName:value}:key==="description"?{descriptionText:value}:{worldType:value as CoreWorld["worldType"]};void mutate(()=>patchWorld(world.id,{expectedVersion:world.version,...patch})).catch(()=>{})}
 return <DetailFrame title={world?.displayName??record.name} subtitle={record.id} mobileMenu={menu("detail-menu-btn")} tabs={[{id:"overview",label:"Tổng quan"},{id:"scenes",label:"Cảnh"},{id:"preview",label:"Preview"},{id:"history",label:"Lịch sử"}]} selected={tab} onSelect={id=>{if(!flight.current)onTab(id)}} onBack={()=>{if(!flight.current)onBack()}}>
 {notice&&<p role="alert">{notice}</p>}
 {!model||!world?<div role={result.error?"alert":"status"}>{result.error||"Đang tải World…"} {result.error&&<button type="button" className="secondary-btn" onClick={()=>{setResult({world:null,error:""});setRetry(n=>n+1)}}>Thử lại</button>}</div>:
 tab==="overview"?<><PropertySections fields={fields} record={mergeRow(world)} sections={[{id:"overview",label:"Thông tin World",fields:fields.map(f=>f.key)}]} variant="detail" canEdit={f=>canManage&&!busy&&["name","worldType","description"].includes(f.key)} onEdit={(f,anchor)=>setEdit({field:f,anchor})}/>{edit&&<BoTypedEditor field={{...edit.field,readonly:false}} value={mergeRow(world)[edit.field.key]} anchor={edit.anchor} onClose={closeEdit} onSave={v=>update(edit.field.key,v)}/>}</>:
 tab==="scenes"||tab==="preview"?<SceneBuilder key={world.id+tab} world={model.world} scenes={model.scenes} layers={model.layers} selected={sceneId} onSelect={setScene} onCreate={()=>{throw Error("Runtime Scene requires PNG.")}} onSave={()=>{throw Error("Runtime Scene requires Core acknowledgement.")}} can={canManage&&!busy} previewOnly={tab==="preview"} runtime={{create:async(name,file)=>{await mutate(async()=>{const r=await createRuntimeScene(world,name,file,journal.current);setScene(r.sceneId);return r.world})},save:async(id,rows)=>{const s=world.scenes.find(x=>x.id===id);if(!s)throw Error("Cảnh không còn khả dụng.");await mutate(()=>saveRuntimeScene(s,rows,journal.current))}}}/>:
 <p className={styles.empty} role="status">Lịch sử World chưa khả dụng.</p>}
 </DetailFrame>
}
