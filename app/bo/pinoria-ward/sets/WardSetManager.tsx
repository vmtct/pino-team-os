"use client";

import {useEffect,useMemo,useState} from "react";
import Image from "next/image";
import {pinoriaAssetUrl} from "@/app/pinoria-tv/layered-character";
import styles from "./ward-set.module.css";

type Status="DRAFT"|"ACTIVE"|"ARCHIVED";
type Member={variantId:string;sortOrder:number;variantName:string;itemId:string;itemName:string;slot:string;renderMode:string;assetKey:string|null;renderMetadata:Record<string,unknown>;variantStatus:string};
type WardSet={id:string;key:string;displayName:string;webmAssetKey:string|null;status:Status;version:number;memberCount:number;members:Member[]};
type SetCatalog={sets:WardSet[]};
type Variant={id:string;wearableId:string;displayName:string;status:Status;renderMode:string;assetKey:string|null;renderMetadata:Record<string,unknown>};
type Item={id:string;displayName:string;slot:string;status:Status};
type WearableCatalog={items:Item[];variants:Variant[]};
type WebmAsset={objectKey:string;byteSize:number;uploadedAt:string};
type Envelope<T>={data?:T;error?:{message?:string}};

async function request<T>(path:string,init?:RequestInit){const response=await fetch(`/api/bo/${path}`,{cache:"no-store",...init});const json=await response.json() as Envelope<T>;if(!response.ok||!json.data)throw new Error(json.error?.message??"Ward Set operation failed");return json.data;}
export function WardSetManager(){
  const[catalog,setCatalog]=useState<SetCatalog>({sets:[]}),[wearables,setWearables]=useState<WearableCatalog>({items:[],variants:[]}),[assets,setAssets]=useState<WebmAsset[]>([]);
  const[selectedId,setSelectedId]=useState<string|null>(null),[query,setQuery]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const[displayName,setDisplayName]=useState(""),[webmAssetKey,setWebmAssetKey]=useState(""),[memberIds,setMemberIds]=useState<string[]>([]);

  async function load(){
    try{const[setsResult,wearableResult,assetResult]=await Promise.all([request<SetCatalog>("pinoria/ward/sets"),request<WearableCatalog>("pinoria/ward/catalog"),request<{assets:WebmAsset[]}>("pinoria/ward/set-webm-assets")]);setCatalog(setsResult);setWearables(wearableResult);setAssets(assetResult.assets);setError("");}
    catch(cause){setError(cause instanceof Error?cause.message:"Không tải được Ward Sets");}
  }
  useEffect(()=>{void load();},[]);
  const selected=catalog.sets.find(set=>set.id===selectedId)??null;
  const activeVariants=useMemo(()=>wearables.variants.filter(variant=>variant.status==="ACTIVE").map(variant=>({variant,item:wearables.items.find(item=>item.id===variant.wearableId)})).filter(row=>row.item?.status==="ACTIVE"),[wearables]);
  const filtered=useMemo(()=>catalog.sets.filter(set=>!query||`${set.displayName} ${set.key}`.toLowerCase().includes(query.toLowerCase())),[catalog.sets,query]);
  function openSet(set:WardSet){setSelectedId(set.id);setDisplayName(set.displayName);setWebmAssetKey(set.webmAssetKey??"");setMemberIds(set.members.map(member=>member.variantId));setMessage("");setError("");}
  async function createSet(){setBusy(true);try{await request("pinoria/ward/sets",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:`ward-set-${Date.now()}`,displayName:"Untitled set"})});setMessage("Đã tạo Set draft");await load();}catch(cause){setError(cause instanceof Error?cause.message:"Không tạo được Set");}finally{setBusy(false);}}
  async function save(status:Status){if(!selected)return;setBusy(true);setError("");try{let version=selected.version;const original=selected.members.map(member=>member.variantId);const changed=original.length!==memberIds.length||original.some((id,index)=>id!==memberIds[index]);if(changed){await request(`pinoria/ward/sets/${selected.id}/members`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({expectedVersion:version,variantIds:memberIds})});version+=1;}await request(`pinoria/ward/sets/${selected.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({expectedVersion:version,displayName,webmAssetKey:webmAssetKey||null,status})});setMessage(status==="ACTIVE"?"Set đã publish":"Set đã lưu");await load();}catch(cause){setError(cause instanceof Error?cause.message:"Không lưu được Set");}finally{setBusy(false);}}
  async function upload(file:File){setBusy(true);setError("");try{const form=new FormData();form.set("file",file);const result=await request<{objectKey:string}>("pinoria/ward/set-webm-assets",{method:"POST",headers:{"idempotency-key":crypto.randomUUID()},body:form});setWebmAssetKey(result.objectKey);setMessage("WEBM đã upload lên R2");await load();}catch(cause){setError(cause instanceof Error?cause.message:"Upload WEBM thất bại");}finally{setBusy(false);}}
  const previewMembers=selected?.members.filter(member=>memberIds.includes(member.variantId))??[];
  const previewLayers=memberIds.map(id=>activeVariants.find(row=>row.variant.id===id)).filter((row):row is NonNullable<typeof row>=>Boolean(row));
  return <main className={styles.shell}>
    <header className={styles.topbar}><div><p className={styles.eyebrow}>PNR-WARD · F1-SET</p><h1>Wearable Sets</h1></div><button className={styles.create} disabled={busy} onClick={()=>void createSet()}>＋ New set</button></header>
    <section className={styles.toolbar}><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search set…"/></section>
    {error?<div className={styles.notice}>{error}</div>:null}{message?<div className={styles.notice}>{message}</div>:null}
    <section className={styles.catalogPage}>
      <div className={styles.listHead}><span>Set</span><span>Members</span><span>WEBM</span><span>Status</span></div>
      <div>{filtered.map(set=><button key={set.id} className={styles.row} onClick={()=>openSet(set)}><span className={styles.itemCell}><i className={styles.thumb}>◫</i><b>{set.displayName}</b><small>{set.key}</small></span><span>{set.memberCount}</span><span>{set.webmAssetKey?"Configured":"Missing"}</span><span><i className={styles.status} data-status={set.status}>{set.status}</i></span></button>)}</div>
    </section>
    {selected&&<div className={styles.backdrop} onClick={()=>setSelectedId(null)}/>} 
    {selected&&<aside className={styles.peek}>
      <div className={styles.peekTop}><button onClick={()=>setSelectedId(null)}>✕</button><span>Set detail</span><button>•••</button></div>
      <div className={styles.detailHead}><div><p>{selected.key}</p><h2>{selected.displayName}</h2></div><span className={styles.status} data-status={selected.status}>{selected.status}</span></div>
      <div className={styles.peekBody}>
        <label className={styles.field}>Set name<input value={displayName} disabled={selected.status!=="DRAFT"} onChange={event=>setDisplayName(event.target.value)}/></label>
        <section className={styles.section}><div className={styles.sectionHead}><h3>Members</h3><small>Reference ACTIVE F0 variants only</small></div>
          <div className={styles.memberPicker}>{activeVariants.map(({variant,item})=><label key={variant.id}><input type="checkbox" disabled={selected.status!=="DRAFT"} checked={memberIds.includes(variant.id)} onChange={event=>setMemberIds(ids=>event.target.checked?[...ids,variant.id]:ids.filter(id=>id!==variant.id))}/><span><b>{item?.displayName}</b><small>{item?.slot} · {variant.displayName}</small></span></label>)}</div>
        </section>
        <section className={styles.section}><div className={styles.sectionHead}><h3>Fallback preview</h3><small>Stacked live from F0 layers</small></div>
          <div className={styles.stackPreview}>{previewLayers.length?previewLayers.sort((a,b)=>Number(a.variant.renderMetadata.zIndex??0)-Number(b.variant.renderMetadata.zIndex??0)).map(({variant})=>{const src=pinoriaAssetUrl(variant.assetKey);return src?<Image key={variant.id} src={src} alt="" fill sizes="720px" unoptimized draggable={false}/>:null;}):<span>No members selected</span>}</div>
        </section>
        <section className={styles.section}><div className={styles.sectionHead}><h3>Synthesized WEBM</h3><small>R2 asset</small></div>
          <label className={styles.field}>Choose from R2<select disabled={selected.status!=="DRAFT"} value={webmAssetKey} onChange={event=>setWebmAssetKey(event.target.value)}><option value="">No WEBM selected</option>{assets.map(asset=><option key={asset.objectKey} value={asset.objectKey}>{asset.objectKey}</option>)}</select></label>
          <label className={styles.upload}>Upload WEBM<input type="file" accept="video/webm,.webm" disabled={busy||selected.status!=="DRAFT"} onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file);}}/></label>
          <div className={styles.assetKey}>{webmAssetKey||"No WEBM selected"}</div>
        </section>
      </div>
      <footer className={styles.actions}>{selected.status==="DRAFT"?<><button className={styles.secondary} disabled={busy} onClick={()=>void save("DRAFT")}>Save draft</button><button className={styles.publish} disabled={busy} onClick={()=>void save("ACTIVE")}>Validate & publish</button></>:selected.status==="ACTIVE"?<button className={styles.secondary} disabled={busy} onClick={()=>void save("ARCHIVED")}>Archive</button>:null}</footer>
    </aside>}
  </main>;
}
