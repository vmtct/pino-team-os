/** PAP-1495 / PAP-1491 S5 — pure Founder-approved Overview edit projection.
 * Preserve Core canonical ids, fail closed on ambiguous/missing relation labels.
 */
import {BoApiError} from "./bo-api-error";
import type {SpecialtyV2Detail,SpecialtyV2Summary} from "./ho-specialty-v2-reader";
import type {SpecialtyGraphCommand} from "./ho-specialty-v2-graph-client";
export type SpecialtyS5OverviewKey="levelCount"|"prerequisiteView"|"tagView";
export type SpecialtyS5Option={id:string;label:string};
export function eligibleSpecialtyPrerequisites(detail:SpecialtyV2Detail,list:readonly SpecialtyV2Summary[]):SpecialtyS5Option[]{
 const eligible=list.filter(v=>v.pathProgramId===detail.pathProgramId&&v.id!==detail.id);
 const counts=new Map<string,number>();
 for(const item of eligible)counts.set(item.name,(counts.get(item.name)??0)+1);
 return eligible.map(v=>({id:v.id,label:(counts.get(v.name)??0)>1?v.name+" · "+v.id.slice(0,8):v.name}));
}
function invalid():never{throw new BoApiError(400,"Giá trị chỉnh sửa Chuyên đề không hợp lệ.",null);}
export function planSpecialtyOverviewEdit(
 detail:SpecialtyV2Detail,list:readonly SpecialtyV2Summary[],field:SpecialtyS5OverviewKey,value:unknown,
):Extract<SpecialtyGraphCommand,{type:"SET_OVERVIEW"}>{
 if(detail.status!=="DRAFT")throw new BoApiError(409,"Chỉ cho phép sửa Chuyên đề bản nháp.",null);
 let levelCount=detail.levels.length,prerequisiteIds=[...detail.prerequisiteIds],tags=[...detail.tags];
 if(field==="levelCount"){
  if(typeof value!=="number"||!Number.isSafeInteger(value)||value<1||value>12)invalid();
  levelCount=value;
 }else if(field==="prerequisiteView"){
  if(!Array.isArray(value)||value.length>20||!value.every(v=>typeof v==="string"))invalid();
  const options=eligibleSpecialtyPrerequisites(detail,list);
  const byLabel=new Map(options.map(x=>[x.label,x.id]));
  prerequisiteIds=(value as string[]).map(label=>byLabel.get(label)??invalid());
  if(new Set(prerequisiteIds).size!==prerequisiteIds.length)invalid();
 }else if(field==="tagView"){
  if(!Array.isArray(value)||value.length>20||!value.every(t=>typeof t==="string"))invalid();
  tags=(value as string[]).map(v=>v.trim());
  if(tags.some(v=>v.length<1||v.length>48)||new Set(tags.map(t=>t.normalize("NFD").toLocaleLowerCase("vi"))).size!==tags.length)invalid();
 }else invalid();
 return {type:"SET_OVERVIEW",expectedVersion:detail.version,levelCount,prerequisiteIds,tags};
}
