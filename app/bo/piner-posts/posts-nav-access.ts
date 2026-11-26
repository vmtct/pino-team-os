/** PAP-2134 / PAP-2386: actual actor and selected-Center view before bounded Post list probe. */
import {coreDraftClient} from "./core-draft-client";
import {nativePostId} from "./native-post-query";
const actorId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function canOpenPosts(centerId:string,signal:AbortSignal,fetcher:typeof fetch=fetch){
 if(signal.aborted||!nativePostId(centerId))return false;
 try{
  const response=await fetcher("/api/bo/context?"+new URLSearchParams({centerId}),{method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal});
  if(!response.ok||signal.aborted)return false;
  const value=(await response.json() as {data?:{userId?:unknown;surface?:unknown;entitled?:unknown;permissionKeys?:unknown}}).data;
  if(!value||typeof value.userId!=="string"||!actorId.test(value.userId)||value.surface!=="BO"||value.entitled!==true||!Array.isArray(value.permissionKeys)||!value.permissionKeys.includes("piner.post.view"))return false;
  const actor=value.userId;
  const scoped:typeof fetch=(input,init)=>{const headers=new Headers(init?.headers);headers.set("x-pino-expected-actor",actor);return fetcher(input,{...init,headers});};
  await coreDraftClient(centerId,scoped).list(signal,undefined,1);return !signal.aborted;
 }catch{return false;}
}
