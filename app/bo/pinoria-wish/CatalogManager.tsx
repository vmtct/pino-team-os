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
type MutableKind="bearer"|"set";
type Edit={kind:MutableKind;id:string;version:number;status:Status}|null;
type ProjectionEdit={wearableId:string;rarity:Wearable["rarity"];setId:string}|null;
type CatalogRow=Bearer|SetRow|Wearable|Variant;

async function request<T>(path:string,init?:RequestInit){
 const response=await fetch(`/api/founder/${path}`,{cache:"no-store",...init});
 const text=await response.text();let json:Envelope<T>;try{json=JSON.parse(text) as Envelope<T>;}catch{throw new Error("Wish catalog returned an invalid response");}
 if(!response.ok||!json.data)throw new Error(json.error?.message??"Catalog operation failed");
 return json.data;
}

export function CatalogManager({onChanged}:{onChanged:()=>void}){
 const[catalog,setCatalog]=useState<Catalog|null>(null),[busy,setBusy]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState(""),[edit,setEdit]=useState<Edit>(null),[projection,setProjection]=useState<ProjectionEdit>(null);
 const[bearer,setBearer]=useState({key:"",displayName:"",title:"",loreText:"",regionKey:"",heroAssetKey:""});
 const[setForm,setSetForm]=useState({key:"",bearerId:"",displayName:"",descriptionText:""});
 const activeBearers=useMemo(()=>catalog?.bearers.filter(x=>x.status==="ACTIVE")??[],[catalog]);
 const activeSets=useMemo(()=>catalog?.sets.filter(x=>x.status==="ACTIVE")??[],[catalog]);
 async function load(){try{const data=await request<Catalog>("pinoria/wish/catalog");setCatalog(data);setSetForm(x=>({...x,bearerId:x.bearerId||data.bearers.find(b=>b.status==="ACTIVE")?.id||""}));}catch(cause){setError(cause instanceof Error?cause.message:"Không tải được catalog");}}
 useEffect(()=>{void load();},[]);
 function done(text:string){setMessage(text);setError("");setEdit(null);void load();onChanged();}
 async function command(path:string,body:unknown,label:string,method:"POST"|"PATCH"){setBusy(label);setError("");try{await request(path,{method,headers:{"content-type":"application/json"},body:JSON.stringify(body)});done(label);return true;}catch(cause){setError(cause instanceof Error?cause.message:"Catalog command failed");return false;}finally{setBusy("");}}
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
 function begin(kind:MutableKind,item:Bearer|SetRow){
  setEdit({kind,id:item.id,version:item.version,status:item.status});
  if(kind==="bearer"){const x=item as Bearer;setBearer({key:x.key,displayName:x.displayName,title:x.title,loreText:x.loreText,regionKey:x.regionKey,heroAssetKey:x.heroAssetKey});}
  if(kind==="set"){const x=item as SetRow;setSetForm({key:x.key,bearerId:x.bearerId,displayName:x.displayName,descriptionText:x.descriptionText});}
 }
 function cancel(){setEdit(null);setBearer({key:"",displayName:"",title:"",loreText:"",regionKey:"",heroAssetKey:""});setSetForm(x=>({...x,key:"",displayName:"",descriptionText:""}));}
 async function setStatus(kind:MutableKind,item:Bearer|SetRow,status:Status){
  let path="",body:Record<string,unknown>={expectedVersion:item.version,status};
  if(kind==="bearer"){const x=item as Bearer;path=`pinoria/wish/catalog/bearers/${x.id}`;body={...body,displayName:x.displayName,title:x.title,loreText:x.loreText,regionKey:x.regionKey,heroAssetKey:x.heroAssetKey,metadata:x.metadata};}
  if(kind==="set"){const x=item as SetRow;path=`pinoria/wish/catalog/sets/${x.id}`;body={...body,bearerId:x.bearerId,displayName:x.displayName,descriptionText:x.descriptionText,metadata:x.metadata};}
  await command(path,body,`${item.key}: ${status}`,"PATCH");
 }
 function beginProjection(item:Wearable){setProjection({wearableId:item.id,rarity:item.rarity,setId:item.setId??""});}
 async function saveProjection(){if(!projection)return;if(await command(`pinoria/wish/catalog/wearables/${projection.wearableId}/projection`,{rarity:projection.rarity,setId:projection.setId||null},"Đã cập nhật Wish projection","PATCH"))setProjection(null); }
 if(!catalog)return <section className={bo.panel}><div className={bo.state}><strong>Đang tải Wish catalog…</strong></div></section>;
 return <section className={bo.panel}>
  <div className={bo.panelHeading}><div><h2>Wish content catalog</h2><p>Wish quản trị Bearer và Set. Wearable/Variant là Ward-owned và chỉ hiển thị projection tại đây.</p></div><span className={bo.writePill}>BOUNDED WRITE</span></div>
  {error?<div className={`${bo.card} ${bo.denied}`}><strong>Lỗi catalog</strong><span>{error}</span></div>:null}
  {message?<div className={bo.successCard}><span>Catalog</span><strong>{message}</strong></div>:null}
  {edit?<div className={styles.editNotice}><strong>Đang sửa {edit.kind}</strong><span>v{edit.version} · {edit.status}</span><button className={bo.secondaryButton} onClick={cancel}>Hủy sửa</button></div>:null}
  {projection?<div className={styles.projectionEditor}><div><strong>Cấu hình Wish projection</strong><small>Chỉ rarity + signature Set; definition/lifecycle vẫn thuộc Ward.</small></div><label className={bo.field}>Rarity<select value={projection.rarity} onChange={e=>setProjection(x=>x?{...x,rarity:e.target.value as Wearable["rarity"]}:x)}><option value="COMMON">COMMON</option><option value="RARE">RARE</option><option value="MYTHIC">MYTHIC</option></select></label><label className={bo.field}>Signature Set<select value={projection.setId} onChange={e=>setProjection(x=>x?{...x,setId:e.target.value}:x)}><option value="">Không gắn set</option>{activeSets.map(x=><option key={x.id} value={x.id}>{x.displayName}</option>)}</select></label><div className={styles.catalogActions}><button className={bo.primaryButton} disabled={!!busy} onClick={()=>void saveProjection()}>Lưu Wish projection</button><button className={bo.secondaryButton} disabled={!!busy} onClick={()=>setProjection(null)}>Hủy</button></div></div>:null}
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
   <div className={styles.catalogForm}><h3>Wearable + Variant</h3><p>Định nghĩa và lifecycle của Wearable/Variant đã chuyển sang canonical Ward Catalog. Wish chỉ đọc projection để cấu hình banner/rule.</p><a className={bo.primaryButton} href="/bo/pinoria-ward">Mở Ward Catalog</a></div>
  </div>
  <div className={styles.catalogLists}>
   <CatalogList title="Bearers" rows={catalog.bearers} onEdit={item=>begin("bearer",item as Bearer)} onStatus={(item,status)=>setStatus("bearer",item as Bearer,status)}/>
   <CatalogList title="Sets" rows={catalog.sets} onEdit={item=>begin("set",item as SetRow)} onStatus={(item,status)=>setStatus("set",item as SetRow,status)}/>
   <WearableProjectionList rows={catalog.wearables} sets={catalog.sets} onConfigure={beginProjection}/>
   <CatalogList title="Variants · Ward projection" rows={catalog.variants} manageHref="/bo/pinoria-ward"/>
  </div>
 </section>;
}

