"use client";
import { useEffect, useState } from "react";
import { ReceptionTv } from "@/app/pinoria-tv/reception-tv";
import styles from "./runtime.module.css";
type Context={sessionId:string;deviceId:string|null;expiresAt:string;display:{id:string;key:string;displayName:string;runtimeType:string;scopeType:"GLOBAL"|"CENTER";scopeId:string|null;orientation:"LANDSCAPE"|"PORTRAIT";targetAspectRatio:"16:9"|"9:16"}};
export function TvRuntimeHost({displayId}:{displayId:string}){
  const [context,setContext]=useState<Context|null>(null);const [error,setError]=useState("");const [actual,setActual]=useState<"LANDSCAPE"|"PORTRAIT"|null>(null);
  useEffect(()=>{const measure=()=>setActual(innerWidth>=innerHeight?"LANDSCAPE":"PORTRAIT");measure();addEventListener("resize",measure);return()=>removeEventListener("resize",measure);},[]);
  useEffect(()=>{
    let disposed=false;
    let inFlight=false;
    let initialized=false;
    const refresh=async()=>{
      if(inFlight||disposed)return;
      inFlight=true;
      try{
        const response=await fetch(`/api/tv/runtime/${displayId}/context`,{cache:"no-store"});
        if(response.status===401||response.status===403){
          // Revoked/expired display authority must unmount the renderer immediately.
          if(!disposed){setContext(null);setError("TV runtime session expired or revoked");}
          return;
        }
        if(!response.ok)throw new Error("TV runtime unavailable");
        const json=await response.json() as {data?:Context};
        if(!json.data)throw new Error("TV runtime unavailable");
        if(!disposed){setContext(json.data);setError("");}
      }catch{
        // Transient outages are not evidence of revocation. Keep any previously
        // validated runtime mounted; never infer a scene release from 5xx/network.
        if(!disposed&&!initialized)setError("TV runtime unavailable");
      }finally{initialized=true;inFlight=false;}
    };
    void refresh();
    const timer=window.setInterval(()=>void refresh(),15000);
    const onVisible=()=>{if(document.visibilityState==="visible")void refresh();};
    document.addEventListener("visibilitychange",onVisible);
    return()=>{disposed=true;window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);};
  },[displayId]);
  if(error)return <main className={styles.state}><strong>TV unavailable</strong><span>{error}</span></main>;
  if(!context||!actual)return <main className={styles.state}><strong>Connecting…</strong></main>;
  if(actual!==context.display.orientation)return <main className={styles.state} data-tv-orientation-mismatch="true"><strong>Rotate display</strong><span>{context.display.displayName} requires {context.display.orientation} · {context.display.targetAspectRatio}. Current viewport is {actual}.</span></main>;
  if(context.display.runtimeType==="PINORIA_HOUSE"&&context.display.scopeType==="CENTER"&&context.display.scopeId){
    return <div className={styles.runtime} data-tv-runtime-active={context.display.runtimeType}><ReceptionTv fixedCenterId={context.display.scopeId} runtimeIdentity={{displayId,sessionId:context.sessionId,deviceId:context.deviceId}} apiBase={`/api/tv/runtime/${displayId}/pinoria-house`}/></div>;
  }
  return <main className={styles.state}><strong>Unsupported TV runtime</strong><span>{context.display.runtimeType}</span></main>;
}
