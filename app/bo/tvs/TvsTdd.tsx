"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {useEffect,useState} from "react";
import readApi from "@/public/bo-authority-source/school-adapters.js";
import {boApi} from "@/lib/bo-api";
import type {BoCenter} from "@/lib/bo-model";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {createBoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRegistry} from "@/lib/workspace-schema";
import type {SlotLoaders} from "@/app/components/workspace-renderer/Slots";
import {HouseMeshEditor} from "@/app/bo/pinoria-tv-mesh/HouseMeshEditor";

import {tvDefinition,tvFields,tvProvider,tvQuery,verifyTvExtension} from "./schema";
type F=typeof tvFields;
type Ready={adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
const source:BoWorkspaceSource={...readApi,modules:{...readApi.modules,tvs:{label:"TVs",group:"Pinoria",fields:[
 {key:"name",label:"TV / Display",type:"text",icon:"Aa",w:230,readonly:true},
 {key:"runtime",label:"Runtime",type:"text",icon:"▣",w:180,readonly:true},
 {key:"status",label:"Trạng thái",type:"text",icon:"◉",w:180,readonly:true},
 {key:"deviceCount",label:"Thiết bị",type:"number",icon:"#",w:125,readonly:true},
]}}};
const active=(c:BoCenter)=>/^[0-9a-f-]{36}$/i.test(c.id)&&c.status==="active";
const loaders:SlotLoaders={
 "pinoria.tv.spatial":async(_slot,record,_context)=>{
   if(record.runtime!=="PINORIA_HOUSE")return <p role="status">Không gian House chỉ khả dụng cho TV PINORIA_HOUSE.</p>;
   const center=String(record.centerId??"");
   if(!/^[0-9a-f-]{36}$/i.test(center))return <p role="alert">Thiếu Center đã xác thực.</p>;
   return <><HouseMeshEditor embeddedCenterId={center}/><TvHealthReadOnlyPanel centerId={center}/></>;
 }
};
type TvSessionHealth = {
  sessionId:string;deviceId:string;displayId:string;heartbeatFresh:boolean;rendererAcknowledged:false;
  observationStatus:"FRESH"|"STALE"|"NONE";
  latestObservation:null|{configSource:"PUBLISHED"|"FALLBACK";appliedConfigRevision:number;buildDigest:string;assetStatus:"READY"|"DEGRADED"|"UNKNOWN";observedAt:string;fresh:true};
};
type TvHealthPayload = {centerId:string;deviceSessions:TvSessionHealth[]};
function TvHealthReadOnlyPanel({centerId}:{centerId:string}){
  const [health,setHealth]=useState<TvHealthPayload|null>(null);
  const [error,setError]=useState("");
  const [refresh,setRefresh]=useState(0);
  const [busy,setBusy]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();
    setBusy(true);setError("");setHealth(null);
    void fetch(`/api/bo/tv/operator-health?centerId=${encodeURIComponent(centerId)}`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{
        const data=await response.json() as {data?:TvHealthPayload;error?:{message?:string}};
        if(!response.ok||!data.data||data.data.centerId!==centerId||!Array.isArray(data.data.deviceSessions))
          throw new Error(data.error?.message??"Core TV Health không khả dụng.");
        return data.data;
      })
      .then(data=>{if(!controller.signal.aborted)setHealth(data)})
      .catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Không đọc được TV Health.")})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false)});
    return ()=>controller.abort();
  },[centerId,refresh]);
  return <section aria-label="BO TV runtime health" data-testid="bo-tv-runtime-health">
    <h3>Runtime Health · Center</h3>
    <p>Chứng cứ từ Core theo Center; heartbeat không phải renderer ACK.</p>
    <button type="button" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>{busy?"Đang tải…":"Làm mới health"}</button>
    {error?<p role="alert">{error}</p>:null}
    {health?.deviceSessions.length===0?<p role="status">Không có phiên TV đang hoạt động.</p>:null}
    {health?.deviceSessions.map(session=>{
      const obs=session.observationStatus==="FRESH"?session.latestObservation:null;
      return <article key={session.sessionId}>
        <strong>Session {session.sessionId}</strong>
        <p>Device {session.deviceId} · Display {session.displayId}</p>
        <p>Heartbeat: {session.heartbeatFresh?"Mới":"Cũ"} · Renderer ACK: chưa xác thực</p>
        {obs&&obs.fresh&&/^[0-9a-f]{64}$/.test(obs.buildDigest)&&
          ((obs.configSource==="FALLBACK"&&obs.appliedConfigRevision===0)||
          (obs.configSource==="PUBLISHED"&&Number.isSafeInteger(obs.appliedConfigRevision)&&obs.appliedConfigRevision>0))
          ?<p data-testid="bo-tv-observation">{obs.configSource} · revision {obs.appliedConfigRevision} · build {obs.buildDigest.slice(0,12)} · assets {obs.assetStatus} · observed {obs.observedAt} (không phải renderer ACK)</p>
          :<p role="status">{session.observationStatus==="STALE"?"Observation đã cũ, không xác nhận cấu hình hiện tại.":"Chưa có observation hợp lệ còn mới."}</p>}
      </article>;
    })}
  </section>;
}

