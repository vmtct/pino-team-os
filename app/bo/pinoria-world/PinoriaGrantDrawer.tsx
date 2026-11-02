"use client";
import { useEffect, useState } from "react";
import { BoDataGridSidePeek } from "@/app/bo/components/data-grid";

type Learner={id:string;displayName:string;status:string};
type World={id:string;displayName:string;status:"DRAFT"|"ACTIVE"|"ARCHIVED"};
type Envelope<T>={data?:T;error?:{message?:string}};
async function canonical<T>(path:string,init?:RequestInit):Promise<T>{
 const response=await fetch(`/api/bo/${path}`,{cache:"no-store",...init});
 const result=(await response.json()) as Envelope<T>;
 if(!response.ok||!result.data)throw new Error(result.error?.message??"Canonical request failed");
 return result.data;
}
export function PinoriaGrantDrawer({onClose,onGranted}:{onClose:()=>void;onGranted:(id:string)=>void}){
 const [learners,setLearners]=useState<Learner[]>([]),[worlds,setWorlds]=useState<World[]>([]);
 const [studentId,setStudentId]=useState(""),[worldId,setWorldId]=useState(""),[label,setLabel]=useState("");
 const [search,setSearch]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{
  const controller=new AbortController();
  void Promise.all([
   canonical<{learners:Learner[]}>("pinoria/worlds/learners",{signal:controller.signal}),
   canonical<{worlds:World[]}>("pinoria/worlds",{signal:controller.signal})
  ]).then(([l,w])=>{
   if(controller.signal.aborted)return;
   setLearners(l.learners.filter(s=>s.status==="ACTIVE"));
   setWorlds(w.worlds.filter(world=>world.status!=="ARCHIVED"));
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Options unavailable");})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[]);
 async function confirmGrant(){
  if(busy||!studentId||!worldId||!label.trim())return;
  setBusy(true);setError("");
  try{
   const result=await canonical<{id:string;status:string}>(`pinoria/worlds/learners/${studentId}/instances`,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({worldId,displayLabel:label.trim()})
   });
   if(result.status!=="INACTIVE")throw new Error("Unexpected grant state; check canonical instance");
   onGranted(result.id);
  }catch(e){setError(e instanceof Error?e.message:"Grant failed; verify canonical state before retry");}
  finally{setBusy(false);}
 }
 return <BoDataGridSidePeek title="Grant World" eyebrow="Pinoria · WorldInstance" onClose={()=>{if(!busy)onClose();}}>
  <div style={{display:"grid",gap:14}}>
   <p>Grant creates one INACTIVE instance. It does not unlock a Scene or set the World LIVE.</p>
   {loading?<p>Loading authorized students and Worlds…</p>:null}
   {error?<p role="alert">{error}</p>:null}
   <label>Search ACTIVE students<input value={search} onChange={e=>setSearch(e.target.value)} disabled={busy||loading}/></label>
   <label>Student<select value={studentId} onChange={e=>setStudentId(e.target.value)} disabled={busy||loading}>
    <option value="">Select student</option>{learners.filter(l=>l.displayName.toLowerCase().includes(search.toLowerCase())||l.id.includes(search)).map(l=><option key={l.id} value={l.id}>{l.displayName}</option>)}
   </select></label>
   <label>World<select value={worldId} onChange={e=>setWorldId(e.target.value)} disabled={busy||loading}>
    <option value="">Select World</option>{worlds.map(w=><option key={w.id} value={w.id}>{w.displayName} · {w.status}</option>)}
   </select></label>
   <label>Instance label<input value={label} maxLength={120} onChange={e=>setLabel(e.target.value)} disabled={busy||loading}/></label>
   <div style={{display:"flex",gap:12}}>
    <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
    <button type="button" disabled={busy||loading||!studentId||!worldId||!label.trim()} onClick={()=>void confirmGrant()}>{busy?"Granting…":"Confirm Grant"}</button>
   </div>
  </div>
 </BoDataGridSidePeek>;
}
