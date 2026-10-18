"use client";
import { useCallback, useEffect, useState } from "react";
import { BoDataGridSidePeek } from "@/app/bo/components/data-grid";
import { PinoriaInstancePreview } from "./PinoriaInstancePreview";
import type { PinoriaCharacterConfig, PinoriaWardRender } from "@/app/pinoria-tv/layered-character";

type Layer={id:string;kind:"MEDIA"|"CHARACTER";displayName:string;mediaType:string|null;assetKey?:string|null;positionX?:number;positionY?:number;scale?:number;zIndex?:number;anchor?:"CENTER"|"BOTTOM_CENTER";enabled:boolean};
type Scene={id:string;displayName:string;baseAssetKey:string;canvasWidth?:number;canvasHeight?:number;layers:Layer[]};
type World={displayName:string;scenes:Scene[]};
type Character={id:string;config:PinoriaCharacterConfig;wardRender:PinoriaWardRender|null}|null;
type Detail={character?:Character;id:string;studentProfileId:string;displayLabel:string;status:"LIVE"|"INACTIVE"|"REVOKED";grantedAt:string;world:World;sceneAccess:Record<string,boolean>;unlockedLayerIds:string[]};
type Envelope<T>={data?:T;error?:{message?:string}};
async function core<T>(path:string,init?:RequestInit):Promise<T>{
 const response=await fetch(`/api/bo/${path}`,{cache:"no-store",...init});
 const envelope=(await response.json()) as Envelope<T>;
 if(!response.ok||envelope.data===undefined)throw new Error(envelope.error?.message??"Canonical operation failed");
 return envelope.data;
}
export function PinoriaInstanceDetail({id,onClose,onChanged}:{id:string;onClose:()=>void;onChanged:()=>void}){
 const [detail,setDetail]=useState<Detail|null>(null),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const [tab,setTab]=useState<"overview"|"scenes"|"layers"|"preview">("overview");
 const [sceneId,setSceneId]=useState("");
 const load=useCallback(async(signal?:AbortSignal)=>{
  const next=await core<Detail>(`pinoria/worlds/instances/${id}`,{signal});
  if(!signal?.aborted){setDetail(next);setSceneId(previous=>next.world.scenes.some(s=>s.id===previous)?previous:next.world.scenes[0]?.id??"");}
 },[id]);
 useEffect(()=>{
  const controller=new AbortController();setDetail(null);setError("");setMessage("");setTab("overview");
  void load(controller.signal).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Detail unavailable");});
  return ()=>controller.abort();
 },[load]);
 async function command(path:string,method:"PUT"|"POST"|"DELETE",body:unknown,confirmation?:string){
  if(busy||!detail)return;
  if(confirmation&&!window.confirm(confirmation))return;
  setBusy(true);setError("");setMessage("");
  try{
   await core<unknown>(path,{method,headers:{"content-type":"application/json"},body:JSON.stringify(body)});
   if(method==="DELETE"){onChanged();onClose();return;}
   await load();
   onChanged();setMessage("Canonical state refreshed.");
  }catch(e){setDetail(null);setError((e instanceof Error?e.message:"Operation failed")+" · State uncertain. Reload this detail before any retry.");}
  finally{setBusy(false);}
 }
 const scene=detail?.world.scenes.find(s=>s.id===sceneId);
 const base=`pinoria/worlds/instances/${id}`;
 return <BoDataGridSidePeek title={detail?.displayLabel??"WorldInstance"} eyebrow="Canonical instance" onClose={()=>{if(!busy)onClose();}}>
  {error?<p role="alert">{error} <button disabled={busy} onClick={()=>void load().then(()=>setError("")).catch(e=>setError(String(e)))}>Reload</button></p>:null}
  {message?<p role="status">{message}</p>:null}
  {!detail?<p>Loading authorized detail…</p>:<>
   <nav aria-label="Instance drawer sections" style={{display:"flex",flexWrap:"wrap",gap:8}}>
    {(["overview","scenes","layers","preview"] as const).map(name=><button key={name} type="button" disabled={busy} aria-current={tab===name?"page":undefined} onClick={()=>setTab(name)}>{name}</button>)}
   </nav>
   {tab==="overview"?<section>
    <p>Student: <code>{detail.studentProfileId}</code></p><p>World: {detail.world.displayName}</p>
    <p>Status: {detail.status} · Granted: {detail.grantedAt.slice(0,10)}</p>
    <p>Instance: <code>{detail.id}</code></p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
     {detail.status==="INACTIVE"?<button disabled={busy} onClick={()=>void command(`${base}/set-live`,"POST",{},"Set this World LIVE? Previous LIVE instance will become INACTIVE.")}>Set LIVE</button>:null}
     {detail.status==="REVOKED"?<button disabled={busy} onClick={()=>void command(`${base}/reactivate`,"POST",{},"Reactivate this World?")}>Reactivate</button>:<button disabled={busy} onClick={()=>void command(`${base}/revoke`,"POST",{},"Revoke this WorldInstance?")}>Revoke</button>}
     <button disabled={busy} onClick={()=>void command(base,"DELETE",{},"Permanently delete this WorldInstance?")}>Delete</button>
    </div>
   </section>:null}
   {tab==="scenes"?<section><h3>Scene Access</h3>{detail.world.scenes.map(s=><label key={s.id} style={{display:"block"}}>
    <input type="checkbox" disabled={busy||detail.status==="REVOKED"} checked={Boolean(detail.sceneAccess[s.id])}
     onChange={e=>void command(`${base}/scenes/${s.id}`,"PUT",{accessible:e.target.checked})}/>
    {s.displayName}</label>)}</section>:null}
   {tab==="layers"?<section><h3>Layer Unlocks</h3><label>Scene<select value={sceneId} onChange={e=>setSceneId(e.target.value)} disabled={busy}>
    {detail.world.scenes.map(s=><option key={s.id} value={s.id}>{s.displayName}</option>)}</select></label>
    {scene?<><p>Scene base: always rendered</p>{scene.layers.map(layer=>layer.kind==="CHARACTER"?<p key={layer.id}>Character · always on</p>:<label key={layer.id} style={{display:"block"}}>
     <input type="checkbox" checked={detail.unlockedLayerIds.includes(layer.id)}
      disabled={busy||detail.status==="REVOKED"||!detail.sceneAccess[scene.id]||!layer.enabled}
      onChange={e=>void command(`${base}/layers/${layer.id}`,"PUT",{unlocked:e.target.checked})}/>
     {layer.displayName} ({layer.mediaType})</label>)}</>:<p>No Scene available</p>}
   </section>:null}
   {tab==="preview"?<section><h3>Runtime projection</h3><p>Canonical World: {detail.world.displayName}</p>
    {detail.world.scenes.map(s=><p key={s.id}>{s.displayName}: {detail.sceneAccess[s.id]?"Accessible":"Locked"} · {s.layers.filter(l=>l.kind==="MEDIA"&&detail.unlockedLayerIds.includes(l.id)).length} unlocked media layers</p>)}
    {detail.world.scenes.filter(s=>detail.sceneAccess[s.id]).map(s=><PinoriaInstancePreview key={s.id} scene={s} accessible={Boolean(detail.sceneAccess[s.id])} unlocked={detail.unlockedLayerIds} character={detail.character??null}/>)}
   </section>:null}
  </>}
 </BoDataGridSidePeek>;
}
