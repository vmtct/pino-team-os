"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {pinoriaAssetUrl} from "@/app/pinoria-tv/layered-character";
import styles from "../pinoria-ward.module.css";

type Slot="HEAD/HAIR"|"FACE"|"HEADWEAR"|"OUTFIT"|"BACK"|"AURA_BACK"|"AURA_GROUND"|"PATH_MARK";
type RelicSlot="1"|"2"|"3"|"4"|"5"|"6"|"7"|"8";
type Filter="ALL"|"CHARACTER"|"ACCESSORY"|"RELIC";
type Subject={pinoriaSelfId:string;displayName:string;subjectTypes:Array<"STUDENT"|"STAFF">;studentProfileId:string|null;staffMemberId:string|null;characterId:string|null;collectionCount:number;variantCount:number;relicCount:number;characterEquippedCount:number;relicEquippedCount:number};
type Ownership={status:"OWNED"|"REVOKED";version:number;provenance:string;sourceReference:string;acquiredAt:string;revokedAt:string|null;revokeReason:string|null};
type Variant={id:string;displayName:string;itemType:"WEARABLE"|"ACCESSORY";wearableKind:string|null;slot:Slot|null;rarityStars:number;collectionKey:string|null;render:{mode:string;assetKey:string|null;posterAssetKey:string|null;metadata:unknown};ownership?:Ownership};
type Relic={id:string;displayName:string;metadata:Record<string,unknown>;ownership?:Ownership};
type Detail={subject:Subject;character:null|{id:string;loadout:{version:number;slots:Record<Slot,string|null>};relicLoadout:{version:number;slots:Record<RelicSlot,string|null>}};variantOwnership:Variant[];relicOwnership:Relic[]};
type Catalog={variants:Variant[];relics:Relic[]};
type Capabilities={view:boolean;equip:boolean;unequip:boolean;grant:boolean;revoke:boolean};
type SubjectEnvelope={subjects:Subject[];capabilities:Capabilities};
type Envelope<T>={data?:T;error?:{message?:string}};
type SelectedItem={kind:"VARIANT";item:Variant}|{kind:"RELIC";item:Relic};
const characterSlots:Slot[]=["HEAD/HAIR","FACE","HEADWEAR","OUTFIT","BACK","AURA_BACK","AURA_GROUND","PATH_MARK"];
const relicSlots:RelicSlot[]=["1","2","3","4","5","6","7","8"];
const emptyCharacter=()=>Object.fromEntries(characterSlots.map(slot=>[slot,null])) as Record<Slot,string|null>;
const emptyRelics=()=>Object.fromEntries(relicSlots.map(slot=>[slot,null])) as Record<RelicSlot,string|null>;
async function request<T>(path:string,init?:RequestInit){const response=await fetch(path.startsWith("/")?path:`/api/bo/${path}`,{cache:"no-store",...init});const body=await response.json() as Envelope<T>;if(!response.ok||!body.data)throw new Error(body.error?.message??"Personal Ward operation failed");return body.data;}
function mutation(method:"POST"|"PUT",body:unknown):RequestInit{return{method,headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify(body)};}
function relicAsset(metadata:Record<string,unknown>){for(const key of ["imageAssetKey","iconAssetKey","assetKey"]){const value=metadata[key];if(typeof value==="string"&&value)return value;}return null;}
function imageUrl(selected:SelectedItem){const key=selected.kind==="VARIANT"?(selected.item.render.posterAssetKey??(selected.item.render.mode==="WEBM"?null:selected.item.render.assetKey)):relicAsset(selected.item.metadata);return key?pinoriaAssetUrl(key):null;}
function filterItem(selected:SelectedItem,filter:Filter){return filter==="ALL"||(filter==="RELIC"&&selected.kind==="RELIC")||(selected.kind==="VARIANT"&&filter==="CHARACTER"&&selected.item.itemType==="WEARABLE")||(selected.kind==="VARIANT"&&filter==="ACCESSORY"&&selected.item.itemType==="ACCESSORY");}

