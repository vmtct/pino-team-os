/** PAP-945 / PAP-727: resumable Diary -> Mission-link workflow.
 * This is a typed command coordinator, NOT an authorization decision or an enabled UI write path.
 * The injected TOS transport remains fail-closed in Staging until the actual runtime is admitted.
 * PAP-1204 MissionResult/Progression writes never enter this workflow.
 */
import {V18bCoreError, type V18bDiaryMissionLink, type createV18bApiTransport} from "./tos-classroom-v18b-api";

type Client=Pick<ReturnType<typeof createV18bApiTransport>,"register"|"missionLinks"|"linkMission">;
type RegisterInput=Parameters<Client["register"]>[0];
export type MissionChoice={missionId:string;assignmentId?:string|null};
export type MissionLinkPlan={
 diaryId:string;centerId:string;submissionKey:string;
 selected:readonly MissionChoice[];
};
export type LinkOutcome={
 state:"LINK_PENDING"|"LINK_VERIFIED";plan:MissionLinkPlan;
 verifiedMissionIds:string[];pendingMissionIds:string[];
 errorCode?:string;errorMessage?:string;
};
export type CreateOutcome=LinkOutcome|{
 state:"REGISTER_UNCERTAIN";diaryId:null;submissionKey:string;
 errorCode:string;errorMessage:string;
};

function issue(error:unknown){
 if(error instanceof V18bCoreError)return {errorCode:error.code,errorMessage:error.message};
 return {errorCode:"DIARY_LINK_TRANSPORT_UNCERTAIN",
  errorMessage:"Chưa xác minh được thao tác tại Core. Không tạo Diary thứ hai khi chưa đối soát."};
}
function requireString(value:string,field:string){
 if(typeof value!=="string"||!value.trim()||value.length>160)
  throw new V18bCoreError(400,"DIARY_"+field+"_INVALID","Dữ liệu "+field+" không hợp lệ.");
 return value.trim();
}
/** Eligible set is rendered from a real, scoped Core catalog, NOT a security boundary.
 * Core independently checks Center, Student, Mission, Assignment and actor.
 */
export function validateMissionLinkChoices(
 selected:readonly MissionChoice[],eligibleMissionIds:readonly string[],
):MissionChoice[]{
 if(!Array.isArray(selected)||!selected.length)
  throw new V18bCoreError(400,"DIARY_MISSION_REQUIRED","Cần chọn ít nhất một Nhiệm vụ.");
 if(!Array.isArray(eligibleMissionIds))
  throw new V18bCoreError(503,"DIARY_MISSION_CATALOG_UNAVAILABLE","Chưa có danh sách Nhiệm vụ hợp lệ từ Core.");
 const permitted=new Set(eligibleMissionIds);
 const seen=new Set<string>();
 return selected.map(choice=>{
  const missionId=requireString(choice?.missionId,"MISSION");
  if(!permitted.has(missionId))
   throw new V18bCoreError(403,"DIARY_MISSION_NOT_ELIGIBLE","Nhiệm vụ không thuộc danh sách được phép.");
  if(seen.has(missionId))
   throw new V18bCoreError(409,"DIARY_DUPLICATE_MISSION","Không chọn trùng Nhiệm vụ.");
  seen.add(missionId);
  const assignmentId=choice.assignmentId==null?null:requireString(choice.assignmentId,"ASSIGNMENT");
  return {missionId,...(assignmentId?{assignmentId}:{})};
 });
}
function pending(plan:MissionLinkPlan,confirmed:string[],error:unknown):LinkOutcome{
 const status=issue(error);
 return {state:"LINK_PENDING",plan,verifiedMissionIds:confirmed,
  pendingMissionIds:plan.selected.map(x=>x.missionId).filter(id=>!confirmed.includes(id)),...status};
}
function checkedLinks(records:V18bDiaryMissionLink[],plan:MissionLinkPlan){
 if(!Array.isArray(records)||records.some(r=>r.diaryId!==plan.diaryId))
  throw new V18bCoreError(502,"DIARY_LINK_READBACK_MISMATCH","Liên kết từ Core không khớp Diary.");
 return new Set(records.map(x=>x.missionId));
}
/** Resumes ONLY Mission-link writes to the original Diary ID.
 * Reads before POST and after POST; an ambiguous response remains PENDING.
 * The caller must retain the plan and rehydrate it after reload via a real Diary read.
 */
export async function resumeDiaryMissionLinks(client:Client,plan:MissionLinkPlan):Promise<LinkOutcome>{
 const diaryId=requireString(plan.diaryId,"ID"),centerId=requireString(plan.centerId,"CENTER");
 const submissionKey=requireString(plan.submissionKey,"SUBMISSION_KEY");
 if(!plan.selected?.length)throw new V18bCoreError(400,"DIARY_MISSION_REQUIRED","Cần chọn ít nhất một Nhiệm vụ.");
 const seen=new Set<string>();
 for(const choice of plan.selected){
  const id=requireString(choice.missionId,"MISSION");
  if(seen.has(id))throw new V18bCoreError(409,"DIARY_DUPLICATE_MISSION","Không chọn trùng Nhiệm vụ.");
  seen.add(id);
 }
 const canonical={diaryId,centerId,submissionKey,selected:plan.selected};
 let confirmed:string[]=[];
 try{
  let links=checkedLinks(await client.missionLinks(diaryId,centerId),canonical);
  confirmed=[...seen].filter(id=>links.has(id));
  for(const choice of plan.selected){
   if(links.has(choice.missionId))continue;
   const receipt=await client.linkMission(diaryId,
    {centerId,missionId:choice.missionId,assignmentId:choice.assignmentId},
    "pap945:"+submissionKey+":link:"+choice.missionId);
   if(receipt.diaryId!==diaryId||receipt.missionId!==choice.missionId)
    throw new V18bCoreError(502,"DIARY_LINK_RECEIPT_MISMATCH","Core không xác nhận đúng liên kết.");
  }
  // All successful POST responses are insufficient: require durable readback.
  links=checkedLinks(await client.missionLinks(diaryId,centerId),canonical);
  confirmed=[...seen].filter(id=>links.has(id));
  if(confirmed.length!==seen.size)
   throw new V18bCoreError(503,"DIARY_LINK_READBACK_INCOMPLETE","Chưa xác minh đủ liên kết Mission.");
  return {state:"LINK_VERIFIED",plan:canonical,verifiedMissionIds:confirmed,pendingMissionIds:[]};
 }catch(error){return pending(canonical,confirmed,error);}
}
/** A rejected/ambiguous Register has no safe retry without server reconciliation.
 * A known saved Diary ID is never discarded when subsequent Mission linking fails.
 */
export async function createDiaryWithMissionLinks(
 client:Client,request:{
  registration:RegisterInput;submissionKey:string;
  selected:readonly MissionChoice[];eligibleMissionIds:readonly string[];
 },
):Promise<CreateOutcome>{
 const selected=validateMissionLinkChoices(request.selected,request.eligibleMissionIds);
 const centerId=requireString(request.registration.centerId,"CENTER");
 const submissionKey=requireString(request.submissionKey,"SUBMISSION_KEY");
 let diaryId:string;
 try{
  const diary=await client.register(request.registration,"pap945:"+submissionKey+":register");
  diaryId=requireString(diary.id,"ID");
 }catch(error){
  return {state:"REGISTER_UNCERTAIN",diaryId:null,submissionKey,...issue(error)};
 }
 return resumeDiaryMissionLinks(client,{diaryId,centerId,submissionKey,selected});
}
