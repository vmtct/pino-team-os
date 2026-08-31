"use client";

import { useEffect, useMemo, useState } from "react";
import bo from "../bo.module.css";
import styles from "./pinoria-wish.module.css";

type PhaseStatus = "DRAFT" | "PUBLISHED" | "RETIRED";
type ReleaseRole = "NEW" | "RERUN" | "SEASONAL";
type Rule = { id:string; key:string; displayName:string; status:"DRAFT"|"PUBLISHED"|"RETIRED"; definitionHash:string|null; version:number };
type Banner = { id:string; key:string; displayName:string; status:"DRAFT"|"SCHEDULED"|"ACTIVE"|"RETIRED"; version:number };
type Slot = { bannerId:string; bannerKey:string; displayName:string|null; featuredSlot:number|null; releaseRole:ReleaseRole|null; status:string };
type Phase = { id:string; key:string; familyKey:string; status:PhaseStatus; startsAt:string; endsAt:string; rulesVersion:string; rulesHash:string; maxFeaturedSlots:number; version:number; createdAt:string; updatedAt:string; publishedAt:string|null; retiredAt:string|null; slots?:Slot[] };
type Envelope<T> = { data?:T; error?:{message?:string} };
type Form = { phaseKey:string; startsAt:string; endsAt:string; rulesVersion:string };

function localValue(date:Date){const offset=date.getTimezoneOffset()*60000;return new Date(date.getTime()-offset).toISOString().slice(0,16);}
function initialForm():Form { const start=new Date(Date.now()+5*60_000),end=new Date(Date.now()+28*86400_000); return {phaseKey:`wardrobe-${Date.now()}`,startsAt:localValue(start),endsAt:localValue(end),rulesVersion:""}; }
async function request<T>(path:string,init?:RequestInit){const response=await fetch(`/api/founder/${path}`,{cache:"no-store",...init});const json=await response.json() as Envelope<T>;if(!response.ok||!json.data)throw new Error(json.error?.message??"Wish release phase operation failed");return json.data;}

