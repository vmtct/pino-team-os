"use client";
import { useEffect, useState } from "react";
import { ReceptionTv } from "@/app/pinoria-tv/reception-tv";
import styles from "./runtime.module.css";
type Context={sessionId:string;expiresAt:string;display:{id:string;key:string;displayName:string;runtimeType:string;scopeType:"GLOBAL"|"CENTER";scopeId:string|null;orientation:"LANDSCAPE"|"PORTRAIT";targetAspectRatio:"16:9"|"9:16"}};
export function TvRuntimeHost({displayId}:{displayId:string}){
  const [context,setContext]=useState<Context|null>(null);const [error,setError]=useState("");const [actual,setActual]=useState<"LANDSCAPE"|"PORTRAIT"|null>(null);
  useEffect(()=>{const measure=()=>setActual(innerWidth>=innerHeight?"LANDSCAPE":"PORTRAIT");measure();addEventListener("resize",measure);return()=>removeEventListener("resize",measure);},[]);
  useEffect(()=>{void fetch(`/api/tv/runtime/${displayId}/context`,{cache:"no-store"}).then(async response=>{const json=await response.json() as {data?:Context;error?:{message?:string}};if(!response.ok||!json.data)throw new Error(json.error?.message??"TV runtime unavailable");setContext(json.data);}).catch(cause=>setError(cause instanceof Error?cause.message:"TV runtime unavailable"));},[displayId]);
  if(error)return <main className={styles.state}><strong>TV unavailable</strong><span>{error}</span></main>;
  if(!context||!actual)return <main className={styles.state}><strong>Connecting…</strong></main>;
  if(actual!==context.display.orientation)return <main className={styles.state} data-tv-orientation-mismatch="true"><strong>Rotate display</strong><span>{context.display.displayName} requires {context.display.orientation} · {context.display.targetAspectRatio}. Current viewport is {actual}.</span></main>;
  if(context.display.runtimeType==="PINORIA_HOUSE"&&context.display.scopeType==="CENTER"&&context.display.scopeId){
    return <div className={styles.runtime} data-tv-runtime-active={context.display.runtimeType}><ReceptionTv fixedCenterId={context.display.scopeId} apiBase={`/api/tv/runtime/${displayId}/pinoria-house`}/></div>;
  }
  return <main className={styles.state}><strong>Unsupported TV runtime</strong><span>{context.display.runtimeType}</span></main>;
}
