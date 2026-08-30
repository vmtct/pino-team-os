"use client";
import {useMemo,useState} from "react";
import bo from "../bo.module.css";
import styles from "./pinoria-wish.module.css";

export type RuleDefinition={
  version:string;rareBaseRate:number;rareHardPity:number;mythicBaseRate:number;mythicSoftPity:number;mythicHardPity:number;
  mythicRateByPity:Array<{pity:number;rate:number}>;featuredMythicRate:number;perfectMemoryRate:number;
  echoByRarity:{COMMON:number;RARE:number;MYTHIC:number};
};
export type RuleVersion={id:string;key:string;displayName:string;status:"DRAFT"|"PUBLISHED"|"RETIRED";definition:RuleDefinition;definitionHash:string|null;version:number};
type Simulation={pullCount:number;counts:{mythic:number;featuredMythic:number;perfectMemory:number};effectiveRates:{rare:number;mythic:number;featuredWithinMythic:number;perfectMemoryWithinFeatured:number};economy:{meanPullsPerMythic:number|null;meanPullsPerFeatured:number|null}};
type Envelope<T>={data?:T;error?:{message?:string}};
type Form={key:string;displayName:string;rareBase:string;rareHard:string;mythicBase:string;soft:string;hard:string;curve:string;featured:string;memory:string;echoCommon:string;echoRare:string;echoMythic:string};

const baseline=():Form=>({key:`pinoria-wish-${Date.now()}`,displayName:"Wish Economy",rareBase:"18",rareHard:"5",mythicBase:"2",soft:"12",hard:"16",curve:"12:8, 13:16, 14:30, 15:55, 16:100",featured:"50",memory:"15",echoCommon:"1",echoRare:"3",echoMythic:"12"});
async function request<T>(path:string,init?:RequestInit){const response=await fetch(`/api/founder/${path}`,{cache:"no-store",...init});const json=await response.json() as Envelope<T>;if(!response.ok||!json.data)throw new Error(json.error?.message??"Wish rule operation failed");return json.data;}
const pct=(value:number)=>`${(value*100).toFixed(value*100%1?1:0)}%`;