export function ReleasePhaseManager({onChanged}:{onChanged:()=>void}) {
  const[phases,setPhases]=useState<Phase[]>([]),[rules,setRules]=useState<Rule[]>([]),[banners,setBanners]=useState<Banner[]>([]),[form,setForm]=useState<Form>(initialForm),[editing,setEditing]=useState<Phase|null>(null),[busy,setBusy]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState("");
  const publishedRules=useMemo(()=>rules.filter(rule=>rule.status==="PUBLISHED"&&rule.definitionHash),[rules]);
  const draftBanners=useMemo(()=>banners.filter(banner=>banner.status==="DRAFT"),[banners]);
  async function load(){setError("");try{const[p,r,b]=await Promise.all([request<Phase[]>("pinoria/wish/release-phases"),request<Rule[]>("pinoria/wish/rules"),request<Banner[]>("pinoria/wish/banners")]);const detailed=await Promise.all(p.map(phase=>request<Phase>(`pinoria/wish/release-phases/${phase.id}`)));setPhases(detailed);setRules(r);setBanners(b);setForm(current=>({...current,rulesVersion:r.some(rule=>rule.status==="PUBLISHED"&&rule.definitionHash&&rule.key===current.rulesVersion)?current.rulesVersion:r.find(rule=>rule.status==="PUBLISHED"&&rule.definitionHash)?.key||""}));}catch(cause){setError(cause instanceof Error?cause.message:"Không tải được release phases");}}
  useEffect(()=>{void load();},[]);
  function field<K extends keyof Form>(key:K,value:Form[K]){setForm(current=>({...current,[key]:value}));}
  function beginEdit(phase:Phase){setEditing(phase);setForm({phaseKey:phase.key,startsAt:localValue(new Date(phase.startsAt)),endsAt:localValue(new Date(phase.endsAt)),rulesVersion:phase.rulesVersion});setMessage("");setError("");}
  function reset(){setEditing(null);setForm(initialForm());setForm(current=>({...current,rulesVersion:publishedRules[0]?.key||""}));}
  async function save(){setBusy("save");setError("");setMessage("");try{const body={familyKey:"LIMITED_WARDROBE",startsAt:new Date(form.startsAt).toISOString(),endsAt:new Date(form.endsAt).toISOString(),rulesVersion:form.rulesVersion,maxFeaturedSlots:2};const phase=editing?await request<Phase>(`pinoria/wish/release-phases/${editing.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({...body,expectedVersion:editing.version})}):await request<Phase>("pinoria/wish/release-phases",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({phaseKey:form.phaseKey,...body})});setMessage(`${editing?"Đã cập nhật":"Đã tạo"} phase ${phase.key}`);reset();await load();onChanged();}catch(cause){setError(cause instanceof Error?cause.message:"Không lưu được release phase");}finally{setBusy("");}}
  async function validate(phase:Phase){setBusy(`${phase.id}:validate`);setError("");try{const result=await request<{valid:boolean;issues:string[]}>(`pinoria/wish/release-phases/${phase.id}/validation`);setMessage(result.valid?`${phase.key}: validation PASS`:`${phase.key}: ${result.issues.join(" · ")}`);}catch(cause){setError(cause instanceof Error?cause.message:"Validation failed");}finally{setBusy("");}}
  async function lifecycle(phase:Phase,action:"publish"|"retire"){setBusy(`${phase.id}:${action}`);setError("");try{const updated=await request<Phase>(`pinoria/wish/release-phases/${phase.id}/${action}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({expectedVersion:phase.version})});setMessage(`${updated.key}: ${updated.status}`);await load();onChanged();}catch(cause){setError(cause instanceof Error?cause.message:"Release phase lifecycle failed");}finally{setBusy("");}}
  async function assign(phase:Phase,bannerId:string,featuredSlot:number,releaseRole:ReleaseRole){const banner=draftBanners.find(item=>item.id===bannerId);if(!banner)return;setBusy(`${phase.id}:assign:${featuredSlot}`);setError("");try{await request<Phase>(`pinoria/wish/release-phases/${phase.id}/assign`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({bannerId,expectedBannerVersion:banner.version,featuredSlot,releaseRole})});setMessage(`${phase.key}: assigned slot ${featuredSlot}`);await load();onChanged();}catch(cause){setError(cause instanceof Error?cause.message:"Assign banner failed");}finally{setBusy("");}}
  return <section className={bo.panel}>
    <div className={bo.panelHeading}><div><h2>Wish Release Phases</h2><p>Phase là authority của family, window và exact economy rule. LIMITED_WARDROBE luôn có đúng 2 featured slots.</p></div><span className={bo.writePill}>0058 AUTHORITY</span></div>
    {error?<div className={`${bo.card} ${bo.denied}`}><strong>Lỗi release phase</strong><span>{error}</span></div>:null}
    {message?<div className={bo.successCard}><span>Release Phase</span><strong>{message}</strong></div>:null}
    <div className={styles.phaseForm}>
      <label className={bo.field}>Phase key<input disabled={!!editing} value={form.phaseKey} onChange={e=>field("phaseKey",e.target.value)}/></label>
      <label className={bo.field}>Published economy rule<select value={form.rulesVersion} onChange={e=>field("rulesVersion",e.target.value)}>{publishedRules.map(rule=><option key={rule.id} value={rule.key}>{rule.displayName} · {rule.key}</option>)}</select></label>
      <label className={bo.field}>Bắt đầu<input type="datetime-local" value={form.startsAt} onChange={e=>field("startsAt",e.target.value)}/></label>
      <label className={bo.field}>Kết thúc<input type="datetime-local" value={form.endsAt} onChange={e=>field("endsAt",e.target.value)}/></label>
    </div>
    <div className={bo.commandBar}><div><strong>{editing?`Sửa draft ${editing.key}`:"Tạo 2-slot LIMITED_WARDROBE phase"}</strong><span>Publish phase trước, rồi assign banner DRAFT vào slot 1/2. Assignment sẽ inherit family/window/rule từ phase.</span></div><div className={styles.actions}>{editing?<button className={bo.secondaryButton} onClick={reset}>Hủy</button>:null}<button className={bo.primaryButton} disabled={!!busy||!form.phaseKey||!form.rulesVersion} onClick={()=>void save()}>{busy==="save"?"Đang lưu…":editing?"Lưu Draft":"Tạo Phase Draft"}</button></div></div>
    <div className={styles.phaseList}>{phases.length===0?<div className={bo.empty}>Chưa có release phase.</div>:phases.map(phase=><PhaseCard key={phase.id} phase={phase} draftBanners={draftBanners} busy={busy} onEdit={beginEdit} onValidate={validate} onLifecycle={lifecycle} onAssign={assign}/>)}</div>
  </section>;
}

