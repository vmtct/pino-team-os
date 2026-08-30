"use client";
import { useEffect, useMemo, useState } from "react";
import bo from "../bo.module.css";
import styles from "./pinoria-wish.module.css";
import {CatalogManager} from "./CatalogManager";
import {RuleManager,type RuleVersion} from "./RuleManager";

type Bearer={id:string;key:string;displayName:string;title:string;status:string};
type SetRow={id:string;key:string;bearerId:string;displayName:string;status:string};
type Wearable={id:string;key:string;displayName:string;slot:string;rarity:"COMMON"|"RARE"|"MYTHIC";setId:string|null;status:string;metadata:unknown};
type Variant={id:string;wearableId:string;key:string;displayName:string;status:string};
type Catalog={bearers:Bearer[];sets:SetRow[];wearables:Wearable[];variants:Variant[]};
type Banner={id:string;key:string;familyKey:string;bearerId:string;signatureSetId:string;rulesVersion:string;status:"DRAFT"|"SCHEDULED"|"ACTIVE"|"RETIRED";startsAt:string;endsAt:string;displayName:string;storyHook:string;heroAssetKey:string;regionKey:string;presentation?:{profileKey:string;themeKey:string;backgroundAssetKey:string|null;vfxProfileKey:string|null;musicAssetKey:string|null}|null;definitionHash:string|null;version:number};
type Envelope<T>={data?:T;error?:{message?:string}};
type FormState={bannerKey:string;displayName:string;storyHook:string;heroAssetKey:string;regionKey:string;bearerId:string;signatureSetId:string;rulesVersion:string;offBannerId:string;rareId:string;commonId:string;startsAt:string;endsAt:string;profileKey:string;themeKey:string;backgroundAssetKey:string;vfxProfileKey:string;musicAssetKey:string};

function localValue(date:Date){const offset=date.getTimezoneOffset()*60000;return new Date(date.getTime()-offset).toISOString().slice(0,16);}
function initialForm():FormState{const start=new Date(Date.now()-5*60_000),end=new Date(Date.now()+30*86400_000);return{bannerKey:`aerin-${Date.now()}`,displayName:"Dư Âm của Aerin",storyHook:"Aerin vẫn nhớ lối về.",heroAssetKey:"pinoria/wish/aerin/hero/v001",regionKey:"sky-garden",bearerId:"",signatureSetId:"",rulesVersion:"",offBannerId:"",rareId:"",commonId:"",startsAt:localValue(start),endsAt:localValue(end),profileKey:"wish-reveal-v1",themeKey:"aerin-sky",backgroundAssetKey:"",vfxProfileKey:"sky-memory-v1",musicAssetKey:""};}

