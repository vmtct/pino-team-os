"use client";
/** PAP-2153 / PNR-WORLD: controlled presentation only; caller owns transport and scope. */
import {SelfWorldSummary} from "./SelfWorldSummary";
import {SelfWorldDetail} from "./SelfWorldDetail";
import {SelfWorldActions} from "./SelfWorldActions";
import type {AvatarWorldState,Scope,WorldIntent} from "./avatar-world-contract";

type Props={
 scope:Scope; state:AvatarWorldState|null; status:"loading"|"ready"|"denied"|"error";
 grants:ReadonlySet<string>; instanceId:string|null; busy:boolean; mutationBlocked?:boolean;
 onReload:()=>void; onOpen:(id:string)=>void; onBack:()=>void; onConfirm:(intent:WorldIntent)=>void;
};
export function SelfWorldTabContent({scope,state,status,grants,instanceId,busy,mutationBlocked=false,onReload,onOpen,onBack,onConfirm}:Props){
 const canView=["pinoria.avatar.directory.view","pinoria.self.loadout.view","pinoria.world.avatar.view"].every(key=>grants.has(key));
 const matched=!!state&&state.selfId===scope.selfId&&state.centerId===scope.centerId&&state.studentProfileId===scope.studentProfileId;
 const visibleStatus=canView?status:"denied";
 if(visibleStatus!=="ready"||!state||!matched){
  return <SelfWorldSummary scope={scope} state={null} status={visibleStatus} onReload={onReload} onOpen={onOpen}/>;
 }
 const instanceExists=instanceId===null||state.instances.some(i=>i.id===instanceId);
 return <section aria-label="World" aria-busy={busy}>
  {instanceId===null
   ? <SelfWorldSummary scope={scope} state={state} status="ready" onReload={onReload} onOpen={id=>{if(!busy)onOpen(id)}}/>
   : <SelfWorldDetail scope={scope} state={state} instanceId={instanceId} onBack={()=>{if(!busy)onBack()}}/>}
  {instanceExists&&<SelfWorldActions scope={scope} state={state} grants={grants} instanceId={instanceId} busy={busy||mutationBlocked} onConfirm={intent=>{if(!busy&&!mutationBlocked)onConfirm(intent)}}/>}
 </section>;
}