function CatalogList({title,rows,onEdit,onStatus,manageHref}:{title:string;rows:CatalogRow[];onEdit?:(item:CatalogRow)=>void;onStatus?:(item:CatalogRow,status:Status)=>Promise<void>;manageHref?:string}){
 return <div className={styles.catalogList}><h3>{title} <span>{rows.length}</span></h3>{rows.length===0?<small>Chưa có dữ liệu.</small>:rows.map(item=><div className={styles.catalogRow} key={item.id}>
  <div><strong>{item.displayName}</strong><small>{item.key} · v{item.version}</small></div>
  <span className={bo.statusPill}>{item.status}</span>
  <div className={styles.catalogActions}>{manageHref?<a className={bo.secondaryButton} href={manageHref}>Manage in Ward</a>:<><button className={bo.secondaryButton} onClick={()=>onEdit?.(item)}>Edit</button>{item.status==="DRAFT"?<button className={bo.primaryButton} onClick={()=>void onStatus?.(item,"ACTIVE")}>Activate</button>:null}{item.status!=="ARCHIVED"?<button className={bo.secondaryButton} onClick={()=>void onStatus?.(item,"ARCHIVED")}>Archive</button>:null}</>}</div>
 </div>)}</div>;
}

function WearableProjectionList({rows,sets,onConfigure}:{rows:Wearable[];sets:SetRow[];onConfigure:(item:Wearable)=>void}){
 const setNames=new Map(sets.map(item=>[item.id,item.displayName]));
 return <div className={styles.catalogList}><h3>Wearables · Wish projection <span>{rows.length}</span></h3>{rows.length===0?<small>Chưa có dữ liệu.</small>:rows.map(item=><div className={styles.catalogRow} key={item.id}>
  <div><strong>{item.displayName}</strong><small>{item.key} · {item.rarity} · {item.setId?setNames.get(item.setId)??item.setId:"No signature set"}</small></div>
  <span className={bo.statusPill}>{item.status}</span>
  <div className={styles.catalogActions}><button className={bo.secondaryButton} disabled={item.status==="ARCHIVED"} onClick={()=>onConfigure(item)}>Configure Wish</button><a className={bo.secondaryButton} href="/bo/pinoria-ward">Manage in Ward</a></div>
 </div>)}</div>;
}
