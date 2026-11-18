"use client";
/** PAP-2147 / MT-GUEST — actual authenticated composition of the approved native UI. */
import {useContext,useEffect,useState} from "react";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {RecordState} from "@/app/components/workspace-renderer/Record";
import {TddRegistry} from "@/lib/workspace-schema";
import {bindSurface} from "@/lib/workspace-adapters/adapter";
import {surfaceSession,adapterError} from "@/lib/workspace-adapters/session";
import type {AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {useBoCenterSelection} from "../components/registration/BoCenterSelection";
import {BoMyTimeGuests,type GuestPort,type VersionedGuest} from "./BoMyTimeGuests";
import {definition,READ,EDIT,CREATE,queryDefault,type GuestFields} from "./schema";
import {createGuest,guestProvider} from "./provider";
type Ready={scopeKey:string;adapter:AuthenticatedSurfaceAdapter<GuestFields>;rows:VersionedGuest[];port:GuestPort;canCreate:boolean};
export function BoMyTimeGuestsTdd(){
 const selection=useBoCenterSelection(),menu=useContext(TddHostMenu);
 const centerId=!selection?.loading&&!selection?.error&&selection?.centers.some(c=>c.id===selection.selected)?selection.selected:"",source=selection?.source??"centers";
 const [retry,setRetry]=useState(0),[ready,setReady]=useState<Ready|null>(null),[failed,setFailed]=useState("");
 const scopeKey=centerId+":"+source+":"+retry;
 useEffect(()=>{
  if(!centerId)return;
  const ctl=new AbortController();
  let session:ReturnType<typeof surfaceSession>|undefined;
  void (async()=>{
   session=surfaceSession("BO",undefined,fetch,{id:centerId,source});
   const active=session;
   // Create remains an explicit separately guarded domain command, not a generic TDD capability.
   const adapter=await bindSurface(active,{registry:new TddRegistry(),definition:{...definition,capabilities:{read:READ,edit:EDIT,history:"access.audit.view"}},provider:guestProvider()},ctl.signal);
   const list=await adapter.list(queryDefault,ctl.signal);
   if(!adapter.mutation)throw adapterError(502);
   const rows=list.rows.map(row=>{const version=list.versions[row.id];if(!version)throw adapterError(502);return {row,version};});
   const port:GuestPort={
    update:adapter.mutation,
    read:async id=>{const v=await adapter.detail(id,ctl.signal);if(!v)return null;if(!v.version)throw adapterError(502);return {row:v.row,version:v.version};},
    create:async(input,key)=>{
     ctl.signal.throwIfAborted();
     await active.refresh(ctl.signal);
     if(!active.context.authorize(READ)||!active.context.authorize(CREATE))throw adapterError(403);
     const result=await createGuest(centerId,input,key,active.transport,ctl.signal);
     // Reattest same actor, scope and view/create grant before showing the result.
     try{
      await active.refresh(ctl.signal);
      if(!active.context.authorize(READ)||!active.context.authorize(CREATE))throw adapterError(403);
      const actual=await adapter.detail(result.row.id,ctl.signal);
      if(!actual?.version)throw adapterError(502);
      return {row:actual.row,version:actual.version};
     }catch{throw Error("Guest command accepted; authoritative readback not confirmed.");}
    }
   };
   ctl.signal.throwIfAborted();
   setReady({scopeKey,adapter,rows,port,canCreate:active.context.authorize(CREATE)});
  })().catch(()=>{if(!ctl.signal.aborted){session?.dispose();setFailed(scopeKey);}});
  return ()=>{ctl.abort();session?.dispose();};
 },[centerId,source,scopeKey]);
 const available=ready?.scopeKey===scopeKey?ready:null;
 if(!available)return <>{menu("mytime-guests-menu")}{selection?.loading?<p role="status">Đang tải cơ sở…</p>:selection?.error?<p role="alert">{selection.error}</p>:!centerId?<p role="status">Chọn cơ sở để xem khách MyTime.</p>:failed===scopeKey?<><RecordState status="denied"/><button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></>:<p role="status">Đang tải khách MyTime…</p>}</>;
 return <BoMyTimeGuests key={scopeKey} context={available.adapter.context} binding={available.adapter} centerLabel={selection?.centers.find(c=>c.id===centerId)?.displayName??""} initialRows={available.rows} port={available.port} canCreate={available.canCreate} canCreateNow={()=>available.adapter.context.authorize(CREATE)}/>;
}
