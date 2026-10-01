"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "../bo.module.css";
type Tv={id:string;key:string;displayName:string;description:string|null;runtimeType:string;scopeType:"GLOBAL"|"CENTER";scopeId:string|null;centerName:string|null;orientation:"LANDSCAPE"|"PORTRAIT";targetAspectRatio:string;definitionVersion:number;status:string};
type Device={id:string;key:string;displayName:string;centerId:string|null;centerName:string|null;status:string;defaultDisplayId:string|null;defaultDisplayName:string|null;lastSeenAt:string|null;actualOrientation:string|null;viewportWidth:number|null;viewportHeight:number|null};
export function TvManagementView(){
 const [tvs,setTvs]=useState<Tv[]>([]),[devices,setDevices]=useState<Device[]>([]),[tab,setTab]=useState<"TVS"|"DEVICES">("TVS"),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [form,setForm]=useState({key:"",displayName:"",centerId:"",defaultDisplayId:""});
 const centers=useMemo(()=>Array.from(new Map(tvs.filter(x=>x.scopeType==="CENTER"&&x.scopeId).map(x=>[x.scopeId!,x.centerName??x.scopeId!])).entries()),[tvs]);
 async function load(){setError("");try{const [a,b]=await Promise.all([fetch("/api/bo/tv/displays",{cache:"no-store"}),fetch("/api/bo/tv/devices",{cache:"no-store"})]);const ja=await a.json() as {data?:Tv[];error?:{message?:string}},jb=await b.json() as {data?:Device[];error?:{message?:string}};if(!a.ok)throw new Error(ja.error?.message??"Không tải được TVs.");if(!b.ok)throw new Error(jb.error?.message??"Không tải được devices.");setTvs(ja.data??[]);setDevices(jb.data??[]);}catch(cause){setError(cause instanceof Error?cause.message:"Không tải được TV platform.");}}
 useEffect(()=>{void load();},[]);
 async function register(){setBusy(true);setError("");try{const r=await fetch("/api/bo/tv/devices",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:form.key,displayName:form.displayName,centerId:form.centerId||null,defaultDisplayId:form.defaultDisplayId||null})});const j=await r.json() as {error?:{message?:string}};if(!r.ok)throw new Error(j.error?.message??"Không đăng ký được device.");setForm({key:"",displayName:"",centerId:"",defaultDisplayId:""});await load();}catch(cause){setError(cause instanceof Error?cause.message:"Không đăng ký được device.");}finally{setBusy(false);}}
 return <div className={styles.page}>
  <div className={styles.panelHeading}><div><span>TV PLATFORM</span><h1>TVs</h1><p>TV definitions được provision bằng code; BO chỉ đọc contract và quản lý display devices.</p></div></div>
  <div className={styles.tabs}><button className={tab==="TVS"?styles.tabActive:""} onClick={()=>setTab("TVS")}>TVs</button><button className={tab==="DEVICES"?styles.tabActive:""} onClick={()=>setTab("DEVICES")}>Devices</button></div>
  {error?<div className={styles.reviewBanner}><strong>Error</strong><span>{error}</span></div>:null}
  {tab==="TVS"?<div className={styles.staffAssignmentList}>{tvs.map(tv=><article className={styles.staffAssignmentCard} key={tv.id} data-bo-tv-key={tv.key}><div style={{flex:1}}><strong>{tv.displayName}</strong><small>{tv.runtimeType} · {tv.scopeType}{tv.centerName?` · ${tv.centerName}`:""} · {tv.orientation} {tv.targetAspectRatio} · definition v{tv.definitionVersion}</small><p>{tv.description}</p></div><span>{tv.status}</span></article>)}</div>:<>
   <div className={styles.formGrid}>
    <label className={styles.field}>Device key<input value={form.key} onChange={e=>setForm({...form,key:e.target.value})}/></label>
    <label className={styles.field}>Display name<input value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})}/></label>
    <label className={styles.field}>Center<select value={form.centerId} onChange={e=>setForm({...form,centerId:e.target.value,defaultDisplayId:""})}><option value="">Global / unassigned</option>{centers.map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label>
    <label className={styles.field}>Default TV<select value={form.defaultDisplayId} onChange={e=>setForm({...form,defaultDisplayId:e.target.value})}><option value="">None</option>{tvs.filter(tv=>tv.scopeType==="GLOBAL"||tv.scopeId===form.centerId).map(tv=><option value={tv.id} key={tv.id}>{tv.displayName}</option>)}</select></label>
   </div><div className={styles.staffActions}><button className={styles.primaryButton} disabled={busy||!form.key||!form.displayName} onClick={()=>void register()}>{busy?"Saving…":"Register device"}</button></div>
   <div className={styles.staffAssignmentList}>{devices.map(device=><article className={styles.staffAssignmentCard} key={device.id}><div style={{flex:1}}><strong>{device.displayName}</strong><small>{device.key} · {device.centerName??"Global/unassigned"} · {device.defaultDisplayName??"No default TV"}</small><p>{device.actualOrientation?`${device.actualOrientation} · ${device.viewportWidth}×${device.viewportHeight}`:"Viewport not reported"} · last seen {device.lastSeenAt??"never"}</p></div><span>{device.status}</span></article>)}</div>
  </>}
 </div>;
}
