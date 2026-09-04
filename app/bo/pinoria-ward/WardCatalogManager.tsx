"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./pinoria-ward.module.css";

type Status="DRAFT"|"ACTIVE"|"ARCHIVED";
type Gender="ALL"|"FEMALE"|"MALE";
type ItemType="WEARABLE"|"ACCESSORY";
type WearableKind="STANDARD"|"AURA_BACK"|"AURA_GROUND"|"PATH_MARK";
type Slot="HEAD/HAIR"|"FACE"|"HEADWEAR"|"OUTFIT"|"BACK"|"AURA_BACK"|"AURA_GROUND"|"PATH_MARK";
type Mode="LAYER"|"STANDALONE"|"WEBM";
type Item={id:string;key:string;displayName:string;descriptionText:string;itemType:ItemType;wearableKind:WearableKind|null;slot:Slot|null;collectionKey:string|null;seasonKey:string|null;gender:Gender;rarityStars:number;tags:string[];status:Status;version:number;defaultVariantId:string|null;variantCount:number;wishBannerCount:number;ownerCount:number};
type Variant={id:string;wearableId:string;key:string;displayName:string;renderMode:Mode;assetKey:string|null;posterAssetKey:string|null;renderMetadata:Record<string,unknown>;assetRevision:string|null;assetChecksum:string|null;status:Status;version:number};
type Catalog={items:Item[];variants:Variant[]};
type Envelope<T>={data?:T;error?:{message?:string}};
type Tab="OVERVIEW"|"VARIANTS"|"PREVIEW"|"USAGE";
type Calibration={offsetX:number;offsetY:number;scale:number;rotation:number;zIndex:number;baseOpacity:number;baseVisible:boolean};
const DEFAULT_CAL:Calibration={offsetX:0,offsetY:0,scale:1,rotation:0,zIndex:60,baseOpacity:.32,baseVisible:true};

const stars=(value:number)=>"⭐️".repeat(Math.max(1,Math.min(5,value)));
function readCalibration(metadata:Record<string,unknown>):Calibration{const transform=(metadata.transform??{}) as Record<string,unknown>,layer=(metadata.layer??{}) as Record<string,unknown>;return{...DEFAULT_CAL,offsetX:Number(transform.offsetX??0),offsetY:Number(transform.offsetY??0),scale:Number(transform.scale??1),rotation:Number(transform.rotation??0),zIndex:Number(layer.zIndex??60)};}

