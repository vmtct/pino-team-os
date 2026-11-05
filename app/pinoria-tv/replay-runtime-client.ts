import { isValidClaimedTvPresentation } from "./presentation-client";
import type { PinoriaPresentation } from "./presentation-types";

const COMMAND_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type PendingTvReplay={id:string;centerId:string;displayId:string;sessionId:string;presentationId:string;revision:number};
export type TvReplayProjection={commandId:string;revision:number;presentation:PinoriaPresentation};
function validPending(value:unknown):value is PendingTvReplay{
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const v=value as Record<string,unknown>;
  return typeof v.id==="string"&&COMMAND_ID.test(v.id)&&
    typeof v.centerId==="string"&&!!v.centerId&&
    typeof v.displayId==="string"&&!!v.displayId&&
    typeof v.sessionId==="string"&&!!v.sessionId&&
    typeof v.presentationId==="string"&&!!v.presentationId&&
    Number.isSafeInteger(v.revision)&&typeof v.revision==="number"&&v.revision>0;
}
async function postReplay(apiBase:string,body:Record<string,unknown>):Promise<unknown>{
  const response=await fetch(`${apiBase}/presentation`,{method:"POST",cache:"no-store",
    headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  if(!response.ok)throw new Error(`TV replay runtime unavailable (${response.status})`);
  return response.json();
}
/** Only read a pending session-scoped command; never acknowledge it here. */
export async function pollPendingReplay(apiBase:string):Promise<PendingTvReplay|null>{
  const result=await postReplay(apiBase,{op:"replay-pending"}) as {data?:{pending?:unknown}};
  const pending=result.data?.pending;
  if(pending===null)return null;
  if(!validPending(pending))throw new Error("Invalid authenticated replay command");
  return pending;
}
/** Read immutable active projection without claiming/consuming the event. */
export async function loadReplayProjection(apiBase:string,command:PendingTvReplay):Promise<TvReplayProjection>{
  const result=await postReplay(apiBase,{op:"replay-projection",commandId:command.id}) as {data?:unknown};
  const data=result.data;
  if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("Invalid replay projection envelope");
  const projection=data as Record<string,unknown>;
  if(projection.commandId!==command.id||projection.revision!==command.revision||
    !isValidClaimedTvPresentation(projection.presentation)||
    projection.presentation.id!==command.presentationId){
    throw new Error("Replay projection does not match pending command");
  }
  return projection as TvReplayProjection;
}
/** ACK must only be invoked by the renderer after visual replay is committed. */
export async function acknowledgeRenderedReplay(apiBase:string,command:PendingTvReplay):Promise<void>{
  const result=await postReplay(apiBase,{op:"replay-ack",commandId:command.id,revision:command.revision}) as {data?:{acknowledged?:boolean}};
  if(result.data?.acknowledged!==true)throw new Error("TV replay ACK not confirmed");
}
