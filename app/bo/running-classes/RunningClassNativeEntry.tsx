"use client";
/** PLT-DELIVERY / PAP-1037 / PAP-1043 / PAP-2225 — native live workspace, not M1 fixture. */
import {useEffect,useMemo,useState} from "react";
import type {BoContext} from "@/lib/bo-model";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "../components/registration/BoRegistrationWorkspace";
import {useBoCenterSelection} from "../components/registration/BoCenterSelection";
import {useBoStagingUser} from "../components/registration/BoRuntimeBoundary";
import {RecordState} from "@/app/components/workspace-renderer/Record";
import school from "@/public/bo-authority-source/school-adapters.js";
import {classTableModule} from "./running-class-presentation";
import {openRunningClassProvider,type RunningClassProvider} from "./running-class-provider";
import {RC_REVIEW_PATH} from "./running-class-review-query";

export function RunningClassNativeEntry(){
 const user=useBoStagingUser(),center=useBoCenterSelection(),selected=center?.selected??"";
 if(!user||!center||center.error)return <RecordState status="denied"/>;
 if(center.loading)return <RecordState status="loading"/>;
 if(!selected||!center.centers.some(c=>c.id===selected))return <RecordState status="denied"/>;
 return <ScopedNative key={selected} centerId={selected} user={user}/>;
}
function ScopedNative({centerId,user}:{centerId:string;user:{displayName:string|null}}){
 const options=useMemo(()=>({centerId}),[centerId]);
 const [session,setSession]=useState<{provider:RunningClassProvider;source:BoWorkspaceSource}|null>(null);
 const [error,setError]=useState(false);
 useEffect(()=>{
  const abort=new AbortController();
  let opened:RunningClassProvider|undefined;
  const fetcher:typeof fetch=(input,init)=>fetch(input,{...init,signal:init?.signal?AbortSignal.any([abort.signal,init.signal]):abort.signal,credentials:"same-origin",cache:"no-store"});
  const context=async()=>{
   const result=await fetcher("/api/bo/context?centerId="+encodeURIComponent(centerId),{method:"GET"});
   if(!result.ok)throw Error("Không thể xác nhận quyền Running Class.");
   const body=await result.json() as {data?:BoContext};
   if(!body.data)throw Error("Không có quyền Running Class.");
   return body.data;
  };
  void Promise.resolve().then(()=>openRunningClassProvider({centerId,context,selectedCenter:()=>abort.signal.aborted?"":centerId,fetcher,storage:window.sessionStorage})).then(provider=>{
   opened=provider;
   if(abort.signal.aborted){provider.dispose();return;}
   const source:BoWorkspaceSource={modules:{...school.modules,classes:classTableModule(school.modules.classes)},runningClassLive:provider,
    routeForModule:key=>key==="classes"?RC_REVIEW_PATH:"/bo?module="+encodeURIComponent(key),
    scopeLabel:()=>"",
    load:async(key,_fetcher,requested)=>{if(key!=="classes"||requested.centerId!==centerId)throw Error("Phạm vi Running Class không hợp lệ.");return provider.load();}
   };
   setSession({provider,source});
  }).catch(()=>{if(!abort.signal.aborted)setError(true);});
  return()=>{abort.abort();opened?.dispose();};
 },[centerId]);
 if(error)return <RecordState status="denied"/>;
 if(!session)return <RecordState status="loading"/>;
 return <BoRegistrationWorkspace source={session.source} moduleKey="classes" options={options} currentUser={user}/>;
}
