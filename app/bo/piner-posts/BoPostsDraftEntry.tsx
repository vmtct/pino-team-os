"use client";
/** PAP-2134 / PNR-APP-HUB: native selected-Center entry; no independent picker or fake grants. */
import {useContext,useEffect,useState} from "react";
import {useBoCenterSelection} from "../components/registration/BoCenterSelection";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {RecordState} from "@/app/components/workspace-renderer/Record";
import {BoPostsDraftRuntime} from "./BoPostsDraftRuntime";
import {openNativeDraftSession,type NativeDraftSession} from "./native-draft-session";
import {CoreDraftRequestError} from "./core-draft-client";
import type {CenterSource} from "@/lib/workspace-adapters/session";
export function BoPostsTdd(){
 const center=useBoCenterSelection(),menu=useContext(TddHostMenu);
 const selected=center?.centers.find(c=>c.id===center.selected);
 if(!center||center.error)return <section>{menu("posts-entry-menu")}<RecordState status="denied"/></section>;
 if(center.loading)return <section>{menu("posts-entry-menu")}<RecordState status="loading"/></section>;
 if(!selected)return <section>{menu("posts-entry-menu")}<RecordState status="denied"/></section>;
 return <ScopeSession key={selected.id+":"+center.source} centerId={selected.id} centerLabel={selected.displayName} source={center.source}/>;
}
function ScopeSession({centerId,centerLabel,source}:{centerId:string;centerLabel:string;source:CenterSource}){
 const menu=useContext(TddHostMenu),[session,setSession]=useState<NativeDraftSession|null>(null),[state,setState]=useState<"loading"|"error"|"denied">("loading"),[retry,setRetry]=useState(0);
 useEffect(()=>{const abort=new AbortController();let own:NativeDraftSession|null=null;
  void openNativeDraftSession(centerId,source,abort.signal).then(s=>{if(abort.signal.aborted){s.dispose();return;}own=s;setSession(s);},e=>{if(!abort.signal.aborted)setState(e instanceof CoreDraftRequestError&&[401,403].includes(e.status)?"denied":"error");});
  return()=>{abort.abort();own?.dispose();};
 },[centerId,source,retry]);
  if(session){
  return <BoPostsDraftRuntime session={session} centerLabel={centerLabel}/>;
 }
 return <section>{menu("posts-session-menu")}<RecordState status={state} onRetry={()=>{setState("loading");setRetry(n=>n+1);}}/></section>;
}
