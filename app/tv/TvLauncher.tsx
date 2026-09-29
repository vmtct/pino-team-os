"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./tv.module.css";

type TvDefinition={id:string;key:string;displayName:string;description:string|null;runtimeType:string;scopeType:"GLOBAL"|"CENTER";scopeId:string|null;orientation:"LANDSCAPE"|"PORTRAIT";targetAspectRatio:"16:9"|"9:16";status:string};
export function TvLauncher(){
  const router=useRouter();const [items,setItems]=useState<TvDefinition[]>([]);const [error,setError]=useState("");const [busy,setBusy]=useState<string|null>(null);
  useEffect(()=>{void fetch("/api/tos-learning/tv/displays",{cache:"no-store"}).then(async response=>{
    const json=await response.json() as {data?:TvDefinition[];error?:{message?:string}};
    if(!response.ok)throw new Error(json.error?.message??"Không tải được TV.");
    setItems(json.data??[]);
  }).catch(cause=>setError(cause instanceof Error?cause.message:"Không tải được TV."));},[]);
  async function open(tv:TvDefinition){
    setBusy(tv.id);setError("");
    try{
      const response=await fetch(`/api/tv/${tv.id}/launch`,{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
      const json=await response.json() as {error?:{message?:string}};
      if(!response.ok)throw new Error(json.error?.message??"Không thể mở TV.");
      router.push(`/tv/${tv.id}`);
    }catch(cause){setError(cause instanceof Error?cause.message:"Không thể mở TV.");setBusy(null);}
  }
  return <div className={styles.launcher}>
    <header className={styles.heading}><span>TV PLATFORM</span><h1>TV</h1><p>Chọn màn hình được phân quyền để mở trên browser này.</p></header>
    {error?<div className={styles.error}>{error}</div>:null}
    <section className={styles.grid} aria-label="TV được phép mở">
      {items.map(tv=><article key={tv.id} className={styles.card}
        data-tv-id={tv.id} data-tv-key={tv.key} data-tv-runtime={tv.runtimeType}
        data-tv-scope={tv.scopeType} data-tv-orientation={tv.orientation}>
        <div><small>{tv.runtimeType.replaceAll("_"," ")} · {tv.scopeType}</small><h2>{tv.displayName}</h2><p>{tv.description??"TV runtime"}</p></div>
        <div className={styles.meta}><span>{tv.orientation}</span><span>{tv.targetAspectRatio}</span></div>
        <button type="button" data-tv-action="open-here" disabled={busy!==null} onClick={()=>void open(tv)}>{busy===tv.id?"Đang mở…":"Open here"}</button>
      </article>)}
      {!items.length&&!error?<p className={styles.empty}>Không có TV nào trong phạm vi quyền hiện tại.</p>:null}
    </section>
  </div>;
}
