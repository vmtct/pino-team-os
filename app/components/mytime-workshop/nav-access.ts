// PAP-2164: navigation visible only after authoritative authorized scoped list.
import {isWorkshopId} from "./reference-codec";
import {parseWorkshopDto} from "./api-client";
export async function canOpenWorkshop(surface:"BO"|"HO",centerId:string|null,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<boolean>{
 if(signal.aborted||surface==="BO"&&!isWorkshopId(centerId)||surface==="HO"&&centerId!==null)return false;
 try{
  const scope=surface==="HO"?{surface:"HO" as const}:{surface:"BO" as const,centerId:centerId!};
  const q=new URLSearchParams({limit:"1"});
  if(scope.surface==="BO")q.set("centerId",scope.centerId);
  const response=await fetcher("/api/"+surface.toLowerCase()+"/learning/mytime-workshops?"+q,{signal,credentials:"same-origin",cache:"no-store",redirect:"error"});
  if(!response.ok||signal.aborted)return false;
  const body:unknown=await response.json();
  if(!body||typeof body!=="object"||!("data" in body))return false;
  const data=body.data as {scopeCenterId?:unknown;events?:unknown;nextBeforeId?:unknown};
  if(data?.scopeCenterId!==centerId||!Array.isArray(data.events)||data.events.length>1||!(data.nextBeforeId===null||isWorkshopId(data.nextBeforeId)))return false;
  const rows=data.events.map(v=>parseWorkshopDto(v,scope));
  return !signal.aborted&&(data.nextBeforeId===null||rows[0]?.id===data.nextBeforeId);
 }catch{return false;}
}
