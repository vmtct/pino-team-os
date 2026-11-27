/** PAP-2412 / HO-MISSION-CRUD — isolated domain orchestration. No transport or route admission. */
import type {loadMissionForEdit} from "./read-edit";
import type {loadMissionPathChoices} from "./mission-path-options";
import type {submitHoMission} from "./command";
import {prepareMissionInlineDraft} from "./mission-inline-draft";
export type MissionInlineRequest=Readonly<{id:string;expectedVersion:string;patch:unknown}>;
export type MissionInlineOutcome=
 | {status:"saved";version:string}
 | {status:"denied"|"invalid"|"conflict"|"unavailable"|"uncertain"|"busy"};
type Ports={
 read:(id:string,signal:AbortSignal)=>ReturnType<typeof loadMissionForEdit>;
 paths:(signal:AbortSignal)=>ReturnType<typeof loadMissionPathChoices>;
 submit:(command:Parameters<typeof submitHoMission>[0],signal:AbortSignal)=>ReturnType<typeof submitHoMission>;
 key:()=>string;
 canEdit:(request:MissionInlineRequest)=>boolean;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function createMissionInlineFence(){return {pending:new Set<string>(),uncertain:new Map<string,number>()};}
export function createMissionInlineFlow(ports:Ports,fence=createMissionInlineFence()){
 return async(request:MissionInlineRequest,signal:AbortSignal):Promise<MissionInlineOutcome>=>{
  if(!request||typeof request.id!=="string"||!uuid.test(request.id)||typeof request.expectedVersion!=="string"||
    !/^[1-9][0-9]*$/.test(request.expectedVersion)||!Number.isSafeInteger(Number(request.expectedVersion)))return {status:"invalid"};
  const {id,expectedVersion}=request;
  if(fence.pending.has(id))return {status:"busy"};
  if(signal.aborted||!ports.canEdit(request))return {status:"denied"};
  fence.pending.add(id);
  let submitted=false;
  try{
   const current=await ports.read(id,signal);
   if(signal.aborted||!ports.canEdit(request))return {status:"denied"};
   if(current.state!=="ready")return {status:current.state};
   if(current.id!==id||current.data.status!=="ACTIVE")return {status:"denied"};
   const unresolved=fence.uncertain.get(id);
   if(unresolved!==undefined&&current.version<=unresolved)return {status:"uncertain"};
   if(String(current.version)!==expectedVersion)return {status:"conflict"};
   const paths=await ports.paths(signal);
   if(signal.aborted||!ports.canEdit(request))return {status:"denied"};
   const draft=prepareMissionInlineDraft(current,id,request.patch,expectedVersion,paths);
   if(draft.status!=="ready")return {status:draft.status};
   const key=ports.key();
   if(signal.aborted||!ports.canEdit(request))return {status:"denied"};
   submitted=true;
   fence.uncertain.set(id,draft.expectedVersion);
   const outcome=await ports.submit({kind:"update",id,expectedVersion:draft.expectedVersion,data:draft.data,idempotencyKey:key},signal);
   if(outcome.state==="denied"||outcome.state==="invalid"||outcome.state==="conflict"){
    fence.uncertain.delete(id);return {status:outcome.state};
   }
   if(outcome.state!=="verified"||signal.aborted||!ports.canEdit(request)||
    outcome.record.id!==id||outcome.record.version!==draft.expectedVersion+1||
    outcome.record.status!=="ACTIVE"||outcome.record.code!==draft.data.code)return {status:"uncertain"};
   fence.uncertain.delete(id);
   return {status:"saved",version:String(outcome.record.version)};
  }catch{return {status:submitted?"uncertain":"unavailable"};}
  finally{fence.pending.delete(id);}
 };
}
