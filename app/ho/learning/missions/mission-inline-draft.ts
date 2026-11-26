/** PAP-2394 / HO-MISSION-CRUD — pure inline command preparation, no transport or authorization. */
import type { MissionEditLoad } from "./read-edit";
import type { MissionInput } from "./command";
import { isMissionCategory } from "./mission-category";
import { normalizeMissionSupplementalUrl } from "./mission-supplemental-url";
import { validateMissionCreate } from "./MissionCreateFields";
import { validateMissionSelectedPath, type MissionPathChoice } from "./mission-path-options";
export type MissionInlineDraft =
 | {status:"ready";id:string;expectedVersion:number;data:MissionInput}
 | {status:"denied"|"conflict"|"invalid"};
export function prepareMissionInlineDraft(current:MissionEditLoad,id:string,patch:unknown,expectedVersion:string,paths:readonly MissionPathChoice[]):MissionInlineDraft{
 if(current.state!=="ready"||current.id!==id||current.data.status!=="ACTIVE")return {status:"denied"};
 if(String(current.version)!==expectedVersion)return {status:"conflict"};
 if(!patch||typeof patch!=="object"||Array.isArray(patch))return {status:"invalid"};
 const entries=Object.entries(patch);if(entries.length!==1)return {status:"invalid"};
 const [key,value]=entries[0]!;let data:MissionInput={...current.data};
 switch(key){
  case "name":case "code":
   if(typeof value!=="string")return {status:"invalid"};
   data={...data,[key]:key==="code"?value.trim().toUpperCase():value.trim()};break;
  case "category":
   if(!isMissionCategory(value))return {status:"invalid"};
   data={...data,category:value};break;
  case "level":case "plsValue":
   if(typeof value!=="number"||!Number.isSafeInteger(value))return {status:"invalid"};
   data={...data,[key]:value};break;
  case "path":{
   const choice=paths.find(p=>p.label===value);if(!choice)return {status:"invalid"};
   data={...data,pathProgramId:choice.id,pathKeySnapshot:choice.code};break;
  }
  case "description":case "guideline":
   if(value!==null&&typeof value!=="string")return {status:"invalid"};
   data={...data,[key]:value||null};break;
  case "supplementalUrl":{
   const url=normalizeMissionSupplementalUrl(value);if(!url.ok)return {status:"invalid"};
   data={...data,supplementalUrl:url.value};break;
  }
  default:return {status:"invalid"};
 }
 if((data.category!==null&&!isMissionCategory(data.category))||!normalizeMissionSupplementalUrl(data.supplementalUrl).ok||
    validateMissionCreate(data,false)||validateMissionSelectedPath(data,paths))return {status:"invalid"};
 return {status:"ready",id,expectedVersion:current.version,data};
}
