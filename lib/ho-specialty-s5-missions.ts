import {BoApiError} from "./bo-api-error";
import {loadHoA1} from "./ho-a1";
import type {BoRecord} from "./bo-registration";
import type {SpecialtyMissionOption} from "./specialty-mission-picker";
import type {SpecialtyV2Detail} from "./ho-specialty-v2-reader";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function mapVerifiedSpecialtyMissionOptions(records:readonly BoRecord[],detail:SpecialtyV2Detail):SpecialtyMissionOption[]{
 if(!uuid.test(detail.pathProgramId))throw new BoApiError(502,"Path Chuyên đề không hợp lệ.",null);
 const ids=new Set<string>(),result:SpecialtyMissionOption[]=[];
 for(const record of records){
  if(typeof record.id!=="string"||!uuid.test(record.id)||ids.has(record.id)||
    typeof record.code!=="string"||!record.code.trim()||
    typeof record.name!=="string"||!record.name.trim()||
    !["ACTIVE","INACTIVE"].includes(String(record.status))||
    (record.pathProgramId!==null&&record.pathProgramId!==undefined&&
     (typeof record.pathProgramId!=="string"||!uuid.test(record.pathProgramId))))
   throw new BoApiError(502,"Danh mục Mission thiếu dữ liệu Core hợp lệ.",null);
  ids.add(record.id);
  // Existing BO Canonical Mission Catalog is a permitted HO-origin read. Do not fabricate READY.
  const state=record.reconciliation==="READY"?"READY":"PENDING";
  result.push({id:record.id,code:record.code,name:record.name,
    pathProgramId:record.pathProgramId as string|null|undefined??null,
    status:record.status as "ACTIVE"|"INACTIVE",reconciliation:state});
 }
 return result;
}
export async function loadSpecialtyS5MissionCatalog(
 detail:SpecialtyV2Detail,fetcher:typeof fetch,signal:AbortSignal,
):Promise<SpecialtyMissionOption[]>{
 signal.throwIfAborted();
 const records=await loadHoA1("missions",async (input,init)=>{
  const response=await fetcher(input,{...init,credentials:"same-origin",redirect:"error",signal});
  signal.throwIfAborted();
  return response;
 });
 return mapVerifiedSpecialtyMissionOptions(records,detail);
}