export function TvsTdd(){
 const [centers,setCenters]=useState<readonly BoCenter[]>([]);
 const [centerId,setCenterId]=useState("");
 const [centerError,setCenterError]=useState("");
 const [ready,setReady]=useState<Ready|null>(null);
 const [error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
   let live=true;
   void boApi.centers().then(rows=>{
     if(!live)return;
     const allowed=rows.filter(active);setCenters(allowed);setCenterId(allowed.length===1?allowed[0]!.id:"");
     if(!allowed.length)setCenterError("Không có Center hoạt động được cấp quyền.");
   }).catch(()=>{if(live)setCenterError("Không thể tải Center có quyền truy cập.")});
   return()=>{live=false};
 },[]);
 useEffect(()=>{
   if(!centerId)return;
   const ctrl=new AbortController();let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
   void createBoTddAdapter({registry:new TddRegistry((approval,scope)=>verifyTvExtension(approval,scope)),definition:tvDefinition,provider:tvProvider,centerId:centerId,centerSource:"centers"},ctrl.signal)
   .then(a=>{adapter=a;if(ctrl.signal.aborted){a.dispose();return}setReady({adapter:a,navigation:browserTddNavigation("BO","tvs",tvQuery)});})
   .catch(e=>{if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:"Không đủ quyền tv.view tại Center.")});
   return()=>{ctrl.abort();adapter?.dispose()};
 },[centerId,retry]);
 const content=<section data-testid="bo-tvs-tdd" aria-label="TVs tại Center">
  <div className="property-row"><label htmlFor="bo-tv-center">Center</label>
   <select id="bo-tv-center" value={centerId} onChange={e=>{setReady(null);setError("");setCenterId(e.target.value)}}>
    <option value="">Chọn Center</option>{centers.map(c=><option key={c.id} value={c.id}>{c.displayName}</option>)}
   </select>
  </div>
  {!centerId?<p role="status">{centerError||"Chọn Center được cấp quyền để xem TVs."}</p>:
   error?<p role="alert">{error} <button type="button" onClick={()=>{setReady(null);setError("");setRetry(v=>v+1)}}>Thử lại</button></p>:
   ready?<><SurfaceWorkspace key={centerId} adapter={ready.adapter} navigation={ready.navigation} initialQuery={tvQuery} businessLoaders={loaders}/>
    <p role="note">Trạng thái bảng là trạng thái định nghĩa Display, không phải trạng thái Online. Thông tin phiên và telemetry chỉ hiển thị khi Core trả về chứng cứ có quyền.</p></>:
   <p role="status">Đang kiểm tra quyền Center và tải Display…</p>}
 </section>;
 return <BoRegistrationWorkspace source={source} moduleKey="tvs" currentUser={{displayName:null}} content={content}/>;
}
