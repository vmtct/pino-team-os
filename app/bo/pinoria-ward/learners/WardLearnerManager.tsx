"use client";

import {useEffect,useMemo,useState} from "react";
import {pinoriaAssetUrl} from "@/app/pinoria-tv/layered-character";
import styles from "../pinoria-ward.module.css";

type Slot="HEAD/HAIR"|"FACE"|"HEADWEAR"|"OUTFIT"|"BACK"|"AURA_BACK"|"AURA_GROUND"|"PATH_MARK";
type Learner={studentProfileId:string;displayName:string;characterId:string|null;ownedCount:number;equippedCount:number};
type Owned={id:string;displayName:string;slot:Slot;rarity:string;wearable:{displayName:string};acquisition:{provenance:string;sourceReference:string|null;acquiredAt:string}};
type Loadout={version:number;slots:Record<Slot,string|null>};
type Render={mode:"LAYERED"|"SET_WEBM";webmAssetKey:string|null;activeSetId:string|null;effectSlots:Record<"AURA_BACK"|"AURA_GROUND"|"PATH_MARK",string|null>;suppressedStandardSlots:Slot[]};
type Detail={inventory:{studentProfileId:string;characterId:string|null;ownedVariants:Owned[];loadout:Loadout|null};render:Render|null};
type Catalog={items:Array<{id:string;displayName:string;status:string;slot:Slot|null}>;variants:Array<{id:string;wearableId:string;displayName:string;status:string}>};
type SetCatalog={sets:Array<{id:string;webmAssetKey:string|null;status:string;members:Array<{variantId:string}>}>};
type Envelope<T>={data?:T;error?:{message?:string}};
const slots:Slot[]=["HEAD/HAIR","FACE","HEADWEAR","OUTFIT","BACK","AURA_BACK","AURA_GROUND","PATH_MARK"];
const effects=new Set<Slot>(["AURA_BACK","AURA_GROUND","PATH_MARK"]);
async function request<T>(path:string,init?:RequestInit){const r=await fetch(`/api/bo/${path}`,{cache:"no-store",...init});const j=await r.json() as Envelope<T>;if(!r.ok||!j.data)throw new Error(j.error?.message??"Ward Learner operation failed");return j.data;}
function mutation(method:"POST"|"PUT",body:unknown):RequestInit{return{method,headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify(body)};}

