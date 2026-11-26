"use client";
/** PAP-2288 / PLT-LEAD — only a server-admitted actor may mount the native household boundary. */
import {useEffect,useState} from "react";
import {LeadHouseholdM1Preview} from "./LeadHouseholdM1Preview";
import {openNativeLeadAdapter} from "./native-lead-adapter";
import styles from "./lead-household-m1.module.css";
type Adapter=ReturnType<typeof openNativeLeadAdapter>;
type State={phase:"loading"}|{phase:"ready";adapter:Adapter}|{phase:"unavailable"};
function ActorLeadEntry({actorId}:{actorId:string}){
 const [state,setState]=useState<State>({phase:"loading"});
 useEffect(()=>{
  let active=true;
  let adapter:Adapter|undefined;
  // Defer browser-only initialization until hydration; StrictMode cleanup can
  // cancel the first scheduled initialization before any adapter is created.
  queueMicrotask(()=>{
   if(!active)return;
   try{
    adapter=openNativeLeadAdapter(actorId,window.location.origin,window.sessionStorage);
    setState({phase:"ready",adapter});
   }catch{
    setState({phase:"unavailable"});
   }
  });
  return ()=>{active=false;adapter?.dispose();};
 },[actorId]);
 if(state.phase==="loading")return <main className={styles.page}><p role="status">Đang tải danh bạ Leads…</p></main>;
 if(state.phase==="unavailable")return <main className={styles.page}><p role="alert">Không thể xác minh phiên Leads. Vui lòng tải lại trang.</p></main>;
 return <LeadHouseholdM1Preview readApi={state.adapter.api} commandApi={state.adapter.api} recoveryJournal={state.adapter.journal} recoverApi={state.adapter.recover} intentApi={state.adapter.intent}/>;
}
export function NativeLeadEntry({actorId}:{actorId:string}){
 return <ActorLeadEntry key={actorId} actorId={actorId}/>;
}