async function request<T>(path:string,init?:RequestInit){
  const response=await fetch(`/api/bo/${path}`,{cache:"no-store",...init});
  const json=await response.json() as Envelope<T>;
  if(!response.ok||!json.data)throw new Error(json.error?.message??"Ward catalog operation failed");
  return json.data;
}
export function WardCatalogManager(){
  const[catalog,setCatalog]=useState<Catalog>({items:[],variants:[]});
  const[selectedId,setSelectedId]=useState<string|null>(null),[selectedVariantId,setSelectedVariantId]=useState<string|null>(null),[query,setQuery]=useState(""),[typeFilter,setTypeFilter]=useState("ALL"),[kindFilter,setKindFilter]=useState("ALL"),[slot,setSlot]=useState("ALL"),[tab,setTab]=useState<Tab>("OVERVIEW");
  const[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const[form,setForm]=useState({displayName:"",descriptionText:"",itemType:"WEARABLE" as ItemType,wearableKind:"STANDARD" as WearableKind|null,slot:"HEADWEAR" as Slot|null,collectionKey:"",seasonKey:"",gender:"ALL" as Gender,rarityStars:3,tags:""});
  const[variantForm,setVariantForm]=useState({displayName:"",renderMode:"LAYER" as Mode,assetKey:"",posterAssetKey:"",assetRevision:"",assetChecksum:""});
  const[calibration,setCalibration]=useState<Calibration>(DEFAULT_CAL);
  const[previewAssetUrl,setPreviewAssetUrl]=useState("");

  async function load(){
    try{const data=await request<Catalog>("pinoria/ward/catalog");setCatalog(data);setError("");}
    catch(cause){setError(cause instanceof Error?cause.message:"Không tải được Ward catalog");}
  }
  useEffect(()=>{void load();},[]);
  const selected=catalog.items.find(item=>item.id===selectedId)??null;
  const selectedVariants=selected?catalog.variants.filter(variant=>variant.wearableId===selected.id):[];
  const filtered=useMemo(()=>catalog.items.filter(item=>{
    const q=query.trim().toLowerCase();
    return(!q||`${item.displayName} ${item.key} ${item.collectionKey??""}`.toLowerCase().includes(q))&&(typeFilter==="ALL"||item.itemType===typeFilter)&&(kindFilter==="ALL"||item.wearableKind===kindFilter)&&(slot==="ALL"||item.slot===slot);
  }),[catalog.items,query,typeFilter,kindFilter,slot]);
  function openItem(item:Item){
    setSelectedId(item.id);setTab("OVERVIEW");setMessage("");setError("");
    setForm({displayName:item.displayName,descriptionText:item.descriptionText,itemType:item.itemType,wearableKind:item.wearableKind,slot:item.slot,collectionKey:item.collectionKey??"",seasonKey:item.seasonKey??"",gender:item.gender,rarityStars:item.rarityStars,tags:item.tags.join(", ")});
    const variant=catalog.variants.find(entry=>entry.id===item.defaultVariantId)??catalog.variants.find(entry=>entry.wearableId===item.id);
    if(variant){setSelectedVariantId(variant.id);setVariantForm({displayName:variant.displayName,renderMode:variant.renderMode,assetKey:variant.assetKey??"",posterAssetKey:variant.posterAssetKey??"",assetRevision:variant.assetRevision??"",assetChecksum:variant.assetChecksum??""});setCalibration(readCalibration(variant.renderMetadata));setPreviewAssetUrl("");}
  }
  async function mutate(path:string,method:"POST"|"PATCH",body:unknown,label:string){
    setBusy(true);setError("");setMessage("");
    try{await request(path,{method,headers:{"content-type":"application/json"},body:JSON.stringify(body)});setMessage(label);await load();}
    catch(cause){setError(cause instanceof Error?cause.message:"Ward catalog operation failed");}
    finally{setBusy(false);}
  }
  async function saveItem(status:Status){
    if(!selected)return;
    const defaultVariantId=selected.defaultVariantId??selectedVariants.find(v=>v.status==="ACTIVE")?.id??null;
    await mutate(`pinoria/ward/catalog/items/${selected.id}`,"PATCH",{expectedVersion:selected.version,displayName:form.displayName,descriptionText:form.descriptionText,itemType:form.itemType,wearableKind:form.itemType==="ACCESSORY"?null:form.wearableKind,slot:form.itemType==="ACCESSORY"?null:form.wearableKind==="STANDARD"?form.slot:form.wearableKind,collectionKey:form.collectionKey||null,seasonKey:form.seasonKey||null,gender:form.gender,rarityStars:Number(form.rarityStars),tags:form.tags.split(",").map(v=>v.trim()).filter(Boolean),metadata:{},status,defaultVariantId},status==="ACTIVE"?"Item đã publish":"Item đã lưu");
  }
  async function createItem(){
    const key=`ward-${Date.now()}`;
    await mutate("pinoria/ward/catalog/items","POST",{key,displayName:"Untitled item",descriptionText:"",itemType:"WEARABLE",wearableKind:"STANDARD",slot:"HEADWEAR",collectionKey:null,seasonKey:null,gender:"ALL",rarityStars:3,tags:[],metadata:{}},"Đã tạo item draft");
  }
  async function createVariant(){
    if(!selected)return;
    const key=`${selected.key}-v${selectedVariants.length+1}`;
    await mutate("pinoria/ward/catalog/variants","POST",{key,wearableId:selected.id,displayName:`${selected.displayName} Variant ${selectedVariants.length+1}`,renderMode:"LAYER",assetKey:null,posterAssetKey:null,renderMetadata:{},assetRevision:null,assetChecksum:null,metadata:{}},"Đã tạo variant draft");
  }
  async function saveVariant(variant:Variant,status:Status){
    await mutate(`pinoria/ward/catalog/variants/${variant.id}`,"PATCH",{expectedVersion:variant.version,displayName:variantForm.displayName||variant.displayName,renderMode:variantForm.renderMode,assetKey:variantForm.assetKey||null,posterAssetKey:variantForm.posterAssetKey||null,renderMetadata:{...(variant.renderMetadata??{}),transform:{offsetX:calibration.offsetX,offsetY:calibration.offsetY,scale:calibration.scale,rotation:calibration.rotation},layer:{zIndex:calibration.zIndex}},assetRevision:variantForm.assetRevision||null,assetChecksum:variantForm.assetChecksum||null,metadata:{},status},status==="ACTIVE"?"Variant đã publish":"Variant đã lưu");
  }

  return <main className={styles.shell}>
    <header className={styles.topbar}><div><p className={styles.eyebrow}>PINORIA · BACK OFFICE</p><h1>Ward Catalog</h1></div><button className={styles.create} disabled={busy} onClick={()=>void createItem()}>＋ New item</button></header>
    <section className={styles.toolbar}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search item, code, collection…"/><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="ALL">All types</option><option value="WEARABLE">Wearable</option><option value="ACCESSORY">Accessory</option></select><select value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option value="ALL">All wearable kinds</option><option value="STANDARD">Standard</option><option value="AURA_BACK">Aura Back</option><option value="AURA_GROUND">Aura Ground</option><option value="PATH_MARK">Path Mark</option></select><select value={slot} onChange={e=>setSlot(e.target.value)}><option value="ALL">All slots</option><option>HEAD/HAIR</option><option>FACE</option><option>HEADWEAR</option><option>OUTFIT</option><option>BACK</option><option>AURA_BACK</option><option>AURA_GROUND</option><option>PATH_MARK</option></select></section>
    {error?<div className={styles.advancedBox}>{error}</div>:null}{message?<div className={styles.statusStrip}><b>{message}</b></div>:null}
    <section className={styles.catalogPage}>
      <div className={styles.listHead}><span>Item</span><span>Type / Kind</span><span>Slot</span><span>Gender</span><span>Rarity</span><span>Variants</span><span>Status</span><span>Collection</span></div>
      <div className={styles.rows}>{filtered.map(item=><button key={item.id} className={styles.row} onClick={()=>openItem(item)}>
        <span className={styles.itemCell}><i className={styles.thumb}>✦</i><b>{item.displayName}</b><small>{item.key}</small></span>
        <span><b>{item.itemType}</b><small>{item.wearableKind?` · ${item.wearableKind.replaceAll("_"," ")}`:""}</small></span><span>{item.slot??"—"}</span><span>{item.gender}</span><span>{stars(item.rarityStars)}</span><span>{item.variantCount}</span>
        <span><i className={styles.status} data-status={item.status}>{item.status}</i></span><span>{item.collectionKey??"—"}</span>
      </button>)}</div>
    </section>

    {selected&&<div className={styles.backdrop} onClick={()=>setSelectedId(null)}/>} 
    {selected&&<aside className={styles.peek}>
      <div className={styles.peekTop}><button onClick={()=>setSelectedId(null)}>✕</button><span>Ward catalog side peek</span><button>•••</button></div>
      <div className={styles.detailHead}><div><p>{selected.key}</p><h2>{selected.displayName}</h2><small>{selected.gender} · {stars(selected.rarityStars)}</small></div><span className={styles.slotBadge}>{selected.itemType==="ACCESSORY"?"ACCESSORY":selected.wearableKind==="STANDARD"?selected.slot:selected.wearableKind?.replaceAll("_"," ")}</span></div>
      <nav className={styles.tabs}>{(["OVERVIEW","VARIANTS","PREVIEW","USAGE"] as Tab[]).map(name=><button key={name} onClick={()=>setTab(name)} className={tab===name?styles.tabActive:""}>{name}</button>)}</nav>
      <div className={styles.peekBody}>
        {tab==="OVERVIEW"&&<div className={styles.formGrid}>
          <label>Name<input value={form.displayName} onChange={e=>setForm(v=>({...v,displayName:e.target.value}))}/></label>
          <label>Code<input value={selected.key} disabled/></label>
          <label>Type<select value={form.itemType} onChange={e=>{const itemType=e.target.value as ItemType;setForm(v=>({...v,itemType,wearableKind:itemType==="ACCESSORY"?null:(v.wearableKind??"STANDARD"),slot:itemType==="ACCESSORY"?null:(v.wearableKind&&v.wearableKind!=="STANDARD"?v.wearableKind:(v.slot??"HEADWEAR"))}));}}><option value="WEARABLE">Wearable</option><option value="ACCESSORY">Accessory</option></select></label>{form.itemType==="WEARABLE"?<label>Wearable kind<select value={form.wearableKind??"STANDARD"} onChange={e=>{const wearableKind=e.target.value as WearableKind;setForm(v=>({...v,wearableKind,slot:wearableKind==="STANDARD"?(v.slot&&!["AURA_BACK","AURA_GROUND","PATH_MARK"].includes(v.slot)?v.slot:"HEADWEAR"):wearableKind}));}}><option value="STANDARD">Standard</option><option value="AURA_BACK">Aura Back</option><option value="AURA_GROUND">Aura Ground</option><option value="PATH_MARK">Path Mark</option></select></label>:null}{form.itemType==="WEARABLE"&&form.wearableKind==="STANDARD"?<label>Slot<select value={form.slot??"HEADWEAR"} onChange={e=>setForm(v=>({...v,slot:e.target.value as Slot}))}><option>HEAD/HAIR</option><option>FACE</option><option>HEADWEAR</option><option>OUTFIT</option><option>BACK</option></select></label>:null}
          <label>Collection<input value={form.collectionKey} onChange={e=>setForm(v=>({...v,collectionKey:e.target.value}))}/></label>
          <label>Gender<select value={form.gender} onChange={e=>setForm(v=>({...v,gender:e.target.value as Gender}))}><option value="ALL">All</option><option value="FEMALE">Female</option><option value="MALE">Male</option></select></label>
          <label>Rarity<select value={form.rarityStars} onChange={e=>setForm(v=>({...v,rarityStars:Number(e.target.value)}))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{stars(n)}</option>)}</select></label>
          <label>Season<input value={form.seasonKey} onChange={e=>setForm(v=>({...v,seasonKey:e.target.value}))}/></label>
          <label>Tags<input value={form.tags} onChange={e=>setForm(v=>({...v,tags:e.target.value}))} placeholder="seasonal, moon"/></label>
          <label className={styles.full}>Description<textarea value={form.descriptionText} onChange={e=>setForm(v=>({...v,descriptionText:e.target.value}))}/></label>
          <div className={styles.statusStrip}><span>Lifecycle</span><b>{selected.status}</b>{selected.status!=="ARCHIVED"?<button disabled={busy} onClick={()=>void saveItem("ARCHIVED")}>Archive</button>:null}</div>
        </div>}
        {tab==="VARIANTS"&&<div className={styles.variantLayout}>
          <div className={styles.variantList}>{selectedVariants.map((variant,index)=><button key={variant.id} onClick={()=>{setSelectedVariantId(variant.id);setVariantForm({displayName:variant.displayName,renderMode:variant.renderMode,assetKey:variant.assetKey??"",posterAssetKey:variant.posterAssetKey??"",assetRevision:variant.assetRevision??"",assetChecksum:variant.assetChecksum??""});setCalibration(readCalibration(variant.renderMetadata));setPreviewAssetUrl("");}}><span>{String(index+1).padStart(2,"0")}</span><div><b>{variant.displayName}</b><small>{variant.status} · {variant.renderMode}</small></div></button>)}<button className={styles.addVariant} onClick={()=>void createVariant()}>＋ Add variant</button></div>
          <div className={styles.editor}>
            <div className={styles.modeSwitch}>{(["LAYER","STANDALONE","WEBM"] as Mode[]).map(mode=><button key={mode} onClick={()=>setVariantForm(v=>({...v,renderMode:mode}))} className={variantForm.renderMode===mode?styles.modeActive:""}>{mode}</button>)}</div>
            <label>Name<input value={variantForm.displayName} onChange={e=>setVariantForm(v=>({...v,displayName:e.target.value}))}/></label>
            <label>Asset<input value={variantForm.assetKey} onChange={e=>setVariantForm(v=>({...v,assetKey:e.target.value}))}/></label>
            {variantForm.renderMode==="WEBM"?<label>Poster<input value={variantForm.posterAssetKey} onChange={e=>setVariantForm(v=>({...v,posterAssetKey:e.target.value}))}/></label>:null}
            <label>Revision<input value={variantForm.assetRevision} onChange={e=>setVariantForm(v=>({...v,assetRevision:e.target.value}))}/></label>
            <label>Checksum<input value={variantForm.assetChecksum} onChange={e=>setVariantForm(v=>({...v,assetChecksum:e.target.value}))}/></label>
            {selectedVariants.find(v=>v.id===selectedVariantId)?<div className={styles.statusStrip}><button disabled={busy} onClick={()=>void saveVariant(selectedVariants.find(v=>v.id===selectedVariantId)!,"DRAFT")}>Save variant</button><button disabled={busy} onClick={()=>void saveVariant(selectedVariants.find(v=>v.id===selectedVariantId)!,"ACTIVE")}>Publish variant</button></div>:null}
          </div>
        </div>}
        {(tab==="PREVIEW"||tab==="VARIANTS")&&<section className={styles.calibrationCard}>
          <div className={styles.previewTop}><span>Asset calibration</span><small>{selected.slot??"ACCESSORY"} · {variantForm.renderMode}</small></div>
          <div className={styles.assetIngest}><div><b>Preview asset</b><small>PNG / JPEG / WebP local preview. Canonical persistence remains assetKey + render metadata.</small></div><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(previewAssetUrl.startsWith("blob:"))URL.revokeObjectURL(previewAssetUrl);setPreviewAssetUrl(URL.createObjectURL(file));}}/></div>
          <div className={styles.calibrationWorkspace}>
            <div className={styles.previewColumn}><div className={styles.calibrationStage}>{variantForm.renderMode!=="STANDALONE"&&calibration.baseVisible?<div className={styles.baseCharacter} style={{opacity:calibration.baseOpacity}}/>:null}{previewAssetUrl?<div className={styles.calibrationAsset} style={{backgroundImage:`url(${previewAssetUrl})`,transform:`translate(calc(-50% + ${calibration.offsetX}px), calc(-50% + ${calibration.offsetY}px)) scale(${calibration.scale}) rotate(${calibration.rotation}deg)`}}/>:null}</div>{variantForm.renderMode==="STANDALONE"?<small className={styles.modeHint}>Base character hidden in Standalone mode.</small>:<div className={styles.baseControls}><button type="button" onClick={()=>setCalibration(v=>({...v,baseVisible:!v.baseVisible}))}>{calibration.baseVisible?"Hide base":"Show base"}</button><label>Base opacity<input type="range" min="0" max="0.7" step="0.02" value={calibration.baseOpacity} onChange={e=>setCalibration(v=>({...v,baseOpacity:Number(e.target.value)}))}/><span>{Math.round(calibration.baseOpacity*100)}%</span></label></div>}</div>
            <div className={styles.calibrationControls}>{([["Offset X","offsetX",-160,160,1,"px"],["Offset Y","offsetY",-160,160,1,"px"],["Scale","scale",.2,2.5,.05,"×"],["Rotation","rotation",-180,180,1,"°"],["Z-index","zIndex",0,100,1,""]] as const).map(([label,key,min,max,step,suffix])=><label key={key}><span>{label}</span><input type="range" min={min} max={max} step={step} value={calibration[key]} onChange={e=>setCalibration(v=>({...v,[key]:Number(e.target.value)}))}/><small>{calibration[key]}{suffix}</small></label>)}<label><span>Slot</span><input value={selected.slot??"ACCESSORY"} disabled/></label><div className={styles.calibrationActions}><button type="button" onClick={()=>setCalibration(v=>({...DEFAULT_CAL,baseOpacity:v.baseOpacity,baseVisible:v.baseVisible}))}>Reset calibration</button></div></div>
          </div>
          <pre className={styles.renderMeta}>{JSON.stringify({slot:selected.slot,renderMode:variantForm.renderMode,transform:{offsetX:calibration.offsetX,offsetY:calibration.offsetY,scale:calibration.scale,rotation:calibration.rotation},layer:{zIndex:calibration.zIndex}},null,2)}</pre>
        </section>}
        {tab==="USAGE"&&<div className={styles.usage}><div><b>{selected.wishBannerCount}</b><span>Wish banners</span></div><div><b>{selected.variantCount}</b><span>Variants</span></div><div><b>{selected.ownerCount}</b><span>Learner owners</span></div></div>}
      </div>
      <footer className={styles.actions}><button className={styles.secondary} disabled={busy||selected.status==="ARCHIVED"} onClick={()=>void saveItem(selected.status==="ACTIVE"?"ACTIVE":"DRAFT")}>{selected.status==="ACTIVE"?"Save changes":"Save draft"}</button><button className={styles.publish} disabled={busy||selected.status==="ARCHIVED"} onClick={()=>void saveItem("ACTIVE")}>Validate & publish</button></footer>
    </aside>}
  </main>;
}