function PhaseCard({phase,draftBanners,busy,onEdit,onValidate,onLifecycle,onAssign}:{phase:Phase;draftBanners:Banner[];busy:string;onEdit:(phase:Phase)=>void;onValidate:(phase:Phase)=>Promise<void>;onLifecycle:(phase:Phase,action:"publish"|"retire")=>Promise<void>;onAssign:(phase:Phase,bannerId:string,slot:number,role:ReleaseRole)=>Promise<void>}){
 const[selection,setSelection]=useState<Record<number,{bannerId:string;role:ReleaseRole}>>({1:{bannerId:"",role:"NEW"},2:{bannerId:"",role:"RERUN"}});
 const slots=phase.slots??[]; const occupied=new Map(slots.map(slot=>[slot.featuredSlot,slot]));
 function choose(slot:number,key:"bannerId"|"role",value:string){setSelection(current=>({...current,[slot]:{...current[slot]!,[key]:value}}));}
 return <article className={styles.phaseCard}>
  <div className={styles.bannerHead}><div><span className={bo.statusPill}>{phase.status}</span><h3>{phase.key}</h3><p>{phase.familyKey} · exact rule {phase.rulesVersion}</p></div><code>v{phase.version} · {phase.rulesHash.slice(0,12)}</code></div>
  <div className={styles.bannerMeta}><span>{new Date(phase.startsAt).toLocaleString("vi-VN")}</span><span>→</span><span>{new Date(phase.endsAt).toLocaleString("vi-VN")}</span><span>{slots.length}/{phase.maxFeaturedSlots} slots</span></div>
  <div className={styles.phaseSlots}>{[1,2].map(slot=>{const current=occupied.get(slot);const choice=selection[slot]!;return <div className={styles.phaseSlot} key={slot}><strong>Featured Slot {slot}</strong>{current?<><span>{current.displayName??current.bannerKey}</span><small>{current.releaseRole} · {current.status}</small></>:phase.status==="PUBLISHED"?<><select value={choice.bannerId} onChange={e=>choose(slot,"bannerId",e.target.value)}><option value="">Chọn DRAFT banner</option>{draftBanners.map(banner=><option key={banner.id} value={banner.id}>{banner.displayName} · v{banner.version}</option>)}</select><select value={choice.role} onChange={e=>choose(slot,"role",e.target.value)}><option>NEW</option><option>RERUN</option><option>SEASONAL</option></select><button className={bo.primaryButton} disabled={!!busy||!choice.bannerId} onClick={()=>void onAssign(phase,choice.bannerId,slot,choice.role)}>Assign slot {slot}</button></>:<small>Publish phase để assign.</small>}</div>})}</div>
  <div className={styles.actions}>{phase.status==="DRAFT"?<button className={bo.secondaryButton} disabled={!!busy} onClick={()=>onEdit(phase)}>Edit</button>:null}{phase.status==="DRAFT"?<button className={bo.secondaryButton} disabled={!!busy} onClick={()=>void onValidate(phase)}>Validate</button>:null}{phase.status==="DRAFT"?<button className={bo.primaryButton} disabled={!!busy} onClick={()=>void onLifecycle(phase,"publish")}>Publish</button>:null}{phase.status==="PUBLISHED"?<button className={bo.secondaryButton} disabled={!!busy} onClick={()=>void onLifecycle(phase,"retire")}>Retire Phase</button>:null}</div>
 </article>;
}