/** PAP-2147: only a successful selected-Center Core list admits navigation. */
import {mapGuest} from "./provider";
export async function canOpenGuests(centerId:string,signal:AbortSignal,fetcher:typeof fetch=fetch){
 if(signal.aborted)return false;
 try{
  const response=await fetcher("/api/bo/identity/mytime-guests?"+new URLSearchParams({centerId,limit:"1"}),{signal,credentials:"same-origin",cache:"no-store",redirect:"error"});
  if(!response.ok||signal.aborted)return false;
  const {data}=await response.json();
  if(data?.scopeCenterId!==centerId||!Array.isArray(data.guests)||data.guests.length>1)return false;
  data.guests.forEach((v:unknown)=>mapGuest(v,centerId));return !signal.aborted;
 }catch{return false;}
}
