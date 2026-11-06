"use client";
// PAP-1419 / PNR-TV (PAP-650) — only shared TDD shell; no duplicate workspace.
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {useEffect,useState} from "react";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {createHoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRegistry} from "@/lib/workspace-schema";
import {BoApiError} from "@/lib/bo-api-error";
import {tvFields,tvDefinition,tvProvider,tvQuery} from "./schema";

type F=typeof tvFields;
type Ready={adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
export function HoTvTdd(){
 const[ready,setReady]=useState<Ready|null>(null);
 const[error,setError]=useState<"denied"|"error"|null>(null);
 const[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
  void createHoTddAdapter({registry:new TddRegistry(),definition:tvDefinition,provider:tvProvider},controller.signal)
   .then(result=>{
    adapter=result;
    if(controller.signal.aborted){result.dispose();return;}
    setReady({adapter:result,navigation:browserTddNavigation("HO","tvs",tvQuery)});
   }).catch(cause=>{
    if(controller.signal.aborted)return;
    const status=cause instanceof BoApiError?cause.status:
      (cause instanceof Error&&"status" in cause&&typeof cause.status==="number"?cause.status:null);
    setError(status===401||status===403?"denied":"error");
   });
  return()=>{controller.abort();adapter?.dispose();};
 },[retry]);
 const content=error?
  <p role="alert">{error==="denied"?"Không có quyền xem TV.":"Không tải được trạng thái TV."}{" "}
   <button type="button" onClick={()=>{setError(null);setReady(null);setRetry(x=>x+1);}}>Thử lại</button>
  </p>:
  ready?<SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={tvQuery}/>:
  <p role="status">Đang tải danh sách TV…</p>;
 return <HoWorkspace module="tvs" content={content}/>;
}