async function request<T>(path:string,init?:RequestInit){const response=await fetch(`/api/founder/${path}`,{cache:"no-store",...init});const json=await response.json() as Envelope<T>;if(!response.ok||!json.data)throw new Error(json.error?.message??"BO operation failed");return json.data;}
export function WishBoView(){
  const[catalog,setCatalog]=useState<Catalog|null>(null),[banners,setBanners]=useState<Banner[]>([]),[rules,setRules]=useState<RuleVersion[]>([]),[form,setForm]=useState<FormState>(initialForm),[busy,setBusy]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState("");
  const sets=useMemo(()=>catalog?.sets.filter(item=>item.bearerId===form.bearerId&&item.status==="ACTIVE")??[],[catalog,form.bearerId]);
  const offBanner=useMemo(()=>catalog?.wearables.filter(item=>item.rarity==="MYTHIC"&&item.setId===null&&item.status==="ACTIVE")??[],[catalog]);
  const rare=useMemo(()=>catalog?.wearables.filter(item=>item.rarity==="RARE"&&item.status==="ACTIVE")??[],[catalog]);
  const common=useMemo(()=>catalog?.wearables.filter(item=>item.rarity==="COMMON"&&item.status==="ACTIVE")??[],[catalog]);
  async function load(){setError("");try{const[c,b,r]=await Promise.all([request<Catalog>("pinoria/wish/catalog"),request<Banner[]>("pinoria/wish/banners"),request<RuleVersion[]>("pinoria/wish/rules")]);setCatalog(c);setBanners(b);setRules(r);setForm(current=>{const bearerId=current.bearerId||c.bearers.find(item=>item.status==="ACTIVE")?.id||"";const signatureSetId=current.signatureSetId||c.sets.find(item=>item.bearerId===bearerId&&item.status==="ACTIVE")?.id||"";const rulesVersion=r.some(rule=>rule.status==="PUBLISHED"&&rule.key===current.rulesVersion)?current.rulesVersion:r.find(rule=>rule.status==="PUBLISHED")?.key||"";return{...current,bearerId,signatureSetId,rulesVersion,offBannerId:current.offBannerId||c.wearables.find(item=>item.rarity==="MYTHIC"&&item.setId===null&&item.status==="ACTIVE")?.id||"",rareId:current.rareId||c.wearables.find(item=>item.rarity==="RARE"&&item.status==="ACTIVE")?.id||"",commonId:current.commonId||c.wearables.find(item=>item.rarity==="COMMON"&&item.status==="ACTIVE")?.id||""};});}catch(cause){setError(cause instanceof Error?cause.message:"Không tải được Wish BO");}}
  useEffect(()=>{void load();},[]);
  function field<K extends keyof FormState>(key:K,value:FormState[K]){setForm(current=>({...current,[key]:value}));if(key==="bearerId"&&catalog){const signatureSetId=catalog.sets.find(item=>item.bearerId===value&&item.status==="ACTIVE")?.id||"";setForm(current=>({...current,bearerId:String(value),signatureSetId}));}}
  async function createBanner(){
    setBusy("create");setError("");setMessage("");
    try{const body={bannerKey:form.bannerKey,familyKey:"LIMITED_WARDROBE",bearerId:form.bearerId,signatureSetId:form.signatureSetId,rulesVersion:form.rulesVersion,startsAt:new Date(form.startsAt).toISOString(),endsAt:new Date(form.endsAt).toISOString(),displayName:form.displayName,storyHook:form.storyHook,heroAssetKey:form.heroAssetKey,regionKey:form.regionKey,presentation:{profileKey:form.profileKey,themeKey:form.themeKey,backgroundAssetKey:form.backgroundAssetKey||null,vfxProfileKey:form.vfxProfileKey||null,musicAssetKey:form.musicAssetKey||null},pools:{offBannerMythic:[{wearableId:form.offBannerId}],rare:[{wearableId:form.rareId}],common:[{wearableId:form.commonId}]}};
      const banner=await request<Banner>("pinoria/wish/banners",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});setMessage(`Đã tạo draft ${banner.displayName}`);setBanners(current=>[banner,...current]);setForm(initialForm());await load();
    }catch(cause){setError(cause instanceof Error?cause.message:"Không tạo được banner");}finally{setBusy("");}
  }
  async function lifecycle(banner:Banner,action:"schedule"|"activate"|"retire"){
    setBusy(`${banner.id}:${action}`);setError("");setMessage("");
    try{const updated=await request<Banner>(`pinoria/wish/banners/${banner.id}/${action}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({expectedVersion:banner.version})});setMessage(`${updated.displayName}: ${updated.status}`);await load();}
    catch(cause){setError(cause instanceof Error?cause.message:"Lifecycle command failed");}finally{setBusy("");}
  }
  async function validate(banner:Banner){setBusy(`${banner.id}:validate`);setError("");setMessage("");try{const result=await request<{valid:boolean;issues:string[];definitionHash:string|null}>(`pinoria/wish/banners/${banner.id}/validation`);setMessage(result.valid?`Validation PASS · ${result.definitionHash?.slice(0,12)}`:`Validation FAIL · ${result.issues.join(" · ")}`);}catch(cause){setError(cause instanceof Error?cause.message:"Validation failed");}finally{setBusy("");}}
  if(!catalog&&!error)return <div className={bo.state}><strong>Đang tải Pinoria Wish BO…</strong><span>Đọc catalog và banner từ pino-core staging.</span></div>;
  return <div className={bo.page}>
    <header className={bo.heading}><span>PINORIA · STAGING CONFIG</span><h1>Wish / Hạt Năng Lượng</h1><p>Config banner từ canonical catalog, validate snapshot, rồi schedule/activate. TOS và TV chỉ đọc state đã publish từ Core.</p></header>
    <section className={bo.metrics}>
      <div className={bo.metric}><span>Bearers</span><strong>{catalog?.bearers.length??0}</strong></div>
      <div className={bo.metric}><span>Wearables</span><strong>{catalog?.wearables.length??0}</strong></div>
      <div className={bo.metric}><span>Banners</span><strong>{banners.length}</strong></div>
      <div className={bo.metric}><span>Active</span><strong>{banners.filter(item=>item.status==="ACTIVE").length}</strong></div>
    </section>
    {error?<div className={`${bo.card} ${bo.denied}`}><strong>Lỗi</strong><span>{error}</span></div>:null}
    {message?<div className={bo.successCard}><span>Pinoria BO</span><strong>{message}</strong></div>:null}
    <CatalogManager onChanged={()=>void load()}/>
    <RuleManager rules={rules} onChanged={load}/>
    <section className={bo.panel}>
      <div className={bo.panelHeading}><div><h2>Tạo Wish banner</h2><p>Không nhập UUID tay — chọn từ catalog hiện có.</p></div><span className={bo.writePill}>STAGING WRITE</span></div>
      <div className={bo.formGrid}>
        <label className={bo.field}>Banner key<input value={form.bannerKey} onChange={event=>field("bannerKey",event.target.value)}/></label>
        <label className={bo.field}>Tên banner<input value={form.displayName} onChange={event=>field("displayName",event.target.value)}/></label>
        <label className={bo.field}>Original Bearer<select value={form.bearerId} onChange={event=>field("bearerId",event.target.value)}>{catalog?.bearers.filter(item=>item.status==="ACTIVE").map(item=><option key={item.id} value={item.id}>{item.displayName} · {item.title}</option>)}</select></label>
        <label className={bo.field}>Signature set<select value={form.signatureSetId} onChange={event=>field("signatureSetId",event.target.value)}>{sets.map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
        <label className={bo.field}>Economy rule<select value={form.rulesVersion} onChange={event=>field("rulesVersion",event.target.value)}>{rules.filter(rule=>rule.status==="PUBLISHED").map(rule=><option key={rule.id} value={rule.key}>{rule.displayName} · {rule.key}</option>)}</select></label>
        <label className={bo.field}>Off-banner Mythic<select value={form.offBannerId} onChange={event=>field("offBannerId",event.target.value)}>{offBanner.map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
        <label className={bo.field}>Rare pool<select value={form.rareId} onChange={event=>field("rareId",event.target.value)}>{rare.map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
        <label className={bo.field}>Common pool<select value={form.commonId} onChange={event=>field("commonId",event.target.value)}>{common.map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
        <label className={bo.field}>Region key<input value={form.regionKey} onChange={event=>field("regionKey",event.target.value)}/></label>
        <label className={bo.field}>TV profile<input value={form.profileKey} onChange={event=>field("profileKey",event.target.value)}/></label>
        <label className={bo.field}>Theme key<input value={form.themeKey} onChange={event=>field("themeKey",event.target.value)}/></label>
        <label className={bo.field}>VFX profile<input value={form.vfxProfileKey} onChange={event=>field("vfxProfileKey",event.target.value)}/></label>
        <label className={bo.field}>Background asset<input value={form.backgroundAssetKey} onChange={event=>field("backgroundAssetKey",event.target.value)} placeholder="optional"/></label>
        <label className={bo.field}>Music asset<input value={form.musicAssetKey} onChange={event=>field("musicAssetKey",event.target.value)} placeholder="optional"/></label>
        <label className={bo.field}>Bắt đầu<input type="datetime-local" value={form.startsAt} onChange={event=>field("startsAt",event.target.value)}/></label>
        <label className={bo.field}>Kết thúc<input type="datetime-local" value={form.endsAt} onChange={event=>field("endsAt",event.target.value)}/></label>
        <label className={`${bo.field} ${styles.full}`}>Story hook<input value={form.storyHook} onChange={event=>field("storyHook",event.target.value)}/></label>
        <label className={`${bo.field} ${styles.full}`}>Hero asset key<input value={form.heroAssetKey} onChange={event=>field("heroAssetKey",event.target.value)}/></label>
      </div>
      <div className={bo.commandBar}><div><strong>Rules: {form.rulesVersion||"chưa chọn"}</strong><span>Banner snapshot khóa rule version đã publish; đổi economy bằng version mới, không sửa draw cũ.</span></div><button className={bo.primaryButton} disabled={!!busy||!form.bearerId||!form.signatureSetId||!form.rulesVersion||!form.offBannerId||!form.rareId||!form.commonId} onClick={()=>void createBanner()}>{busy==="create"?"Đang tạo…":"Tạo Draft"}</button></div>
    </section>
    <section className={bo.panel}>
      <div className={bo.panelHeading}><div><h2>Banner lifecycle</h2><p>Draft → validate → scheduled → active → retired.</p></div><button className={bo.secondaryButton} onClick={()=>void load()}>Refresh</button></div>
      <div className={styles.bannerList}>{banners.length===0?<div className={bo.empty}>Chưa có banner nào.</div>:banners.map(banner=><article className={styles.bannerCard} key={banner.id}>
        <div className={styles.bannerHead}><div><span className={bo.statusPill}>{banner.status}</span><h3>{banner.displayName}</h3><p>{banner.storyHook}</p></div><code>{banner.key}</code></div>
        <div className={styles.bannerMeta}><span>{new Date(banner.startsAt).toLocaleString("vi-VN")}</span><span>→</span><span>{new Date(banner.endsAt).toLocaleString("vi-VN")}</span><span>v{banner.version}</span><span>{banner.presentation?.profileKey ?? "legacy visual"}</span><span>{banner.presentation?.themeKey ?? "default"}</span></div>
        <div className={styles.actions}>
          {banner.status==="DRAFT"?<button className={bo.secondaryButton} disabled={!!busy} onClick={()=>void validate(banner)}>Validate</button>:null}
          {banner.status==="DRAFT"?<button className={bo.primaryButton} disabled={!!busy} onClick={()=>void lifecycle(banner,"schedule")}>Schedule</button>:null}
          {banner.status==="SCHEDULED"?<button className={bo.primaryButton} disabled={!!busy} onClick={()=>void lifecycle(banner,"activate")}>Activate</button>:null}
          {banner.status==="SCHEDULED"||banner.status==="ACTIVE"?<button className={bo.secondaryButton} disabled={!!busy} onClick={()=>void lifecycle(banner,"retire")}>Retire</button>:null}
        </div>
        {banner.definitionHash?<small className={styles.hash}>snapshot {banner.definitionHash}</small>:null}
      </article>)}</div>
    </section>
  </div>;
}
