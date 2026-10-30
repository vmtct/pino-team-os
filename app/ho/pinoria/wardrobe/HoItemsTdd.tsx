"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {useEffect,useState} from "react";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {createHoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRegistry,type Approval} from "@/lib/workspace-schema";
import type {SlotLoaders} from "@/app/components/workspace-renderer/Slots";
import {HoItemCalibration} from "./HoItemCalibration";
import {HoItemCreate} from "./HoItemCreate";
import {itemDefinition,itemFields,itemProvider,itemQuery,extensionVerifier} from "./schema";
type F=typeof itemFields;
type Ready={adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
const loaders:SlotLoaders={
 "pinoria.item.calibration":async (_slot,record,context)=><HoItemCalibration key={record.id} itemId={record.id} canManage={context.authorize("pinoria.item.manage")}/>
};
/** S1 only: TDD owns Table/Drawer/Detail shell. The approved-extension is domain-owned content. */
export function HoItemsTdd(){
 const [ready,setReady]=useState<Ready|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0),[generation,setGeneration]=useState(0);
 useEffect(()=>{
  const ctrl=new AbortController();let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
  const registry=new TddRegistry((approval:Approval,scope)=>extensionVerifier(approval,scope));
  void createHoTddAdapter({registry,definition:itemDefinition,provider:itemProvider},ctrl.signal).then(a=>{
   adapter=a;if(ctrl.signal.aborted){a.dispose();return;}
   setReady({adapter:a,navigation:browserTddNavigation("HO","wardrobe",itemQuery)});
  }).catch(()=>{if(!ctrl.signal.aborted)setError(true)});
  return ()=>{ctrl.abort();adapter?.dispose()};
 },[retry]);
 const content=error?<p role="alert">Không tải được Items. <button onClick={()=>{setError(false);setReady(null);setRetry(x=>x+1)}}>Thử lại</button></p>:
 ready?<section aria-label="Pinoria Items">
  {ready.adapter.context.authorize("pinoria.item.manage")?<HoItemCreate onCreated={()=>setGeneration(g=>g+1)}/>:null}
  <SurfaceWorkspace key={generation} adapter={ready.adapter} navigation={ready.navigation} initialQuery={itemQuery} businessLoaders={loaders}/>
 </section>:<p role="status">Đang tải Items được cấp quyền…</p>;
 return <HoWorkspace module="wardrobe" content={content}/>;
}