export function RuleManager({rules,onChanged}:{rules:RuleVersion[];onChanged:()=>Promise<void>}){
  const[form,setForm]=useState<Form>(baseline),[editing,setEditing]=useState<RuleVersion|null>(null),[busy,setBusy]=useState(""),[error,setError]=useState(""),[simulation,setSimulation]=useState<Simulation|null>(null);
  const published=useMemo(()=>rules.filter(rule=>rule.status==="PUBLISHED"),[rules]);
  function field<K extends keyof Form>(key:K,value:Form[K]){setForm(current=>({...current,[key]:value}));setSimulation(null);}
  function edit(rule:RuleVersion){const d=rule.definition;setEditing(rule);setForm({key:rule.key,displayName:rule.displayName,rareBase:String(d.rareBaseRate*100),rareHard:String(d.rareHardPity),mythicBase:String(d.mythicBaseRate*100),soft:String(d.mythicSoftPity),hard:String(d.mythicHardPity),curve:d.mythicRateByPity.map(x=>`${x.pity}:${x.rate*100}`).join(", "),featured:String(d.featuredMythicRate*100),memory:String(d.perfectMemoryRate*100),echoCommon:String(d.echoByRarity.COMMON),echoRare:String(d.echoByRarity.RARE),echoMythic:String(d.echoByRarity.MYTHIC)});setSimulation(null);}
  function reset(){setEditing(null);setForm(baseline());setSimulation(null);setError("");}
  function definition(){
    const curve=form.curve.split(",").map(part=>part.trim()).filter(Boolean).map(part=>{const[pity,rate]=part.split(":").map(Number);if(!Number.isSafeInteger(pity)||!Number.isFinite(rate))throw new Error("Curve phải theo dạng 12:8, 13:16...");return{pity,rate:rate/100};});
    return{rareBaseRate:Number(form.rareBase)/100,rareHardPity:Number(form.rareHard),mythicBaseRate:Number(form.mythicBase)/100,mythicSoftPity:Number(form.soft),mythicHardPity:Number(form.hard),mythicRateByPity:curve,featuredMythicRate:Number(form.featured)/100,perfectMemoryRate:Number(form.memory)/100,echoByRarity:{COMMON:Number(form.echoCommon),RARE:Number(form.echoRare),MYTHIC:Number(form.echoMythic)}};
  }
  async function save(){setBusy("save");setError("");try{const body=editing?{expectedVersion:editing.version,displayName:form.displayName,definition:definition()}:{key:form.key,displayName:form.displayName,definition:definition()};await request(editing?`pinoria/wish/rules/${editing.id}`:"pinoria/wish/rules",{method:editing?"PATCH":"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});reset();await onChanged();}catch(cause){setError(cause instanceof Error?cause.message:"Không lưu được rule");}finally{setBusy("");}}
  async function simulate(rule:RuleVersion){setBusy(`${rule.id}:simulate`);setError("");try{const result=await request<{simulation:Simulation}>(`pinoria/wish/rules/${rule.id}/simulate`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({pullCount:50000,seed:20260830})});setSimulation(result.simulation);}catch(cause){setError(cause instanceof Error?cause.message:"Không simulate được");}finally{setBusy("");}}
  async function lifecycle(rule:RuleVersion,action:"publish"|"retire"){setBusy(`${rule.id}:${action}`);setError("");try{await request(`pinoria/wish/rules/${rule.id}/${action}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({expectedVersion:rule.version})});if(editing?.id===rule.id)reset();await onChanged();}catch(cause){setError(cause instanceof Error?cause.message:"Rule lifecycle failed");}finally{setBusy("");}}
  return <section className={bo.panel}>
    <div className={bo.panelHeading}><div><h2>Wish Economy Rules</h2><p>Mỗi bản publish là immutable. Muốn đổi ratio/pity, tạo version mới rồi gắn banner vào version đó.</p></div><span className={bo.writePill}>{published.length} PUBLISHED</span></div>
    {error?<div className={`${bo.card} ${bo.denied}`}><strong>Lỗi</strong><span>{error}</span></div>:null}
    {editing?<div className={styles.editNotice}><span>Đang sửa draft <strong>{editing.key}</strong></span><button className={bo.secondaryButton} onClick={reset}>Hủy</button></div>:null}
    <div className={styles.ruleGrid}>
      <label className={bo.field}>Rule key<input disabled={!!editing} value={form.key} onChange={e=>field("key",e.target.value)}/></label>
      <label className={bo.field}>Tên version<input value={form.displayName} onChange={e=>field("displayName",e.target.value)}/></label>
      <label className={bo.field}>Rare base %<input type="number" step="0.1" value={form.rareBase} onChange={e=>field("rareBase",e.target.value)}/></label>
      <label className={bo.field}>Rare hard pity<input type="number" value={form.rareHard} onChange={e=>field("rareHard",e.target.value)}/></label>
      <label className={bo.field}>Mythic base %<input type="number" step="0.1" value={form.mythicBase} onChange={e=>field("mythicBase",e.target.value)}/></label>
      <label className={bo.field}>Mythic soft pity<input type="number" value={form.soft} onChange={e=>field("soft",e.target.value)}/></label>
      <label className={bo.field}>Mythic hard pity<input type="number" value={form.hard} onChange={e=>field("hard",e.target.value)}/></label>
      <label className={bo.field}>Featured Mythic %<input type="number" step="0.1" value={form.featured} onChange={e=>field("featured",e.target.value)}/></label>
      <label className={bo.field}>Perfect Memory %<input type="number" step="0.1" value={form.memory} onChange={e=>field("memory",e.target.value)}/></label>
      <label className={`${bo.field} ${styles.full}`}>Soft pity curve<input value={form.curve} onChange={e=>field("curve",e.target.value)} placeholder="12:8, 13:16, 14:30, 15:55, 16:100"/></label>
      <label className={bo.field}>Echo Common<input type="number" value={form.echoCommon} onChange={e=>field("echoCommon",e.target.value)}/></label>
      <label className={bo.field}>Echo Rare<input type="number" value={form.echoRare} onChange={e=>field("echoRare",e.target.value)}/></label>
      <label className={bo.field}>Echo Mythic<input type="number" value={form.echoMythic} onChange={e=>field("echoMythic",e.target.value)}/></label>
    </div>
    <div className={bo.commandBar}><div><strong>{editing?"Sửa draft economy":"Tạo economy version mới"}</strong><span>Rate dùng %, Core lưu xác suất 0–1. Published version không sửa trực tiếp.</span></div><button className={bo.primaryButton} disabled={!!busy} onClick={()=>void save()}>{busy==="save"?"Đang lưu…":editing?"Lưu Draft":"Tạo Rule Draft"}</button></div>
    {simulation?<div className={styles.simulation}><strong>Simulation · {simulation.pullCount.toLocaleString("vi-VN")} pulls</strong><span>Mythic {pct(simulation.effectiveRates.mythic)} · Rare {pct(simulation.effectiveRates.rare)} · Featured/Mythic {pct(simulation.effectiveRates.featuredWithinMythic)}</span><span>TB 1 Mythic / {simulation.economy.meanPullsPerMythic?.toFixed(1)??"—"} pulls · 1 Featured / {simulation.economy.meanPullsPerFeatured?.toFixed(1)??"—"}</span></div>:null}
    <div className={styles.ruleList}>{rules.map(rule=><article className={styles.ruleCard} key={rule.id}>
      <div><span className={bo.statusPill}>{rule.status}</span><strong>{rule.displayName}</strong><code>{rule.key}</code></div>
      <div className={styles.ruleStats}><span>Rare {pct(rule.definition.rareBaseRate)} / P{rule.definition.rareHardPity}</span><span>Mythic {pct(rule.definition.mythicBaseRate)} / P{rule.definition.mythicSoftPity}→{rule.definition.mythicHardPity}</span><span>Featured {pct(rule.definition.featuredMythicRate)}</span><span>Memory {pct(rule.definition.perfectMemoryRate)}</span></div>
      <div className={styles.actions}><button className={bo.secondaryButton} disabled={!!busy} onClick={()=>void simulate(rule)}>Simulate 50k</button>{rule.status==="DRAFT"?<button className={bo.secondaryButton} disabled={!!busy} onClick={()=>edit(rule)}>Edit</button>:null}{rule.status==="DRAFT"?<button className={bo.primaryButton} disabled={!!busy} onClick={()=>void lifecycle(rule,"publish")}>Publish</button>:null}{rule.status==="PUBLISHED"?<button className={bo.secondaryButton} disabled={!!busy} onClick={()=>void lifecycle(rule,"retire")}>Retire</button>:null}</div>
      {rule.definitionHash?<small className={styles.hash}>rule snapshot {rule.definitionHash}</small>:null}
    </article>)}</div>
  </section>;
}
