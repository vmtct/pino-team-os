"use client";
/** PAP-2181: real read adapter, selected Center and existing session authority. */
import {useContext,useEffect,useState} from "react";
import {useBoCenterSelection} from "../components/registration/BoCenterSelection";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {RecordState} from "@/app/components/workspace-renderer/Record";
import {surfaceSession} from "@/lib/workspace-adapters/session";
import {BoApiError} from "@/lib/bo-api-error";
import {BoEnrollmentDirectory} from "./BoEnrollmentDirectory";
import {readEnrollmentRows,enrollmentRelationLinks,type EnrollmentRead} from "./enrollment-read-client";
import {READ} from "./schema";
type Session=ReturnType<typeof surfaceSession>;
type Result={scopeKey:string;session:Session;entries:EnrollmentRead[]}|{scopeKey:string;error:"denied"|"error"};
export function EnrollmentRuntime(){
 const center=useBoCenterSelection(),menu=useContext(TddHostMenu);
 const centerId=!center?.loading&&!center?.error&&center?.centers.some(c=>c.id===center.selected)?center.selected:"";
 const source=center?.source??"centers";
 const [retry,setRetry]=useState(0),[result,setResult]=useState<Result|null>(null);
 const scopeKey=centerId+":"+source+":"+retry;
 useEffect(()=>{
  if(!centerId)return;
  const ctl=new AbortController();let session:Session|undefined;
  void(async()=>{
   session=surfaceSession("BO",undefined,fetch,{id:centerId,source});
   const active=session;
   await active.refresh(ctl.signal);
   if(!active.context.authorize(READ)||!active.context.authorize("student.profile.view"))throw new BoApiError(403,"Không có quyền xem lịch học.",null);
   const entries=await readEnrollmentRows(active.transport,centerId,ctl.signal);
   await active.refresh(ctl.signal);
   if(!active.context.authorize(READ)||!active.context.authorize("student.profile.view"))throw new BoApiError(403,"Không có quyền xem lịch học.",null);
   ctl.signal.throwIfAborted();
   setResult({scopeKey,session:active,entries});
  })().catch(e=>{if(!ctl.signal.aborted){session?.dispose();setResult({scopeKey,error:e instanceof BoApiError&&[401,403].includes(e.status)?"denied":"error"});}});
  return()=>{ctl.abort();session?.dispose();};
 },[centerId,source,scopeKey]);
 const current=result?.scopeKey===scopeKey?result:null;
 if(!centerId||!current||"error" in current)return <>{menu("enrollment-menu")}{center?.loading?<p role="status">Đang tải cơ sở…</p>:center?.error?<p role="alert">{center.error}</p>:!centerId?<p role="status">Chọn cơ sở để xem lịch học.</p>:current&&"error" in current?<><RecordState status={current.error}/><button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></>:<p role="status">Đang tải lịch học…</p>}</>;
 const links=new Map(current.entries.map(e=>[e.row.id,e.relations]));
 return <BoEnrollmentDirectory key={scopeKey} context={current.session.context} rows={current.entries.map(e=>e.row)} relationLinks={row=>{const relation=links.get(row.id);return relation?enrollmentRelationLinks(relation,centerId):[];}}/>;
}
