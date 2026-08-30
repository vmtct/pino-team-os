"use client";
import {useEffect,useMemo,useState} from "react";
import bo from "../bo.module.css";
import styles from "./pinoria-wish.module.css";

type Status="DRAFT"|"ACTIVE"|"ARCHIVED";
type Bearer={id:string;key:string;displayName:string;title:string;status:Status;version:number;loreText:string;regionKey:string;heroAssetKey:string;metadata:Record<string,unknown>};
type SetRow={id:string;key:string;bearerId:string;displayName:string;status:Status;version:number;descriptionText:string;metadata:Record<string,unknown>};
type Wearable={id:string;key:string;displayName:string;slot:"HEADWEAR"|"WINGS"|"OUTFIT";rarity:"COMMON"|"RARE"|"MYTHIC";setId:string|null;status:Status;version:number;metadata:Record<string,unknown>};
type Variant={id:string;key:string;wearableId:string;displayName:string;status:Status;version:number;metadata:Record<string,unknown>};
type Catalog={bearers:Bearer[];sets:SetRow[];wearables:Wearable[];variants:Variant[]};
type Envelope<T>={data?:T;error?:{message?:string}};
type Edit={kind:"bearer"|"set"|"wearable"|"variant";id:string;version:number;status:Status}|null;

async function request<T>(path:string,init?:RequestInit){
 const response=await fetch(`/api/founder/${path}`,{cache:"no-store",...init});
 const json=await response.json() as Envelope<T>;
 if(!response.ok||!json.data)throw new Error(json.error?.message??"Catalog operation failed");
 return json.data;
}
const layer=(metadata:Record<string,unknown>)=>typeof metadata.layerAssetKey==="string"?metadata.layerAssetKey:"";
export function CatalogManager({onChanged}:{onChanged:()=>void}){
 const[catalog,setCatalog]=useState<Catalog|null>(null),[busy,setBusy]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState(""),[edit,setEdit]=useState<Edit>(null);
 const[bearer,setBearer]=useState({key:"",displayName:"",title:"",loreText:"",regionKey:"",heroAssetKey:""});
 const[setForm,setSetForm]=useState({key:"",bearerId:"",displayName:"",descriptionText:""});
 const[wearable,setWearable]=useState({key:"",displayName:"",slot:"HEADWEAR" as Wearable["slot"],rarity:"MYTHIC" as Wearable["rarity"],setId:"",layerAssetKey:""});
 const[variant,setVariant]=useState({key:"",wearableId:"",displayName:"",layerAssetKey:""});
 const activeBearers=useMemo(()=>catalog?.bearers.filter(x=>x.status==="ACTIVE")??[],[catalog]);
 const activeSets=useMemo(()=>catalog?.sets.filter(x=>x.status==="ACTIVE")??[],[catalog]);
 const activeWearables=useMemo(()=>catalog?.wearables.filter(x=>x.status==="ACTIVE")??[],[catalog]);
 async function load(){try{const data=await request<Catalog>("pinoria/wish/catalog");setCatalog(data);setSetForm(x=>({...x,bearerId:x.bearerId||data.bearers.find(b=>b.status==="ACTIVE")?.id||""}));setVariant(x=>({...x,wearableId:x.wearableId||data.wearables.find(w=>w.status==="ACTIVE")?.id||""}));}catch(cause){setError(cause instanceof Error?cause.message:"Không tải được catalog");}}
 useEffect(()=>{void load();},[]);
 function done(text:string){setMessage(text);setError("");setEdit(null);void load();onChanged();}
 async function command(path:string,body:unknown,label:string,method:"POST"|"PATCH"){setBusy(label);setError("");try{await request(path,{method,headers:{"content-type":"application/json"},body:JSON.stringify(body)});done(label);}catch(cause){setError(cause instanceof Error?cause.message:"Catalog command failed");}finally{setBusy("");}}
 async function saveBearer(){
  const editing=edit?.kind==="bearer"?edit:null;
  const current=editing?catalog?.bearers.find(x=>x.id===editing.id):null;
  const body={...bearer,metadata:current?.metadata??{},...(editing?{expectedVersion:editing.version,status:editing.status}:{})};
  await command(`pinoria/wish/catalog/bearers${editing?`/${editing.id}`:""}`,body,editing?"Đã cập nhật Bearer":"Đã tạo Bearer",editing?"PATCH":"POST");
  if(!editing)setBearer({key:"",displayName:"",title:"",loreText:"",regionKey:"",heroAssetKey:""});
 }
 async function saveSet(){
  const editing=edit?.kind==="set"?edit:null;
  const current=editing?catalog?.sets.find(x=>x.id===editing.id):null;
  const body={...setForm,metadata:current?.metadata??{},...(editing?{expectedVersion:editing.version,status:editing.status}:{})};
  await command(`pinoria/wish/catalog/sets${editing?`/${editing.id}`:""}`,body,editing?"Đã cập nhật Set":"Đã tạo Set",editing?"PATCH":"POST");
  if(!editing)setSetForm(x=>({...x,key:"",displayName:"",descriptionText:""}));
 }
 async function saveWearable(){
  const editing=edit?.kind==="wearable"?edit:null;
  const current=editing?catalog?.wearables.find(x=>x.id===editing.id):null;
  const metadata={...(current?.metadata??{})};if(wearable.layerAssetKey)metadata.layerAssetKey=wearable.layerAssetKey;else delete metadata.layerAssetKey;
  const body={key:wearable.key,displayName:wearable.displayName,slot:wearable.slot,rarity:wearable.rarity,setId:wearable.setId||null,metadata,...(editing?{expectedVersion:editing.version,status:editing.status}:{})};
  await command(`pinoria/wish/catalog/wearables${editing?`/${editing.id}`:""}`,body,editing?"Đã cập nhật Wearable":"Đã tạo Wearable",editing?"PATCH":"POST");
  if(!editing)setWearable(x=>({...x,key:"",displayName:"",layerAssetKey:""}));
 }
 async function saveVariant(){
  const editing=edit?.kind==="variant"?edit:null;
  const current=editing?catalog?.variants.find(x=>x.id===editing.id):null;
  const metadata={...(current?.metadata??{})};if(variant.layerAssetKey)metadata.layerAssetKey=variant.layerAssetKey;else delete metadata.layerAssetKey;
  const body={key:variant.key,wearableId:variant.wearableId,displayName:variant.displayName,metadata,...(editing?{expectedVersion:editing.version,status:editing.status}:{})};
  await command(`pinoria/wish/catalog/variants${editing?`/${editing.id}`:""}`,body,editing?"Đã cập nhật Variant":"Đã tạo Variant",editing?"PATCH":"POST");
  if(!editing)setVariant(x=>({...x,key:"",displayName:"",layerAssetKey:""}));
 }
 function begin(kind:NonNullable<Edit>["kind"],item:Bearer|SetRow|Wearable|Variant){
  setEdit({kind,id:item.id,version:item.version,status:item.status});
  if(kind==="bearer"){const x=item as Bearer;setBearer({key:x.key,displayName:x.displayName,title:x.title,loreText:x.loreText,regionKey:x.regionKey,heroAssetKey:x.heroAssetKey});}
  if(kind==="set"){const x=item as SetRow;setSetForm({key:x.key,bearerId:x.bearerId,displayName:x.displayName,descriptionText:x.descriptionText});}
  if(kind==="wearable"){const x=item as Wearable;setWearable({key:x.key,displayName:x.displayName,slot:x.slot,rarity:x.rarity,setId:x.setId??"",layerAssetKey:layer(x.metadata)});}
  if(kind==="variant"){const x=item as Variant;setVariant({key:x.key,wearableId:x.wearableId,displayName:x.displayName,layerAssetKey:layer(x.metadata)});}
 }
 function cancel(){setEdit(null);setBearer({key:"",displayName:"",title:"",loreText:"",regionKey:"",heroAssetKey:""});setSetForm(x=>({...x,key:"",displayName:"",descriptionText:""}));setWearable(x=>({...x,key:"",displayName:"",layerAssetKey:""}));setVariant(x=>({...x,key:"",displayName:"",layerAssetKey:""}));}
 async function setStatus(kind:NonNullable<Edit>["kind"],item:Bearer|SetRow|Wearable|Variant,status:Status){
  let path="",body:Record<string,unknown>={expectedVersion:item.version,status};
  if(kind==="bearer"){const x=item as Bearer;path=`pinoria/wish/catalog/bearers/${x.id}`;body={...body,displayName:x.displayName,title:x.title,loreText:x.loreText,regionKey:x.regionKey,heroAssetKey:x.heroAssetKey,metadata:x.metadata};}
  if(kind==="set"){const x=item as SetRow;path=`pinoria/wish/catalog/sets/${x.id}`;body={...body,bearerId:x.bearerId,displayName:x.displayName,descriptionText:x.descriptionText,metadata:x.metadata};}
  if(kind==="wearable"){const x=item as Wearable;path=`pinoria/wish/catalog/wearables/${x.id}`;body={...body,displayName:x.displayName,slot:x.slot,rarity:x.rarity,setId:x.setId,metadata:x.metadata};}
  if(kind==="variant"){const x=item as Variant;path=`pinoria/wish/catalog/variants/${x.id}`;body={...body,displayName:x.displayName,metadata:x.metadata};}
  await command(path,body,`${item.key}: ${status}`,"PATCH");
 }
 if(!catalog)return <section className={bo.panel}><div className={bo.state}><strong>Đang tải Wish catalog…</strong></div></section>;
 return <section className={bo.panel}>
  <div className={bo.panelHeading}><div><h2>Wish content catalog</h2><p>Tạo và quản trị Bearer → Set → Wearable → Variant. Không cần SQL hoặc UUID nhập tay.</p></div><span className={bo.writePill}>CONFIG WRITE</span></div>
  {error?<div className={`${bo.card} ${bo.denied}`}><strong>Lỗi catalog</strong><span>{error}</span></div>:null}
  {message?<div className={bo.successCard}><span>Catalog</span><strong>{message}</strong></div>:null}
  {edit?<div className={styles.editNotice}><strong>Đang sửa {edit.kind}</strong><span>v{edit.version} · {edit.status}</span><button className={bo.secondaryButton} onClick={cancel}>Hủy sửa</button></div>:null}
  <div className={styles.catalogForms}>
   <div className={styles.catalogForm}><h3>Original Bearer</h3>
    <label className={bo.field}>Key<input disabled={edit?.kind==="bearer"} value={bearer.key} onChange={e=>setBearer(x=>({...x,key:e.target.value}))}/></label>
    <label className={bo.field}>Tên<input value={bearer.displayName} onChange={e=>setBearer(x=>({...x,displayName:e.target.value}))}/></label>
    <label className={bo.field}>Title<input value={bearer.title} onChange={e=>setBearer(x=>({...x,title:e.target.value}))}/></label>
    <label className={bo.field}>Region<input value={bearer.regionKey} onChange={e=>setBearer(x=>({...x,regionKey:e.target.value}))}/></label>
    <label className={bo.field}>Hero asset<input value={bearer.heroAssetKey} onChange={e=>setBearer(x=>({...x,heroAssetKey:e.target.value}))}/></label>
    <label className={bo.field}>Lore<textarea value={bearer.loreText} onChange={e=>setBearer(x=>({...x,loreText:e.target.value}))}/></label>
    <button className={bo.primaryButton} disabled={!!busy||!bearer.key||!bearer.displayName||!bearer.title} onClick={()=>void saveBearer()}>{edit?.kind==="bearer"?"Lưu Bearer":"Tạo Bearer Draft"}</button>
   </div>
   <div className={styles.catalogForm}><h3>Wearable Set</h3>
    <label className={bo.field}>Key<input disabled={edit?.kind==="set"} value={setForm.key} onChange={e=>setSetForm(x=>({...x,key:e.target.value}))}/></label>
    <label className={bo.field}>Bearer<select value={setForm.bearerId} onChange={e=>setSetForm(x=>({...x,bearerId:e.target.value}))}>{activeBearers.map(x=><option key={x.id} value={x.id}>{x.displayName}</option>)}</select></label>
    <label className={bo.field}>Tên set<input value={setForm.displayName} onChange={e=>setSetForm(x=>({...x,displayName:e.target.value}))}/></label>
    <label className={bo.field}>Mô tả<textarea value={setForm.descriptionText} onChange={e=>setSetForm(x=>({...x,descriptionText:e.target.value}))}/></label>
    <button className={bo.primaryButton} disabled={!!busy||!setForm.key||!setForm.bearerId||!setForm.displayName} onClick={()=>void saveSet()}>{edit?.kind==="set"?"Lưu Set":"Tạo Set Draft"}</button>
   </div>
   <div className={styles.catalogForm}><h3>Wearable</h3>
    <label className={bo.field}>Key<input disabled={edit?.kind==="wearable"} value={wearable.key} onChange={e=>setWearable(x=>({...x,key:e.target.value}))}/></label>
    <label className={bo.field}>Tên<input value={wearable.displayName} onChange={e=>setWearable(x=>({...x,displayName:e.target.value}))}/></label>
    <label className={bo.field}>Slot<select value={wearable.slot} onChange={e=>setWearable(x=>({...x,slot:e.target.value as Wearable["slot"]}))}><option>HEADWEAR</option><option>WINGS</option><option>OUTFIT</option></select></label>
    <label className={bo.field}>Rarity<select value={wearable.rarity} onChange={e=>setWearable(x=>({...x,rarity:e.target.value as Wearable["rarity"]}))}><option>MYTHIC</option><option>RARE</option><option>COMMON</option></select></label>
    <label className={bo.field}>Set<select value={wearable.setId} onChange={e=>setWearable(x=>({...x,setId:e.target.value}))}><option value="">Không thuộc set</option>{activeSets.map(x=><option key={x.id} value={x.id}>{x.displayName}</option>)}</select></label>
    <label className={bo.field}>Layer asset<input value={wearable.layerAssetKey} onChange={e=>setWearable(x=>({...x,layerAssetKey:e.target.value}))}/></label>
    <button className={bo.primaryButton} disabled={!!busy||!wearable.key||!wearable.displayName} onClick={()=>void saveWearable()}>{edit?.kind==="wearable"?"Lưu Wearable":"Tạo Wearable Draft"}</button>
   </div>
   <div className={styles.catalogForm}><h3>Variant</h3>
    <label className={bo.field}>Key<input disabled={edit?.kind==="variant"} value={variant.key} onChange={e=>setVariant(x=>({...x,key:e.target.value}))}/></label>
    <label className={bo.field}>Wearable<select value={variant.wearableId} onChange={e=>setVariant(x=>({...x,wearableId:e.target.value}))}>{activeWearables.map(x=><option key={x.id} value={x.id}>{x.displayName}</option>)}</select></label>
    <label className={bo.field}>Tên<input value={variant.displayName} onChange={e=>setVariant(x=>({...x,displayName:e.target.value}))}/></label>
    <label className={bo.field}>Layer asset<input value={variant.layerAssetKey} onChange={e=>setVariant(x=>({...x,layerAssetKey:e.target.value}))}/></label>
    <button className={bo.primaryButton} disabled={!!busy||!variant.key||!variant.wearableId||!variant.displayName} onClick={()=>void saveVariant()}>{edit?.kind==="variant"?"Lưu Variant":"Tạo Variant Draft"}</button>
   </div>
  </div>
  <div className={styles.catalogLists}>
   <CatalogList title="Bearers" kind="bearer" rows={catalog.bearers} onEdit={begin} onStatus={setStatus}/>
   <CatalogList title="Sets" kind="set" rows={catalog.sets} onEdit={begin} onStatus={setStatus}/>
   <CatalogList title="Wearables" kind="wearable" rows={catalog.wearables} onEdit={begin} onStatus={setStatus}/>
   <CatalogList title="Variants" kind="variant" rows={catalog.variants} onEdit={begin} onStatus={setStatus}/>
  </div>
 </section>;
}
type CatalogRow=Bearer|SetRow|Wearable|Variant;
function CatalogList({title,kind,rows,onEdit,onStatus}:{title:string;kind:NonNullable<Edit>["kind"];rows:CatalogRow[];onEdit:(kind:NonNullable<Edit>["kind"],item:CatalogRow)=>void;onStatus:(kind:NonNullable<Edit>["kind"],item:CatalogRow,status:Status)=>Promise<void>}){
 return <div className={styles.catalogList}><h3>{title} <span>{rows.length}</span></h3>{rows.length===0?<small>Chưa có dữ liệu.</small>:rows.map(item=><div className={styles.catalogRow} key={item.id}>
  <div><strong>{item.displayName}</strong><small>{item.key} · v{item.version}</small></div>
  <span className={bo.statusPill}>{item.status}</span>
  <div className={styles.catalogActions}><button className={bo.secondaryButton} onClick={()=>onEdit(kind,item)}>Edit</button>{item.status==="DRAFT"?<button className={bo.primaryButton} onClick={()=>void onStatus(kind,item,"ACTIVE")}>Activate</button>:null}{item.status!=="ARCHIVED"?<button className={bo.secondaryButton} onClick={()=>void onStatus(kind,item,"ARCHIVED")}>Archive</button>:null}</div>
 </div>)}</div>;
}
