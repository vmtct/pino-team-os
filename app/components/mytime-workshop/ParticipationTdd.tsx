"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {useContext,useEffect,useState} from "react";
import Link from "next/link";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import {RecordState,TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {surfaceSession} from "@/lib/workspace-adapters/session";
import type {AuthorizationContext} from "@/lib/workspace-schema";
import readApi from "@/public/bo-authority-source/school-adapters.js";
import {boParticipationBinding,boParticipationRegistry,boParticipationSchema,hoParticipationBinding,hoParticipationRegistry,hoParticipationSchema,type ParticipationBinding,type ParticipationRow} from "./ParticipationSchema";

const readCaps=(surface:"BO"|"HO")=>({read:surface==="BO"?"learning.mytime_workshop.bo_view":"learning.mytime_workshop.ho_view"});
const participationSource:BoWorkspaceSource={
  ...readApi,
  modules:{...readApi.modules,"mytime-participations":{label:"Participation",group:"Open Studio",fields:[]}},
  readOnly:true,
  ephemeral:true,
  routeForModule:key=>key==="mytime-participations"?"/bo/mytime-participations":"/bo?module="+encodeURIComponent(key),
};

function ParticipationDirectoryWorkspace({surface,context,binding}:{surface:"BO"|"HO";context:AuthorizationContext;binding:ParticipationBinding}){
  const menu=useContext(TddHostMenu);
  const [query,setQuery]=useState(binding.query);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [detail,setDetail]=useState(false);
  const rows:readonly ParticipationRow[]=[];
  const selected=rows.find(row=>row.id===selectedId)??null;
  return <TddPreferencePolicy.Provider value="ephemeral">
    <p role="status">Core read chưa được nối trong M1. Không có bản ghi mẫu hoặc dữ liệu giả.</p>
    <TddRenderer view={{kind:"table",mobileMenu:menu("mytime-participations-menu"),headerActions:<Link className="secondary-btn" href={"/"+surface.toLowerCase()+"/mytime-workshops"}>Workshop</Link>,props:{
      registry:surface==="BO"?boParticipationRegistry:hoParticipationRegistry,
      schema:surface==="BO"?boParticipationSchema:hoParticipationSchema,
      context,rows,query,status:"ready",onQueryChange:setQuery,
      onOpen:record=>{setSelectedId(record.id);setDetail(false);},
    }}}/>
    {selected&&!detail?<TddRenderer view={{kind:"drawer",props:{registry:binding.registry,schema:surface==="BO"?boParticipationSchema:hoParticipationSchema,context,record:selected,onClose:()=>setSelectedId(null),onDetail:()=>setDetail(true)}}}/>:null}
    {selected&&detail?<TddRenderer view={{kind:"detail",props:{registry:binding.registry,schema:surface==="BO"?boParticipationSchema:hoParticipationSchema,context,record:selected,subject:{type:"mytime_participation",id:selected.id},onBack:()=>setDetail(false)}}}/>:null}
  </TddPreferencePolicy.Provider>;
}

type CenterSource=Parameters<typeof surfaceSession>[3] extends infer C ? NonNullable<C> extends {source:infer S}?S:never:never;
function ScopedParticipationDirectory({surface,centerId,centerSource}:{surface:"BO"|"HO";centerId?:string;centerSource?:CenterSource}){
  const [ready,setReady]=useState<{key:string;context:AuthorizationContext}|null>(null);
  const [error,setError]=useState<{key:string;denied:boolean}|null>(null);
  const [retry,setRetry]=useState(0);
  const scopeKey=surface+":"+centerId+":"+centerSource+":"+retry;
  useEffect(()=>{
    if(surface==="BO"&&!centerId)return;
    const ctl=new AbortController(),cap=readCaps(surface).read;
    let session:ReturnType<typeof surfaceSession>|undefined;
    void (async()=>{
      session=surfaceSession(surface,undefined,fetch,surface==="BO"?{id:centerId!,source:centerSource??"centers"}:undefined);
      await session.refresh(ctl.signal);
      if(!session.context.authorize(cap)){setError({key:scopeKey,denied:true});return;}
      setReady({key:scopeKey,context:session.context});
      setError(null);
    })().catch(()=>{if(!ctl.signal.aborted)setError({key:scopeKey,denied:false});});
    return ()=>{ctl.abort();session?.dispose();};
  },[surface,centerId,centerSource,scopeKey]);
  const state=ready?.key===scopeKey?ready:null;
  if(!state)return <>{error?.key===scopeKey?<><RecordState status={error.denied?"denied":"error"}/><button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></>:<p role="status">Đang xác minh quyền Participation…</p>}</>;
  return <ParticipationDirectoryWorkspace surface={surface} context={state.context} binding={surface==="BO"?boParticipationBinding:hoParticipationBinding}/>;
}

export function HoParticipationTdd(){return <ScopedParticipationDirectory surface="HO"/>;}
function ScopedBoParticipationDirectory(){
  const selection=useBoCenterSelection();
  if(selection?.loading)return <p role="status">Đang tải cơ sở…</p>;
  if(selection?.error)return <p role="alert">{selection.error}</p>;
  const id=selection?.centers.some(center=>center.id===selection.selected)?selection.selected:"";
  if(!id)return <p role="status">Chọn cơ sở để xem Participation.</p>;
  return <ScopedParticipationDirectory key={id} surface="BO" centerId={id} centerSource={selection?.source}/>;
}
export function BoParticipationTdd(){
  return <BoRegistrationWorkspace source={participationSource} moduleKey="mytime-participations" currentUser={{displayName:null}} content={<ScopedBoParticipationDirectory/>}/>;
}
