import { readSpecialtyV2Detail } from "./ho-specialty-v2-reader";
import { loadMissionForEdit } from "@/app/ho/learning/missions/read-edit";

/** PAP-1495 / PAP-1491 S4: actual Core IDs and verified Mission read, no writes. */
export type SpecialtyS4Mission = {
  id:string; code:string|null; name:string|null; status:"ACTIVE"|"INACTIVE"|null;
};
export type SpecialtyS4Level = {
  id:string; name:string; order:number; missions:readonly SpecialtyS4Mission[];
};
export type SpecialtyS4Read = {
  specialtyId:string; levels:readonly SpecialtyS4Level[]; distinctMissionCount:number;
};
export async function loadSpecialtyS4Read(
  id:string,fetcher:typeof fetch,signal:AbortSignal,
):Promise<SpecialtyS4Read>{
  const detail=await readSpecialtyV2Detail(id,fetcher,signal);
  signal.throwIfAborted();
  const ids=[...new Set(detail.levels.flatMap(level=>level.missionIds))];
  const missionRows=await Promise.all(ids.map(async missionId=>{
    const result=await loadMissionForEdit(missionId,fetcher,signal);
    signal.throwIfAborted();
    // Never resolve an incompatible-Path Mission as a valid link.
    if(result.state!=="ready"||result.data.pathProgramId!==detail.pathProgramId)
      return {id:missionId,code:null,name:null,status:null} satisfies SpecialtyS4Mission;
    return {id:missionId,code:result.data.code,name:result.data.name,status:result.data.status} satisfies SpecialtyS4Mission;
  }));
  const byId=new Map(missionRows.map(m=>[m.id,m]));
  return {specialtyId:detail.id,distinctMissionCount:ids.length,
    levels:detail.levels
      .map(level=>({id:level.id,name:level.name,order:level.order,
        missions:level.missionIds.map(mid=>byId.get(mid)!)
      })).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))};
}
