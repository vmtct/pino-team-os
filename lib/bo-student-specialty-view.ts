/** PAP-1496 / SPEC-UNLOCK S2/S3. BO Student Specialty view-model only.
 * Never treats commercial Specialty V1, grants, Diary or Assignment as completion.
 * Only Core/PAP-1519 may assert verified Mission Result-derived progress.
 */
export interface BoStudentSpecialtyView {
  specialtyId: string;
  name: string;
  pathProgramId: string;
  grant: { id:string; startDate:string; version:number } | null;
  grantEffective: boolean;
  progress: {
    completedDistinctMissionCount:number;
    totalDistinctMissionCount:number;
    completionStatus:"NOT_COMPLETED"|"COMPLETED";
    missingMissionIds:readonly string[];
  };
  canGrant: boolean;
  grantBlockReasons: readonly string[];
}
export type BoStudentSpecialtyStatus =
  "LOCKED" | "PENDING_EFFECTIVE_DATE" | "UNLOCKED" | "COMPLETED";
function isRecord(value:unknown):value is Record<string,unknown>{
  return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
}
export function validateBoStudentSpecialtyList(payload:unknown):BoStudentSpecialtyView[]{
  if(!Array.isArray(payload))throw new TypeError("STUDENT_SPECIALTIES_NOT_LOADED");
  const seen=new Set<string>();
  return payload.map(item=>{
    if(!isRecord(item))throw new TypeError("STUDENT_SPECIALTY_INVALID");
    const {specialty,grant,grantEffective,progress,canGrant,grantBlockReasons}=item;
    if(!isRecord(specialty)||typeof specialty.id!=="string"||!specialty.id.trim()||
       typeof specialty.name!=="string"||!specialty.name.trim()||
       typeof specialty.pathProgramId!=="string"||!specialty.pathProgramId.trim()||
       !isRecord(progress)||
       typeof progress.completedDistinctMissionCount!=="number"||
       typeof progress.totalDistinctMissionCount!=="number"||
       !Number.isSafeInteger(progress.completedDistinctMissionCount)||
       !Number.isSafeInteger(progress.totalDistinctMissionCount)||
       progress.completedDistinctMissionCount<0||progress.totalDistinctMissionCount<0||
       progress.completedDistinctMissionCount>progress.totalDistinctMissionCount||
       !Array.isArray(progress.missingMissionIds)||
       (progress.completionStatus!=="COMPLETED"&&progress.completionStatus!=="NOT_COMPLETED")||
       typeof grantEffective!=="boolean"||typeof canGrant!=="boolean"||
       !Array.isArray(grantBlockReasons))
      throw new TypeError("STUDENT_SPECIALTY_CONTRACT_INVALID");
    if(seen.has(specialty.id))throw new TypeError("DUPLICATE_SPECIALTY");
    seen.add(specialty.id);
    if(!progress.missingMissionIds.every((id:unknown)=>typeof id==="string"&&Boolean(id.trim()))||
       !grantBlockReasons.every((reason:unknown)=>typeof reason==="string"))
      throw new TypeError("STUDENT_SPECIALTY_CONTRACT_INVALID");
    const missingIds=[...new Set(progress.missingMissionIds as string[])];
    if(missingIds.length!==progress.totalDistinctMissionCount-progress.completedDistinctMissionCount||
       (progress.completionStatus==="COMPLETED")!==(progress.totalDistinctMissionCount>0&&missingIds.length===0))
      throw new TypeError("STUDENT_SPECIALTY_PROGRESS_CONFLICT");
    let recordGrant:BoStudentSpecialtyView["grant"]=null;
    if(grant!==null){
      if(!isRecord(grant)||typeof grant.id!=="string"||!grant.id.trim()||
         typeof grant.startDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(grant.startDate)||
         !Number.isSafeInteger(grant.version)||typeof grant.version!=="number"||grant.version<1)
        throw new TypeError("STUDENT_SPECIALTY_GRANT_INVALID");
      recordGrant={id:grant.id,startDate:grant.startDate,version:grant.version};
    }
    if((!recordGrant&&grantEffective)||(recordGrant&&canGrant))
      throw new TypeError("STUDENT_SPECIALTY_GRANT_CONFLICT");
    return {
      specialtyId:specialty.id,name:specialty.name,pathProgramId:specialty.pathProgramId,
      grant:recordGrant,grantEffective,
      progress:{
        completedDistinctMissionCount:progress.completedDistinctMissionCount,
        totalDistinctMissionCount:progress.totalDistinctMissionCount,
        completionStatus:progress.completionStatus,
        missingMissionIds:missingIds,
      },
      canGrant,grantBlockReasons:grantBlockReasons as string[],
    };
  });
}
export function boStudentSpecialtyStatus(state:BoStudentSpecialtyView):BoStudentSpecialtyStatus{
  if(!state.grant)return "LOCKED";
  if(!state.grantEffective)return "PENDING_EFFECTIVE_DATE";
  if(state.progress.completionStatus==="COMPLETED")return "COMPLETED";
  return "UNLOCKED";
}
export function boStudentSpecialtyStatusText(status:BoStudentSpecialtyStatus):string{
  return ({
    LOCKED:"Chưa mở khóa",PENDING_EFFECTIVE_DATE:"Chờ hiệu lực",
    UNLOCKED:"Đang thực hiện",COMPLETED:"Hoàn thành",
  })[status];
}