export function WardLearnerManager(){
 const[learners,setLearners]=useState<Learner[]>([]),[catalog,setCatalog]=useState<Catalog>({items:[],variants:[]}),[sets,setSets]=useState<SetCatalog>({sets:[]});
 const[selectedId,setSelectedId]=useState<string|null>(null),[detail,setDetail]=useState<Detail|null>(null),[query,setQuery]=useState("");
 const[draft,setDraft]=useState<Record<Slot,string|null>>(()=>Object.fromEntries(slots.map(slot=>[slot,null])) as Record<Slot,string|null>);
 const[selectedVariant,setSelectedVariant]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const selected=learners.find(row=>row.studentProfileId===selectedId)??null;
 const filtered=useMemo(()=>learners.filter(row=>`${row.displayName} ${row.studentProfileId}`.toLowerCase().includes(query.toLowerCase())),[learners,query]);
 const owned=detail?.inventory.ownedVariants??[];
 const activeCatalog=useMemo(()=>catalog.variants.filter(v=>v.status==="ACTIVE").map(v=>({variant:v,item:catalog.items.find(i=>i.id===v.wearableId)})).filter(row=>row.item?.status==="ACTIVE"),[catalog]);

 async function load(){try{const[a,b,c]=await Promise.all([request<{learners:Learner[]}>("pinoria/ward/learners"),request<Catalog>("pinoria/ward/catalog"),request<SetCatalog>("pinoria/ward/sets")]);setLearners(a.learners);setCatalog(b);setSets(c);setError("");}catch(e){setError(e instanceof Error?e.message:"Không tải được learner wardrobe");}}
 async function openLearner(id:string){setSelectedId(id);setSelectedVariant(null);setMessage("");setError("");try{const d=await request<Detail>(`pinoria/ward/learners/${id}`);setDetail(d);setDraft(d.inventory.loadout?.slots??Object.fromEntries(slots.map(slot=>[slot,null])) as Record<Slot,string|null>);}catch(e){setError(e instanceof Error?e.message:"Không tải được wardrobe");}}
 async function refresh(){if(selectedId)await openLearner(selectedId);await load();}
 useEffect(()=>{void load();},[]);
 function equip(item:Owned){setDraft(value=>({...value,[item.slot]:item.id}));setSelectedVariant(item.id);setMessage("");}
 function unequip(slot:Slot){setDraft(value=>({...value,[slot]:null}));setMessage("");}
 async function save(){if(!selectedId||!detail)return;setBusy(true);setError("");try{await request(`pinoria/ward/learners/${selectedId}/loadout`,mutation("PUT",{expectedVersion:detail.inventory.loadout?.version??0,slots:draft}));setMessage("Saved ✓");await refresh();}catch(e){setError(e instanceof Error?e.message:"Không lưu được loadout");}finally{setBusy(false);}}
 async function grant(){if(!selectedId||!selectedVariant)return;setBusy(true);setError("");try{await request(`pinoria/ward/learners/${selectedId}/grants`,mutation("POST",{variantId:selectedVariant,sourceReference:"BO F2 learner wardrobe"}));setMessage("Đã grant wearable");await refresh();}catch(e){setError(e instanceof Error?e.message:"Grant thất bại");}finally{setBusy(false);}}
 async function revoke(){if(!selectedId||!selectedVariant)return;setBusy(true);setError("");try{await request(`pinoria/ward/learners/${selectedId}/revocations`,mutation("POST",{variantId:selectedVariant,reason:"BO learner wardrobe revoke"}));setMessage("Đã revoke wearable");setSelectedVariant(null);await refresh();}catch(e){setError(e instanceof Error?e.message:"Revoke thất bại");}finally{setBusy(false);}}
 const selectedOwned=owned.find(item=>item.id===selectedVariant)??null;
 const selectedCatalog=activeCatalog.find(row=>row.variant.id===selectedVariant)??null;
 const isEquipped=selectedVariant?Object.values(draft).includes(selectedVariant):false;
 const equippedIds=new Set(Object.values(draft).filter((id):id is string=>Boolean(id)));
 const liveSet=sets.sets.find(set=>set.status==="ACTIVE"&&!!set.webmAssetKey&&set.members.length>0&&set.members.every(member=>equippedIds.has(member.variantId)))??null;
 const webm=liveSet?.webmAssetKey??null;

 return <main className={styles.shell}>
  <header className={styles.topbar}><div><p className={styles.eyebrow}>PNR-WARD · F2-LEARNER</p><h1>Learner Wardrobe</h1></div><span className={styles.slotBadge}>8-slot</span></header>
  <section className={styles.toolbar}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search learner…"/></section>
  {error?<div className={styles.advancedBox}>{error}</div>:null}{message?<div className={styles.statusStrip}><b>{message}</b></div>:null}
  <section className={styles.catalogPage}><div className={styles.listHead}><span>Learner</span><span>Owned</span><span>Equipped</span><span>Status</span><span></span><span></span><span></span></div>
   <div className={styles.rows}>{filtered.map(row=><button key={row.studentProfileId} className={styles.row} onClick={()=>void openLearner(row.studentProfileId)}><span className={styles.itemCell}><i className={styles.thumb}>◉</i><b>{row.displayName}</b><small>{row.studentProfileId.slice(0,8)}</small></span><span>{row.ownedCount}</span><span>{row.equippedCount}/8</span><span><i className={styles.status}>ACTIVE</i></span><span/><span/><span/></button>)}</div>
  </section>

  {selected&&detail&&<div className={styles.backdrop} onClick={()=>setSelectedId(null)}/>}
  {selected&&detail&&<aside className={styles.peek}>
   <div className={styles.peekTop}><button onClick={()=>setSelectedId(null)}>✕</button><span>Learner wardrobe</span><button>•••</button></div>
   <div className={styles.detailHead}><div><p>{selected.studentProfileId.slice(0,8)}</p><h2>{selected.displayName}</h2><small>{owned.length} owned · {Object.values(draft).filter(Boolean).length}/8 equipped</small></div><span className={styles.slotBadge}>{webm?"SET WEBM":"LAYERED"}</span></div>
   <div className={styles.peekBody}>
    <section className={styles.previewCard}><div className={styles.previewTop}><span>Character preview</span><small>{webm?"WEBM + EFFECTS":"8-slot layers"}</small></div>
     <div className={styles.stage}>{webm?<><video src={pinoriaAssetUrl(webm)??undefined} autoPlay loop muted playsInline style={{width:"100%",height:"100%",objectFit:"contain"}}/><div className={styles.wearable}>✦</div></>:<><div className={styles.aura}/><div className={styles.character}>◕‿◕<span>◢█◣</span></div></>}</div>
     <div className={styles.previewFoot}><span>{webm?"5 STANDARD slots suppressed":"STANDARD layered"}</span><span>{["AURA_BACK","AURA_GROUND","PATH_MARK"].filter(slot=>draft[slot as Slot]).join(" · ")||"No effects"}</span></div>
    </section>
    <div className={styles.statusStrip}><span>LOADOUT · 8 SLOTS</span><b>{webm?"SET WEBM ACTIVE":"LAYERED"}</b></div>
    <div className={styles.usage}>{slots.map(slot=>{const item=owned.find(i=>i.id===draft[slot]);return <div key={slot}><span>{slot}{effects.has(slot)?" · EFFECT":""}</span><b style={{fontSize:13}}>{item?.displayName??"Empty"}</b>{item?<button className={styles.secondary} style={{display:"inline-flex"}} onClick={()=>unequip(slot)}>Unequip</button>:null}</div>})}</div>
    <div className={styles.statusStrip}><span>OWNED WARDROBE</span><b>{owned.length} items</b></div>
    <div className={styles.variantLayout}><div className={styles.variantList}>{owned.map((item,index)=>{const active=draft[item.slot]===item.id;return <button key={item.id} className={active?styles.variantActive:""} onClick={()=>equip(item)}><span>{String(index+1).padStart(2,"0")}</span><div><b>{item.displayName}</b><small>{item.slot} · {item.rarity} · {active?"EQUIPPED":"OWNED"}</small></div></button>})}</div>
     <div className={styles.editor}><div className={styles.assetDrop}><b>{selectedOwned?.displayName??selectedCatalog?.variant.displayName??"Select wearable"}</b><small>Select owned item to equip/revoke, or catalog item below to grant.</small></div>
      <label>Grant from F0<select value={selectedVariant??""} onChange={e=>setSelectedVariant(e.target.value||null)}><option value="">Choose ACTIVE variant</option>{activeCatalog.filter(row=>!owned.some(item=>item.id===row.variant.id)).map(row=><option key={row.variant.id} value={row.variant.id}>{row.item?.displayName} · {row.variant.displayName}</option>)}</select></label>
     </div></div>
   </div>
   <footer className={styles.actions}><button className={styles.secondary} style={{display:"inline-flex"}} disabled={busy||!selectedCatalog||!!selectedOwned} onClick={()=>void grant()}>Grant item</button><button className={styles.secondary} style={{display:"inline-flex"}} disabled={busy||!selectedOwned||isEquipped} onClick={()=>void revoke()}>Revoke item</button><button className={styles.publish} disabled={busy} onClick={()=>void save()}>Save loadout</button></footer>
  </aside>}
 </main>;
}
