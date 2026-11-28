"use client";
/** PAP-2153 / PNR-WORLD: original approved WorldInstance layout, controlled scope/transport. */
import type {ReactNode} from "react";
import {SelfWorldSummary} from "./SelfWorldSummary";
import {SelfWorldActions} from "./SelfWorldActions";
import type {AvatarWorldState,Scope,WorldIntent} from "./avatar-world-contract";
type Props={
 scope:Scope;state:AvatarWorldState|null;status:"loading"|"ready"|"denied"|"error";
 grants:ReadonlySet<string>;instanceId:string|null;busy:boolean;mutationBlocked?:boolean;
 onReload:()=>void;onOpen:(id:string)=>void;onBack:()=>void;onConfirm:(intent:WorldIntent)=>void;
 preview?: (instance:AvatarWorldState["instances"][number])=>ReactNode;
};
export function SelfWorldTabContent({scope,state,status,grants,instanceId,busy,mutationBlocked=false,onReload,onOpen,onConfirm,preview}:Props){
 const canView=["pinoria.avatar.directory.view","pinoria.self.loadout.view","pinoria.world.avatar.view"].every(key=>grants.has(key));
 const matched=!!state&&state.selfId===scope.selfId&&state.centerId===scope.centerId&&state.studentProfileId===scope.studentProfileId;
 const visibleStatus=canView?status:"denied";
 if(visibleStatus!=="ready"||!state||!matched)return <SelfWorldSummary scope={scope} state={null} status={visibleStatus} onReload={onReload} onOpen={onOpen}/>;
 const live=state.instances.find(i=>i.status==="LIVE");
 const selected=instanceId===null?(live??state.instances[0]):state.instances.find(i=>i.id===instanceId);
 const blocked=busy||mutationBlocked;
 const confirm=(intent:WorldIntent)=>{if(!blocked)onConfirm(intent)};
 if(instanceId!==null&&!selected)return <p role="alert">World không còn khả dụng.</p>;
 const scene=selected?.world.scenes.find(s=>selected.sceneAccess[s.id]&&s.status==="ACTIVE");
 return <section aria-label="World" aria-busy={busy} data-world-instance-workspace style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:16,minWidth:0,width:"100%"}}>
 <header><h3>World</h3><p>World LIVE: {live?.displayLabel??"Chưa có World LIVE"}</p></header>
 <div className="pds-properties" data-pds-variant="detail" style={{minWidth:0}}>
 <div data-world-instance-layout style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%, 310px),1fr))",gap:16,alignItems:"start"}}>
 <section className="pds-property-section" aria-label="World Preview" style={{minWidth:0}}>
 <h3 className="pds-property-heading">{selected?.displayLabel??"Chưa có World"}</h3>
 <p>{scene?.displayName??"Chưa mở khóa cảnh"}</p>
 <div data-world-preview-slot style={{aspectRatio:"16 / 9",display:"grid",placeItems:"center",border:"1px solid var(--ds-border, currentColor)",overflow:"hidden"}}>
 {selected&&scene&&preview?preview(selected):<p role="status">{scene?"Preview chưa khả dụng.":selected?"Mở khóa một cảnh để xem Avatar.":"Cấp World để xem không gian của Avatar."}</p>}
 </div></section>
 <section className="pds-property-section" aria-label="Cảnh và Layer" style={{minWidth:0}}>
 <h3 className="pds-property-heading">Cảnh &amp; Layer</h3>
 {selected?<><p>{selected.displayLabel} · {selected.status}</p><p>{selected.world.scenes.filter(s=>selected.sceneAccess[s.id]).length}/{selected.world.scenes.length} cảnh</p>
 <SelfWorldActions scope={scope} state={state} grants={grants} instanceId={selected.id} busy={blocked} onConfirm={confirm}/></>:<p>Cấp World để bắt đầu.</p>}
 </section></div></div>
 <section aria-label="World đã sở hữu" style={{minWidth:0,maxWidth:"100%"}}><h3>World đã sở hữu ({state.instances.length})</h3>
 <SelfWorldActions scope={scope} state={state} grants={grants} instanceId={null} busy={blocked} onConfirm={confirm}/>
 <SelfWorldSummary scope={scope} state={state} status="ready" onReload={onReload} selectedId={selected?.id} onOpen={id=>{if(!busy)onOpen(id)}}/>
 </section></section>;
}
