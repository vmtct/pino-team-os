/** PAP-2412 / HO-MISSION-CRUD — feature-owned binding, unmounted; no new transport. */
import type {MissionMetadataBinding} from "./MissionMetadataPropertyHost";
import {MISSION_METADATA_COMMAND} from "./mission-inline-presentation";
import {createMissionInlineFence,createMissionInlineFlow,type MissionInlineRequest,type MissionInlineOutcome} from "./mission-inline-flow";
type FlowPorts=Parameters<typeof createMissionInlineFlow>[0];
type Ports=Omit<FlowPorts,"canEdit">&{
 canEdit:(request:MissionInlineRequest)=>boolean;
 acquireActionLock:()=>null|(()=>void);
 onUncertain:()=>void;
};
export function createMissionMetadataBinding(ports:Ports):MissionMetadataBinding {
 const fence=createMissionInlineFence();
 let pending=false,uncertain=false;
 return Object.freeze({
  command:MISSION_METADATA_COMMAND,
  async commit(request:MissionInlineRequest,signal:AbortSignal,eligible:()=>boolean):Promise<MissionInlineOutcome>{
   if(uncertain)return {status:"uncertain"};
   if(pending)return {status:"busy"};
   const canEdit=(candidate:MissionInlineRequest)=>!signal.aborted&&eligible()&&ports.canEdit(candidate);
   if(!canEdit(request))return {status:"denied"};
   const release=ports.acquireActionLock();
   if(!release)return {status:"busy"};
   pending=true;
   try{
    const flow=createMissionInlineFlow({...ports,canEdit},fence);
    const result=await flow(request,signal);
    if(result.status==="uncertain"){uncertain=true;ports.onUncertain();}
    return result;
   }finally{pending=false;release();}
  },
 });
}
