/**
 * PAP-946 — typed Training V5 Core contract from PAP-848/849.
 * IMPORTANT: Those upstream PRs are unmerged. This client must never assume
 * Training V5 is deployed or synthesize eligibility/certificates locally.
 */
export interface TrainingV5CatalogItem {
 moduleId:string;code:string;title:string;summary:string;description:string;
 path:string;track:string;popular:boolean;popularityRank:number;minHours:number;
 guideUrl:string|null;active:boolean;revision:number;prerequisiteModuleIds:string[];
 createdAt:string;updatedAt:string;
}
export type TrainingV5CatalogPage={
 items:TrainingV5CatalogItem[];total:number;limit:number;offset:number;
};
export type TrainingV5RegistrationStatus=
 "REQUESTED"|"ACCEPTED"|"IN_TRAINING"|"COMPLETED"|"CANCELLED";
export interface TrainingV5Registration{
 id:string;moduleId:string;staffMemberId:string;
 status:TrainingV5RegistrationStatus;requestedAt:string;cancelledAt:string|null;
 completedAt:string|null;revision:number;updatedAt:string;
}
export interface TrainingV5Eligibility{
 moduleId:string;eligible:boolean;confirmedHours:number;requiredHours:number;
 missingHours:number;missingPrerequisiteModuleIds:string[];
 reason:"READY"|"INACTIVE"|"INSUFFICIENT_HOURS"|"MISSING_PREREQUISITES";
}
export class TrainingV5ApiError extends Error{
 constructor(readonly status:number,readonly code:string,message:string){
  super(message);this.name="TrainingV5ApiError";
 }
}
/** Operations cannot be admitted until the exact source-owned Core version is live. */
export const TRAINING_V5_WRITE_ADMITTED=false;
const root="/api/workforce/training/v5";
async function read<T>(route:string):Promise<T>{
 const response=await fetch(root+route,{cache:"no-store",method:"GET"});
 const body=await response.json().catch(()=>null) as {data?:T;error?:{code?:string;message?:string}}|null;
 if(!response.ok||body?.data===undefined)
  throw new TrainingV5ApiError(response.status,body?.error?.code??"CORE_V5_UNAVAILABLE",
   body?.error?.message??"Training V5 hiện chưa sẵn sàng.");
 return body.data;
}
export const tosTrainingV5Api={
 catalog:(input:{query?:string;path?:string;popularOnly?:boolean;limit?:number;offset?:number}={})=>{
  const params=new URLSearchParams();
  if(input.query?.trim())params.set("query",input.query.trim());
  if(input.path?.trim())params.set("path",input.path.trim());
  if(input.popularOnly)params.set("popularOnly","true");
  params.set("limit",String(input.limit??30));
  params.set("offset",String(input.offset??0));
  return read<TrainingV5CatalogPage>("/catalog?"+params.toString());
 },
 registrations:()=>read<TrainingV5Registration[]>("/registrations"),
 eligibility:(moduleId:string)=>{
  if(!moduleId.trim())return Promise.reject(new TrainingV5ApiError(400,"INVALID_MODULE","Thiếu mã Training."));
  return read<TrainingV5Eligibility>("/eligibility?moduleId="+encodeURIComponent(moduleId.trim()));
 },
 /** Refuse every write while source-owned contracts remain unmerged. */
 register:async (_moduleId:string,_idempotencyKey:string):Promise<never>=>{
  throw new TrainingV5ApiError(503,"CORE_V5_WRITE_NOT_ADMITTED","Chưa mở đăng ký Training V5.");
 },
 cancel:async (_registrationId:string,_expectedRevision:number,_idempotencyKey:string):Promise<never>=>{
  throw new TrainingV5ApiError(503,"CORE_V5_WRITE_NOT_ADMITTED","Chưa mở hủy đăng ký Training V5.");
 },
};
