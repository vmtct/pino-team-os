import {BoApiError} from "./bo-api-error";

/** PAP-1495 / PAP-1491 SPEC-UNLOCK: client trusts only actual Founder V2 data.
 * No commercial V1 fallback, invented Mission counts or fake empty success.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type Status="DRAFT"|"ACTIVE"|"ARCHIVED";
export type SpecialtyV2Summary={
 id:string;pathProgramId:string;name:string;description:string|null;status:Status;
 tags:string[];version:number;missionCountDistinct:number;
};
export type SpecialtyV2Detail=SpecialtyV2Summary&{
 prerequisiteIds:string[];
 levels:{id:string;order:number;name:string;missionIds:string[]}[];
};
const record=(x:unknown):x is Record<string,unknown>=>Boolean(x)&&typeof x==="object"&&!Array.isArray(x);
export function parseSpecialtySummary(x:unknown):SpecialtyV2Summary|null{
 if(!record(x)||typeof x.id!=="string"||!uuid.test(x.id)||
   typeof x.pathProgramId!=="string"||!uuid.test(x.pathProgramId)||
   typeof x.name!=="string"||!x.name.trim()||x.name.length>160||
   !(x.description===null||(typeof x.description==="string"&&x.description.length<=4000))||
   !["DRAFT","ACTIVE","ARCHIVED"].includes(String(x.status))||
   !Array.isArray(x.tags)||!x.tags.every(t=>typeof t==="string")||
   !Number.isSafeInteger(x.version)||Number(x.version)<1||
   !Number.isSafeInteger(x.missionCountDistinct)||Number(x.missionCountDistinct)<0)return null;
 return {id:x.id,pathProgramId:x.pathProgramId,name:x.name,description:x.description as string|null,
  status:x.status as Status,tags:x.tags as string[],version:Number(x.version),missionCountDistinct:Number(x.missionCountDistinct)};
}
export function parseSpecialtyDetail(x:unknown):SpecialtyV2Detail|null{
 const summary=parseSpecialtySummary(x);if(!summary||!record(x)||
  !Array.isArray(x.prerequisiteIds)||!x.prerequisiteIds.every(id=>typeof id==="string"&&uuid.test(id))||
  !Array.isArray(x.levels)||!x.levels.every(l=>record(l)&&typeof l.id==="string"&&uuid.test(l.id)&&
    Number.isSafeInteger(l.order)&&Number(l.order)>=1&&typeof l.name==="string"&&
    l.name.trim().length>0&&Array.isArray(l.missionIds)&&l.missionIds.every(id=>typeof id==="string"&&uuid.test(id))))return null;
 return {...summary,prerequisiteIds:x.prerequisiteIds as string[],
  levels:(x.levels as Record<string,unknown>[]).map(l=>({id:l.id as string,order:Number(l.order),
   name:l.name as string,missionIds:l.missionIds as string[]}))};
}
async function getData(url:string,fetcher:typeof fetch,signal:AbortSignal):Promise<unknown>{
 const response=await fetcher(url,{method:"GET",signal,credentials:"same-origin",cache:"no-store",redirect:"error"});
 signal.throwIfAborted();
 if(!response.ok)throw new BoApiError(response.status,response.status===403?"Không có quyền xem Chuyên đề.":"Chưa tải được Chuyên đề.",response.headers.get("x-request-id"));
 const envelope:unknown=await response.json();signal.throwIfAborted();
 if(!record(envelope)||!("data" in envelope))throw new BoApiError(502,"Core trả dữ liệu Chuyên đề không hợp lệ.",null);
 return envelope.data;
}
export async function readSpecialtyV2List(fetcher:typeof fetch,signal:AbortSignal):Promise<SpecialtyV2Summary[]>{
 const result:SpecialtyV2Summary[]=[];
 const ids=new Set<string>();
 // The approved TDD table uses local UI pagination. Never silently truncate Core Catalog.
 for(let page=0;page<10;page++){
  const data=await getData("/api/ho/learning/specialties?limit=100&offset="+result.length,fetcher,signal);
  if(!Array.isArray(data))throw new BoApiError(502,"Core trả danh sách Chuyên đề không hợp lệ.",null);
  for(const item of data){
   const parsed=parseSpecialtySummary(item);
   if(!parsed||ids.has(parsed.id))throw new BoApiError(502,"Core trả danh sách Chuyên đề không hợp lệ.",null);
   ids.add(parsed.id);result.push(parsed);
  }
  if(data.length<100)return result;
 }
 throw new BoApiError(503,"Danh mục Chuyên đề vượt giới hạn tải.",null);
}
export async function readSpecialtyV2Detail(id:string,fetcher:typeof fetch,signal:AbortSignal):Promise<SpecialtyV2Detail>{
 if(!uuid.test(id))throw new BoApiError(404,"Chuyên đề không hợp lệ.",null);
 const data=await getData("/api/ho/learning/specialties/"+id,fetcher,signal);
 const parsed=parseSpecialtyDetail(data);
 if(!parsed||parsed.id!==id)throw new BoApiError(502,"Core trả chi tiết Chuyên đề không hợp lệ.",null);
 return parsed;
}
