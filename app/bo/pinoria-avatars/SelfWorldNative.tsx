"use client";
/** PAP-2153 / PNR-WORLD: existing native Detail extension; selected-Center context remains authoritative. */
import {useEffect,useRef,useState} from "react";
import {SelfWorldTabContent} from "./SelfWorldTabContent";
import {createWorldTabController,type WorldTabSnapshot} from "./avatar-world-controller";
import {createWorldOperationJournal,type WorldOperationJournal} from "./avatar-world-journal";
import type {Scope} from "./avatar-world-contract";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
import {WORLD_PERMISSIONS} from "./avatar-world-review-identity";
export {WORLD_PERMISSIONS} from "./avatar-world-review-identity";
export function worldScope(row:{pinoriaSelfId?:unknown;studentProfileId?:unknown;personId?:unknown;selfStatus?:unknown;subjectStatus?:unknown},centerId:string):Scope|null{
 const {pinoriaSelfId:selfId,studentProfileId,personId}=row;
 if(typeof selfId!=="string"||typeof studentProfileId!=="string"||typeof personId!=="string"||![selfId,studentProfileId,personId,centerId].every(v=>uuid.test(v))||row.selfStatus!=="ACTIVE"||!["ACTIVE","MIXED"].includes(String(row.subjectStatus)))return null;
 return {selfId,studentProfileId,centerId};
}
type Props={scope:Scope;principalId:string;grants:readonly string[];journals:Map<string,WorldOperationJournal>};
export function SelfWorldNative({scope,principalId,grants,journals}:Props){
 const grantStamp=JSON.stringify([...grants].sort());
 const identity=JSON.stringify([principalId,scope.selfId,scope.centerId,scope.studentProfileId,grantStamp]);
 return <MountedWorld key={identity} scope={scope} principalId={principalId} grantStamp={grantStamp} journals={journals}/>;
}
function MountedWorld({scope,principalId,grantStamp,journals}:{scope:Scope;principalId:string;grantStamp:string;journals:Map<string,WorldOperationJournal>}){
 const {selfId,centerId,studentProfileId}=scope;
 const [snapshot,setSnapshot]=useState<WorldTabSnapshot|null>(null);
 const ctl=useRef<ReturnType<typeof createWorldTabController>|null>(null);
 const grants=new Set<string>(JSON.parse(grantStamp));
 const canView=WORLD_PERMISSIONS.slice(0,3).every(k=>grants.has(k));
 useEffect(()=>{
  if(!principalId)return;
  let journal=journals.get(principalId);
  if(!journal){journal=createWorldOperationJournal();journals.set(principalId,journal)}
  const c=createWorldTabController({selfId,centerId,studentProfileId},new Set<string>(JSON.parse(grantStamp)),(...args)=>fetch(...args),()=>crypto.randomUUID(),setSnapshot,journal);
  ctl.current=c;
  let active=true;
  queueMicrotask(()=>{if(active){setSnapshot(c.snapshot());void c.reload()}});
  return ()=>{active=false;c.dispose();if(ctl.current===c)ctl.current=null};
 },[selfId,centerId,studentProfileId,principalId,grantStamp,journals]);
 if(!principalId||!canView)return <p role="alert">Không có quyền xem World tại cơ sở này.</p>;
 if(!snapshot)return <p role="status">Đang tải World…</p>;
 return <>
 {snapshot.message&&<p role="status">{snapshot.message}</p>}
 {snapshot.blocked&&<button type="button" className="secondary-btn" disabled={snapshot.busy} onClick={()=>{void ctl.current?.reload()}}>Kiểm tra lại kết quả</button>}
 <SelfWorldTabContent scope={scope} state={snapshot.state} status={snapshot.status} grants={grants} instanceId={snapshot.instanceId} busy={snapshot.busy} mutationBlocked={snapshot.blocked}
  onReload={()=>{void ctl.current?.reload()}} onOpen={id=>ctl.current?.open(id)} onBack={()=>ctl.current?.back()} onConfirm={intent=>{void ctl.current?.confirm(intent)}}/>
 </>;
}
