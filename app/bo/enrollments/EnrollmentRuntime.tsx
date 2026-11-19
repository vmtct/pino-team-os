"use client";
/** PAP-2181: actual native bound schema, selected Center and existing session authority. */
import {useCallback,useContext,useEffect,useState} from "react";
import {useBoCenterSelection} from "../components/registration/BoCenterSelection";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {RecordState} from "@/app/components/workspace-renderer/Record";
import {surfaceSession,type CenterSource} from "@/lib/workspace-adapters/session";
import {bindSurface} from "@/lib/workspace-adapters/adapter";
import type {AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {TddRegistry} from "@/lib/workspace-schema";
import {BoApiError} from "@/lib/bo-api-error";
import {BoEnrollmentDirectory,type EnrollmentRow} from "./BoEnrollmentDirectory";
import {enrollmentRelationLinks} from "./enrollment-read-client";
import {enrollmentProvider} from "./provider";
import {READ,definition,queryDefault,type EnrollmentFields} from "./schema";
type Session=ReturnType<typeof surfaceSession>;
type Result={scopeKey:string;adapter:AuthenticatedSurfaceAdapter<EnrollmentFields>;rows:readonly EnrollmentRow[];source:ReturnType<typeof enrollmentProvider>}|{scopeKey:string;error:"denied"|"error"};
export function BoEnrollmentTdd(){
 const center=useBoCenterSelection(),menu=useContext(TddHostMenu);
 const centerId=!center?.loading&&!center?.error&&center?.centers.some(c=>c.id===center.selected)?center.selected:"";
 if(!centerId)return <>{menu("enrollment-menu")}{center?.loading?<p role="status">Đang tải cơ sở…</p>:center?.error?<p role="alert">{center.error}</p>:<p role="status">Chọn cơ sở để xem lịch học.</p>}</>;
 const source=center?.source??"centers";
 // A -> B -> A is a new mounted scope, never the previous A state/session.
 return <EnrollmentScope key={JSON.stringify([centerId,source])} centerId={centerId} source={source}/>;
}
function EnrollmentScope({centerId,source}:{centerId:string;source:CenterSource}){
 const menu=useContext(TddHostMenu);
 const [retry,setRetry]=useState(0),[result,setResult]=useState<Result|null>(null);
 const scopeKey=centerId+":"+source+":"+retry;
 useEffect(()=>{
  if(!centerId)return;
  const ctl=new AbortController();let session:Session|undefined;
  const projection=enrollmentProvider();
  void(async()=>{
   session=surfaceSession("BO",undefined,fetch,{id:centerId,source});
   const active=session;
   const adapter=await bindSurface(active,{registry:new TddRegistry(),definition,provider:projection.provider},ctl.signal);
   if(!active.context.authorize(READ)||!active.context.authorize("student.profile.view"))throw new BoApiError(403,"Không có quyền xem lịch học.",null);
   const list=await adapter.list(queryDefault,ctl.signal);
   if(!active.context.authorize(READ)||!active.context.authorize("student.profile.view"))throw new BoApiError(403,"Không có quyền xem lịch học.",null);
   ctl.signal.throwIfAborted();
   setResult({scopeKey,adapter,rows:list.rows,source:projection});
  })().catch(e=>{if(!ctl.signal.aborted){session?.dispose();projection.dispose();setResult({scopeKey,error:e instanceof BoApiError&&[401,403].includes(e.status)?"denied":"error"});}});
  return()=>{ctl.abort();session?.dispose();projection.dispose();};
 },[centerId,source,scopeKey]);
 const current=result?.scopeKey===scopeKey?result:null;
 const ready=current&&!("error" in current)?current:null;
 const readRecord=useCallback(async(id:string,signal:AbortSignal)=>{
  if(!ready)return null;
  const result=await ready.adapter.detail(id,signal);
  if(!ready.adapter.context.authorize("student.profile.view"))throw new BoApiError(403,"Không có quyền xem lịch học.",null);
  return result?.row??null;
 },[ready]);
 if(!ready)return <>{menu("enrollment-menu")}{current&&"error" in current?<><RecordState status={current.error}/><button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></>:<p role="status">Đang tải lịch học…</p>}</>;
 return <BoEnrollmentDirectory key={scopeKey} context={ready.adapter.context} binding={ready.adapter} rows={ready.rows} readRecord={readRecord} relationLinks={row=>{const relation=ready.source.relation(row.id);return relation?enrollmentRelationLinks(relation,centerId):[];}}/>;
}
