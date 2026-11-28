/** PAP-2425: exact canonical staging review route; never a source of authority. */
import {parseAssignmentStageReview} from "./assignment-stage-admission";
import {ASSIGNMENT_M1_ROUTE} from "./assignment-m1-fixture";

export const ASSIGNMENT_STAGE_ORIGIN="https://bo.staging.pinohouse.art";
export type AssignmentStageReviewEnv={APP_ENV?:string;BO_UI_ONLY?:string;BO_MISSION_ASSIGNMENT_M1_REVIEW?:string};
export function assignmentStageReviewEnabled(env:AssignmentStageReviewEnv,host:string){
 return env.APP_ENV==="staging"&&env.BO_UI_ONLY==="enabled"&&env.BO_MISSION_ASSIGNMENT_M1_REVIEW==="enabled"&&host==="bo.staging.pinohouse.art";
}
const reviewPermissions=["team.bo.access","student.mission_assignment.view","student.mission_assignment.manage"];
export function hasAssignmentStageReviewPermissions(keys:readonly string[]){
 return reviewPermissions.every(key=>keys.includes(key));
}
export function assignmentStageSearchParams(query:Record<string,string|string[]|undefined>){
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries(query)){
  if(typeof value==="string")params.append(key,value);
  else if(Array.isArray(value))for(const item of value)params.append(key,item);
 }
 return params;
}
/** Bare module entry is allowed only to request Center selection, not fixture access. */
export function assignmentStageReviewUrl(input:URLSearchParams,legacy=false):URL|null{
 const params=new URLSearchParams(input);
 if(legacy){
  if(params.getAll("module").length!==1||params.get("module")!=="missions")return null;
  params.delete("module");
 }
 const url=new URL(ASSIGNMENT_M1_ROUTE,ASSIGNMENT_STAGE_ORIGIN);
 if(params.size===0)return url;
 url.search=params.toString();
 return parseAssignmentStageReview(url)?url:null;
}