export function PersonalWardManager(){
 const[subjects,setSubjects]=useState<Subject[]>([]),[catalog,setCatalog]=useState<Catalog>({variants:[],relics:[]}),[capabilities,setCapabilities]=useState<Capabilities>({view:false,equip:false,unequip:false,grant:false,revoke:false});
 const[selectedSelf,setSelectedSelf]=useState<string|null>(null),[detail,setDetail]=useState<Detail|null>(null),[query,setQuery]=useState(""),[subjectFilter,setSubjectFilter]=useState<"ALL"|"STUDENT"|"STAFF">("ALL");
 const[collectionFilter,setCollectionFilter]=useState<Filter>("ALL"),[catalogFilter,setCatalogFilter]=useState<Filter>("ALL"),[selectedItem,setSelectedItem]=useState<SelectedItem|null>(null);
 const[characterDraft,setCharacterDraft]=useState<Record<Slot,string|null>>(emptyCharacter),[relicDraft,setRelicDraft]=useState<Record<RelicSlot,string|null>>(emptyRelics);
 const[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");const requestSeq=useRef(0);
 const can=(permission:string)=>permission.endsWith(".view")?capabilities.view:permission.endsWith(".equip")?capabilities.equip:permission.endsWith(".unequip")?capabilities.unequip:permission.endsWith(".grant")?capabilities.grant:permission.endsWith(".revoke")?capabilities.revoke:false;
 const selectedSubject=subjects.find(subject=>subject.pinoriaSelfId===selectedSelf)??null;
 const filteredSubjects=useMemo(()=>subjects.filter(subject=>(subjectFilter==="ALL"||subject.subjectTypes.includes(subjectFilter))&&`${subject.displayName} ${subject.studentProfileId??""} ${subject.staffMemberId??""}`.toLowerCase().includes(query.toLowerCase())),[subjects,query,subjectFilter]);
 const ownedItems=useMemo<SelectedItem[]>(()=>detail?[...detail.variantOwnership.filter(item=>item.ownership?.status==="OWNED").map(item=>({kind:"VARIANT" as const,item})),...detail.relicOwnership.filter(item=>item.ownership?.status==="OWNED").map(item=>({kind:"RELIC" as const,item}))]:[],[detail]);
 const collectionItems=useMemo(()=>ownedItems.filter(item=>filterItem(item,collectionFilter)),[ownedItems,collectionFilter]);
 const ownedIds=useMemo(()=>new Set(ownedItems.map(item=>item.item.id)),[ownedItems]);
 const catalogItems=useMemo<SelectedItem[]>(()=>[...catalog.variants.map(item=>({kind:"VARIANT" as const,item})),...catalog.relics.map(item=>({kind:"RELIC" as const,item}))].filter(item=>!ownedIds.has(item.item.id)&&filterItem(item,catalogFilter)),[catalog,ownedIds,catalogFilter]);
 const persistedCharacter=detail?.character?.loadout.slots??emptyCharacter(),persistedRelics=detail?.character?.relicLoadout.slots??emptyRelics();
 const dirty=detail?.character?characterSlots.some(slot=>persistedCharacter[slot]!==characterDraft[slot])||relicSlots.some(slot=>persistedRelics[slot]!==relicDraft[slot]):false;
 const needsUnequip=dirty&&(characterSlots.some(slot=>persistedCharacter[slot]!==characterDraft[slot]&&persistedCharacter[slot]!==null)||relicSlots.some(slot=>persistedRelics[slot]!==relicDraft[slot]&&persistedRelics[slot]!==null));
 const needsEquip=dirty&&(characterSlots.some(slot=>persistedCharacter[slot]!==characterDraft[slot]&&characterDraft[slot]!==null)||relicSlots.some(slot=>persistedRelics[slot]!==relicDraft[slot]&&relicDraft[slot]!==null));
 const canSave=dirty&&(!needsUnequip||can("pinoria.ward.subject.unequip"))&&(!needsEquip||can("pinoria.ward.subject.equip"));
 const selectedEquipped=selectedItem?Object.values(characterDraft).includes(selectedItem.item.id)||Object.values(relicDraft).includes(selectedItem.item.id):false;

 async function load(){try{const[subjectData,catalogData]=await Promise.all([request<SubjectEnvelope>("pinoria/ward/subjects"),request<Catalog>("pinoria/ward/subjects/catalog")]);setSubjects(subjectData.subjects);setCapabilities(subjectData.capabilities);setCatalog(catalogData);setError("");}catch(value){setError(value instanceof Error?value.message:"Không tải được Personal Ward");}}
 async function openWard(selfId:string){const token=++requestSeq.current;setSelectedSelf(selfId);setDetail(null);setSelectedItem(null);setMessage("");setError("");try{const data=await request<Detail>(`pinoria/ward/subjects/${selfId}`);if(token!==requestSeq.current)return;setDetail(data);setCharacterDraft(data.character?.loadout.slots??emptyCharacter());setRelicDraft(data.character?.relicLoadout.slots??emptyRelics());}catch(value){if(token!==requestSeq.current)return;setError(value instanceof Error?value.message:"Không tải được Ward");}}
 async function refreshWard(){await load();if(selectedSelf)await openWard(selectedSelf);}
 useEffect(()=>{void load();},[]);
 function closeWard(){requestSeq.current++;setSelectedSelf(null);setDetail(null);setSelectedItem(null);}
 function equipSelectedCharacter(slot:Slot){if(selectedItem?.kind!=="VARIANT"||selectedItem.item.itemType!=="WEARABLE"||selectedItem.item.slot!==slot)return;setCharacterDraft(current=>({...current,[slot]:selectedItem.item.id}));}
 function equipSelectedRelic(slot:RelicSlot){if(selectedItem?.kind!=="RELIC")return;setRelicDraft(current=>Object.fromEntries(relicSlots.map(key=>[key,key===slot?selectedItem.item.id:current[key]===selectedItem.item.id?null:current[key]])) as Record<RelicSlot,string|null>);}
 async function grant(){if(!selectedSelf||!selectedItem||ownedIds.has(selectedItem.item.id)||!can("pinoria.ward.subject.grant"))return;setBusy(true);setError("");try{await request(`pinoria/ward/subjects/${selectedSelf}/grants`,mutation("POST",{kind:selectedItem.kind,itemId:selectedItem.item.id,sourceReference:"BO Personal Ward"}));setMessage("Đã thêm item vào Ward");await refreshWard();}catch(value){setError(value instanceof Error?value.message:"Grant thất bại");}finally{setBusy(false);}}
 async function revoke(){if(!selectedSelf||!selectedItem||!ownedIds.has(selectedItem.item.id)||selectedEquipped||!can("pinoria.ward.subject.revoke"))return;setBusy(true);setError("");try{await request(`pinoria/ward/subjects/${selectedSelf}/revocations`,mutation("POST",{kind:selectedItem.kind,itemId:selectedItem.item.id,reason:"BO Personal Ward remove"}));setMessage("Đã remove item khỏi Ward");setSelectedItem(null);await refreshWard();}catch(value){setError(value instanceof Error?value.message:"Remove thất bại");}finally{setBusy(false);}}
 async function save(){if(!selectedSelf||!detail?.character||!canSave)return;setBusy(true);setError("");try{await request(`pinoria/ward/subjects/${selectedSelf}/setup`,mutation("PUT",{expectedCharacterVersion:detail.character.loadout.version,characterSlots:characterDraft,expectedRelicVersion:detail.character.relicLoadout.version,relicSlots:relicDraft}));setMessage("Ward setup đã lưu");await refreshWard();}catch(value){setError(value instanceof Error?value.message:"Save thất bại");}finally{setBusy(false);}}

 return <main className={styles.shell} data-testid="personal-ward-manager">
  <header className={styles.topbar}><div><p className={styles.eyebrow}>PNR-WARD · PERSONAL WARD V1</p><h1>Personal Wards</h1></div><span className={styles.slotBadge}>BO only · Companion riêng</span></header>
  <section className={styles.wardToolbar}><input aria-label="Search subjects" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search Student or Staff…"/><Quick values={["ALL","STUDENT","STAFF"]} value={subjectFilter} setValue={setSubjectFilter}/></section>
  {error?<div className={styles.advancedBox} role="alert">{error}</div>:null}{message?<div className={styles.statusStrip}><b>{message}</b></div>:null}
  <section className={styles.subjectGrid}>{filteredSubjects.map(subject=><button key={subject.pinoriaSelfId} className={styles.subjectCard} onClick={()=>void openWard(subject.pinoriaSelfId)}><span className={styles.thumb}>◉</span><b>{subject.displayName}</b><small>{subject.subjectTypes.join(" + ")} · {subject.collectionCount} items · {subject.characterEquippedCount+subject.relicEquippedCount} equipped</small></button>)}</section>
  {selectedSubject&&detail?<><div className={styles.backdrop} onClick={closeWard}/><aside className={`${styles.peek} ${styles.wardPeek}`} aria-label="Personal Ward detail">
   <div className={styles.peekTop}><button onClick={closeWard}>✕</button><span>Personal Ward · {selectedSubject.subjectTypes.join(" + ")}</span></div>
   <div className={styles.detailHead}><div><p>{selectedSubject.pinoriaSelfId.slice(0,8)}</p><h2>{selectedSubject.displayName}</h2><small>{ownedItems.length} owned · Character {Object.values(characterDraft).filter(Boolean).length}/8 · Relic {Object.values(relicDraft).filter(Boolean).length}/8</small></div></div>
   <div className={styles.peekBody}>
    {!detail.character?<section className={styles.emptyWard}><b>No canonical Character yet</b><span>Run existing Pinoria onboarding first. Personal Ward does not create a second Character materialization path.</span></section>:<>
     <h3 className={styles.sectionTitle}>Character · 8 slots</h3><div className={styles.wardSlots}>{characterSlots.map(slot=>{const id=characterDraft[slot],item=detail.variantOwnership.find(value=>value.id===id);return <div key={slot} className={styles.wardSlot}><small>{slot}</small><b>{item?.displayName??"Empty"}</b><div>{id?<button disabled={!can("pinoria.ward.subject.unequip")} onClick={()=>setCharacterDraft(current=>({...current,[slot]:null}))}>Unequip</button>:null}<button disabled={!can("pinoria.ward.subject.equip")||selectedItem?.kind!=="VARIANT"||selectedItem.item.itemType!=="WEARABLE"||selectedItem.item.slot!==slot} onClick={()=>equipSelectedCharacter(slot)}>Equip selected</button></div></div>})}</div>
     <h3 className={styles.sectionTitle}>Relics · 8 slots</h3><div className={styles.wardSlots}>{relicSlots.map(slot=>{const id=relicDraft[slot],item=detail.relicOwnership.find(value=>value.id===id);return <div key={slot} className={styles.wardSlot}><small>RELIC {slot}</small><b>{item?.displayName??"Empty"}</b><div>{id?<button disabled={!can("pinoria.ward.subject.unequip")} onClick={()=>setRelicDraft(current=>({...current,[slot]:null}))}>Unequip</button>:null}<button disabled={!can("pinoria.ward.subject.equip")||selectedItem?.kind!=="RELIC"} onClick={()=>equipSelectedRelic(slot)}>Equip selected</button></div></div>})}</div>
    </>}
    <div className={styles.collectionHeader}><div><h3>All Collection</h3><small>Ảnh + tên · quick filter theo type</small></div><Quick values={["ALL","CHARACTER","ACCESSORY","RELIC"]} value={collectionFilter} setValue={setCollectionFilter}/></div>
    <div className={styles.denseGrid}>{collectionItems.map(selected=><ItemCard key={`${selected.kind}-${selected.item.id}`} selected={selected} active={selectedItem?.item.id===selected.item.id} onClick={()=>setSelectedItem(selected)}/>)}</div>
    {selectedItem&&ownedIds.has(selectedItem.item.id)?<section className={styles.itemInspector}><b>{selectedItem.item.displayName}</b><span>{selectedItem.kind==="RELIC"?"RELIC":selectedItem.item.itemType}</span><button disabled={busy||selectedEquipped||!can("pinoria.ward.subject.revoke")} onClick={()=>void revoke()}>Remove from Ward</button>{selectedEquipped?<small>Unequip trước khi remove.</small>:null}</section>:null}
    <div className={styles.collectionHeader}><div><h3>Global Catalog</h3><small>Grant ownership vào Personal Ward; grant không auto-equip.</small></div><Quick values={["ALL","CHARACTER","ACCESSORY","RELIC"]} value={catalogFilter} setValue={setCatalogFilter}/></div>
    <div className={styles.denseGrid}>{catalogItems.map(selected=><ItemCard key={`catalog-${selected.kind}-${selected.item.id}`} selected={selected} active={selectedItem?.item.id===selected.item.id} onClick={()=>setSelectedItem(selected)}/>)}</div>
    {selectedItem&&!ownedIds.has(selectedItem.item.id)?<section className={styles.itemInspector}><b>{selectedItem.item.displayName}</b><span>Global Catalog</span><button disabled={busy||!can("pinoria.ward.subject.grant")} onClick={()=>void grant()}>Grant to Ward</button></section>:null}
   </div>
   <footer className={styles.actions}><span className={styles.permissionHint}>{dirty&&!canSave?`Missing ${needsUnequip&&!can("pinoria.ward.subject.unequip")?"UNEQUIP ":""}${needsEquip&&!can("pinoria.ward.subject.equip")?"EQUIP":""}`:""}</span><button className={styles.publish} disabled={busy||!detail.character||!canSave} onClick={()=>void save()}>Save Ward setup</button></footer>
  </aside></>:null}
 </main>;
}

function Quick<T extends string>({values,value,setValue}:{values:readonly T[];value:T;setValue:(value:T)=>void}){return <div className={styles.quickFilters}>{values.map(item=><button key={item} className={value===item?styles.quickActive:""} onClick={()=>setValue(item)}>{item}</button>)}</div>}
function ItemCard({selected,active,onClick}:{selected:SelectedItem;active:boolean;onClick:()=>void}){const src=imageUrl(selected);return <button className={`${styles.denseCard} ${active?styles.denseActive:""}`} onClick={onClick}>{src?<img src={src} alt=""/>:<span className={styles.itemFallback}>{selected.kind==="RELIC"?"◇":"✦"}</span>}<b>{selected.item.displayName}</b></button>}
