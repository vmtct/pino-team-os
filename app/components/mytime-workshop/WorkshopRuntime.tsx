"use client";
// PAP-2164 / MT-WORKSHOP. Real feature runtime; session and Center reattested, no fixture fallback.
import {useContext,useEffect,useState} from "react";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {RecordState} from "@/app/components/workspace-renderer/Record";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {surfaceSession} from "@/lib/workspace-adapters/session";
import {workshopHostDecision} from "@/lib/mytime-workshop-host-contract";
import {WorkshopWorkspace} from "./WorkshopWorkspace";
import {workshopBinding,type WorkshopBinding,type WorkshopCapabilities} from "./schema";
import {loadWorkshopRuntime,workshopHistory} from "./runtime-binding";
import {WorkshopApiError,type WorkshopScope} from "./api-client";
import type {AuthorizationContext} from "@/lib/workspace-schema";
type CenterSource=Parameters<typeof surfaceSession>[3] extends infer C ? NonNullable<C> extends {source:infer S}?S:never:never;
type Ready={key:string;binding:WorkshopBinding;context:AuthorizationContext;data:Awaited<ReturnType<typeof loadWorkshopRuntime>>};
const caps=(s:"HO"|"BO"):WorkshopCapabilities=>s==="HO"?{read:"learning.mytime_workshop.ho_view",create:"learning.mytime_workshop.ho_manage",edit:"learning.mytime_workshop.ho_manage",history:"learning.mytime_workshop.ho_view"}:{read:"learning.mytime_workshop.bo_view",create:"learning.mytime_workshop.ho_manage",edit:"learning.mytime_workshop.ho_manage",history:"learning.mytime_workshop.bo_view"};
function ScopedWorkshop({surface,centerId,centerSource}:{surface:"HO"|"BO";centerId?:string;centerSource?:CenterSource}){
 const menu=useContext(TddHostMenu),[retry,setRetry]=useState(0),[ready,setReady]=useState<Ready|null>(null),[error,setError]=useState<{key:string;denied:boolean}|null>(null);
 const scopeKey=surface+":"+centerId+":"+centerSource+":"+retry;
 useEffect(()=>{
  if(surface==="BO"&&!centerId)return;
  const ctl=new AbortController(),cap=caps(surface),scope:WorkshopScope=surface==="HO"?{surface:"HO"}:{surface:"BO",centerId:centerId!};
  let session:ReturnType<typeof surfaceSession>|undefined;
  void (async()=>{
   session=surfaceSession(surface,undefined,fetch,scope.surface==="BO"?{id:scope.centerId,source:centerSource??"centers"}:undefined);
   const active=session;
   await active.refresh(ctl.signal);
   if(!active.context.authorize(cap.read))throw new WorkshopApiError(403);
   const transport:typeof fetch=async(input,init)=>{
    if(typeof input!=="string")throw new WorkshopApiError(400);
    const url=new URL(input,active.origin),method=init?.method??"GET";
    if(url.origin!==active.origin||url.username||url.password||url.hash||workshopHostDecision(url.host,url.pathname,method)!=="next"||!url.pathname.startsWith("/api/"+surface.toLowerCase()+"/learning/mytime-workshops"))throw new WorkshopApiError(403);
    const signal=init?.signal?AbortSignal.any([ctl.signal,init.signal]):ctl.signal;
    await active.refresh(signal);
    if(!active.context.authorize(cap.read)||(method!=="GET"&&(surface!=="HO"||!active.context.authorize(cap.edit))))throw new WorkshopApiError(403);
    const response=await fetch(url.toString(),{...init,signal,credentials:"same-origin",cache:"no-store",redirect:"error"});
    await active.refresh(signal);
    if(!active.context.authorize(cap.read))throw new WorkshopApiError(403);
    return response;
   };
   const data=await loadWorkshopRuntime(scope,ctl.signal,transport);
   const binding=workshopBinding(surface,data.choices,cap,{kind:"provider",source:{adapter:"core-mytime-workshop-history",permission:cap.history},load:(subject,ctx,cursor,signal)=>ctx.surface!==scope.surface||scope.surface==="BO"&&(ctx.surface!=="BO"||ctx.centerId!==scope.centerId)||!ctx.authorize(cap.history)?Promise.resolve({status:"denied"}):workshopHistory(data.api,subject,cursor,signal)});
   ctl.signal.throwIfAborted();
   setReady({key:scopeKey,binding,context:active.context,data});
  })().catch(e=>{if(!ctl.signal.aborted){session?.dispose();setError({key:scopeKey,denied:e instanceof WorkshopApiError&&(e.status===401||e.status===403)});}});
  return ()=>{ctl.abort();session?.dispose();};
 },[surface,centerId,centerSource,scopeKey]);
 const state=ready?.key===scopeKey?ready:null;
 if(!state)return <>{menu("mytime-workshops-menu")}{error?.key===scopeKey?<><RecordState status={error.denied?"denied":"error"}/><button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></>:<p role="status">Đang tải Workshop…</p>}</>;
 return <WorkshopWorkspace key={scopeKey} binding={state.binding} context={state.context} initialRows={state.data.rows} port={state.data.port} read={state.data.read} nativeNavigation/>;
}
export function HoWorkshopTdd(){return <ScopedWorkshop surface="HO"/>;}
export function BoWorkshopTdd(){
 const selection=useBoCenterSelection();
 if(selection?.loading)return <p role="status">Đang tải cơ sở…</p>;
 if(selection?.error)return <p role="alert">{selection.error}</p>;
 const id=selection?.centers.some(c=>c.id===selection.selected)?selection.selected:"";
 if(!id)return <p role="status">Chọn cơ sở để xem Workshop.</p>;
 return <ScopedWorkshop key={id} surface="BO" centerId={id} centerSource={selection?.source}/>;
}
