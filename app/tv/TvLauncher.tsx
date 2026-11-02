"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./tv.module.css";

type TvDefinition={id:string;key:string;displayName:string;description:string|null;runtimeType:string;scopeType:"GLOBAL"|"CENTER";scopeId:string|null;orientation:"LANDSCAPE"|"PORTRAIT";targetAspectRatio:"16:9"|"9:16";status:string};

/** PAP-1344: the SAME Core-authorized launcher serves the TOS TV route and Station TV tab.
 * Launch stays in this browser so the HttpOnly TV runtime cookie is never transported.
 * Device-specific BO telemetry requires an independently verified device binding. */
export function TvLauncher({station=false}:{station?:boolean}={}){
  const router=useRouter();
  const [items,setItems]=useState<TvDefinition[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch("/api/tos-learning/tv/displays",{cache:"no-store",signal:controller.signal})
      .then(async response=>{
        const json=await response.json() as {data?:TvDefinition[];error?:{message?:string}};
        if(!response.ok)throw new Error(json.error?.message??"Không tải được TV.");
        if(!controller.signal.aborted)setItems(json.data??[]);
      })
      .catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Không tải được TV.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[]);
  async function open(tv:TvDefinition){
    if(busy)return;
    setBusy(tv.id);setError("");
    try{
      const response=await fetch(`/api/tv/${tv.id}/launch`,{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:"{}"});
      const json=await response.json() as {error?:{message?:string}};
      if(!response.ok)throw new Error(json.error?.message??"Không thể mở TV.");
      // The cookie is HttpOnly and bound to this browser, not another physical display.
      router.push(`/tv/${tv.id}`);
    }catch(cause){setError(cause instanceof Error?cause.message:"Không thể mở TV.");setBusy(null);}
  }
  return <div className={station?styles.stationLauncher:styles.launcher} data-tv-launcher={station?"station":"standalone"}>
    {station?<p className={styles.stationIntro}>Chọn màn hình được phân quyền để mở trực tiếp trên trình duyệt Trạm TOS này.</p>:
      <header className={styles.heading}><span>TV PLATFORM</span><h1>TV</h1><p>Chọn màn hình được phân quyền để mở trên browser này.</p><Link href="/pinoria/tv-operator">Xem hàng đợi TV (chỉ đọc)</Link></header>}
    {error?<div role="alert" className={styles.error}>{error}</div>:null}
    {loading?<p role="status" className={styles.empty}>Đang tải danh sách TV…</p>:null}
    {!loading&&!error&&!items.length?<p className={styles.empty}>Không có TV nào trong phạm vi quyền hiện tại.</p>:null}
    <section className={styles.grid} aria-label="TV được phép mở">
      {items.map(tv=><article key={tv.id} className={styles.card}
        data-tv-id={tv.id} data-tv-key={tv.key} data-tv-runtime={tv.runtimeType}
        data-tv-scope={tv.scopeType} data-tv-orientation={tv.orientation}>
        <div><small>{tv.runtimeType.replaceAll("_"," ")} · {tv.scopeType}</small><h2>{tv.displayName}</h2><p>{tv.description??"TV runtime"}</p></div>
        <div className={styles.meta}><span>{tv.orientation}</span><span>{tv.targetAspectRatio}</span></div>
        <button type="button" data-tv-action="open-here" disabled={busy!==null} onClick={()=>void open(tv)}>{busy===tv.id?"Đang mở…":station?"Mở tại đây":"Open here"}</button>
      </article>)}
    </section>
  </div>;
}
