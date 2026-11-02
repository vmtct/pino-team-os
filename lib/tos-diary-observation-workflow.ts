/** PAP-945 / PAP-727 — source-owned Diary observation + independent PAP-1254 Mission links.
 * Pure command coordination; this module is NOT an ACL gate or runtime write admission.
 * A known Diary ID must never be silently replaced after any partial failure.
 */
import {V18bCoreError,type V18bPathDiary,type createV18bApiTransport} from "./tos-classroom-v18b-api";
import {resumeDiaryMissionLinks,validateMissionLinkChoices,type MissionChoice,type LinkOutcome,type CreateOutcome} from "./tos-diary-mission-link-workflow";
import type {PreparedDiarySubmission} from "./tos-diary-submit-preflight";

type Client=Pick<ReturnType<typeof createV18bApiTransport>,"register"|"diary"|"saveDraft"|"missionLinks"|"linkMission">;
export type DiaryObservation={interest:number;notes:string;difficulty:string|null};
export type ObservationPlan={
 diaryId:string;centerId:string;studentId:string;teachingContextKey:string;pathKey:string;
 expectedVersion:number;submissionKey:string;selected:readonly MissionChoice[];
 observation:DiaryObservation;
};
export type ObservationPending={
 state:"OBSERVATION_PENDING";plan:ObservationPlan;
 errorCode:string;errorMessage:string;
};
export type ObservationOutcome=LinkOutcome|ObservationPending|CreateOutcome;

function identity(value:unknown,name:string){
 if(typeof value!=="string"||!value.trim()||value.length>160)
  throw new V18bCoreError(400,"DIARY_"+name+"_INVALID","Thiếu hoặc sai "+name+" của Nhật ký.");
 return value.trim();
}
function requireObservation(value:DiaryObservation):DiaryObservation{
 if(!value||!Number.isInteger(value.interest)||value.interest<1||value.interest>4)
  throw new V18bCoreError(400,"DIARY_INTEREST_INVALID","Chọn mức hứng thú 1–4.");
 if(typeof value.notes!=="string"||!value.notes.trim())
  throw new V18bCoreError(400,"DIARY_NOTES_REQUIRED","Cần ghi chú quan sát.");
 if(value.difficulty!==null&&typeof value.difficulty!=="string")
  throw new V18bCoreError(400,"DIARY_DIFFICULTY_INVALID","Thông tin khó khăn không hợp lệ.");
 if(value.interest===1&&!value.difficulty?.trim())
  throw new V18bCoreError(400,"DIARY_DIFFICULTY_REQUIRED","Mô tả khó khăn khi học viên phản kháng.");
 return {interest:value.interest,notes:value.notes.trim(),difficulty:value.difficulty?.trim()||null};
}
function problem(e:unknown){
 return e instanceof V18bCoreError?{errorCode:e.code,errorMessage:e.message}:{
  errorCode:"DIARY_OBSERVATION_TRANSPORT_UNCERTAIN",
  errorMessage:"Chưa đối soát được Nhật ký tại Core. Không tạo Diary mới hoặc ghi đè tự động.",
 };
}
function pending(plan:ObservationPlan,e:unknown):ObservationPending{
 return {state:"OBSERVATION_PENDING",plan,...problem(e)};
}
function checkIdentity(record:V18bPathDiary,plan:ObservationPlan){
 if(!record||record.id!==plan.diaryId||record.studentId!==plan.studentId||
   record.teachingContextKey!==plan.teachingContextKey||
   record.pathKey!==plan.pathKey||
   (record.centerId!==undefined&&record.centerId!==plan.centerId))
  throw new V18bCoreError(502,"DIARY_OBSERVATION_SCOPE_MISMATCH",
   "Core trả về Nhật ký không khớp Center, học viên, Path hoặc ngữ cảnh lớp.");
}
function saved(record:V18bPathDiary,observation:DiaryObservation){
 return Boolean(record.draftSavedAt&&record.notes===observation.notes&&
  record.interest===observation.interest&&
  (record.difficulty??null)===(observation.difficulty??null));
}
/** Reconcile first, then write only when Core still reports the original version.
 * A lost Save/Draft ACK can be resolved by GET without a second POST.
 * Never retry Register here. Never advance to Mission links without confirmed notes.
 */
export async function resumeDiaryObservationWithLinks(
 client:Client,plan:ObservationPlan,
):Promise<ObservationPending|LinkOutcome>{
 identity(plan.diaryId,"ID");identity(plan.centerId,"CENTER");
 identity(plan.studentId,"STUDENT");identity(plan.teachingContextKey,"CONTEXT");
 identity(plan.pathKey,"PATH");identity(plan.submissionKey,"SUBMISSION_KEY");
 if(!Number.isSafeInteger(plan.expectedVersion)||plan.expectedVersion<1)
  throw new V18bCoreError(400,"DIARY_VERSION_INVALID","Phiên bản Nhật ký không hợp lệ.");
 const observation=requireObservation(plan.observation);
 validateMissionLinkChoices(plan.selected,plan.selected.map(x=>x.missionId));
 try{
  let record=await client.diary(plan.diaryId,plan.centerId);
  checkIdentity(record,plan);
  if(!saved(record,observation)){
   if(record.version!==plan.expectedVersion||record.status!=="REGISTERED")
    throw new V18bCoreError(409,"DIARY_OBSERVATION_VERSION_CONFLICT",
     "Nhật ký đã đổi phiên bản hoặc đóng; cần đối soát, không ghi đè.");
   const receipt=await client.saveDraft(plan.diaryId,{
    centerId:plan.centerId,expectedVersion:plan.expectedVersion,
    interest:observation.interest,notes:observation.notes,difficulty:observation.difficulty,
   },"pap945:"+plan.submissionKey+":draft");
   checkIdentity(receipt,plan);
   record=await client.diary(plan.diaryId,plan.centerId);
   checkIdentity(record,plan);
   if(!saved(record,observation))
    throw new V18bCoreError(503,"DIARY_OBSERVATION_READBACK_INCOMPLETE",
     "Core chưa xác nhận ghi chú quan sát sau khi lưu.");
  }
  return resumeDiaryMissionLinks(client,{
   diaryId:plan.diaryId,centerId:plan.centerId,
   submissionKey:plan.submissionKey,selected:plan.selected,
  });
 }catch(e){return pending(plan,e);}
}
/** One Register command only, then source GET / Draft / GET and independent Mission links.
 * If Register reply is ambiguous, do not create another Diary; require source reconciliation.
 */
export async function createDiaryObservationWithLinks(
 client:Client,request:{prepared:PreparedDiarySubmission;observation:DiaryObservation},
):Promise<ObservationOutcome>{
 const {prepared}=request;
 const registration=prepared.registration;
 const centerId=identity(registration.centerId,"CENTER");
 const studentId=identity(registration.studentId,"STUDENT");
 const teachingContextKey=identity(registration.teachingContextKey,"CONTEXT");
 const pathKey=identity(registration.pathKey,"PATH");
 const submissionKey=identity(prepared.submissionKey,"SUBMISSION_KEY");
 const observation=requireObservation(request.observation);
 const selected=validateMissionLinkChoices(prepared.selected,prepared.eligibleMissionIds);
 let diary:V18bPathDiary;
 try{diary=await client.register(registration,"pap945:"+submissionKey+":register");}
 catch(e){return {state:"REGISTER_UNCERTAIN",diaryId:null,submissionKey,...problem(e)};}
 const diaryId=identity(diary.id,"ID");
 const plan:ObservationPlan={
  diaryId,centerId,studentId,teachingContextKey,pathKey,
  expectedVersion:diary.version,submissionKey,selected,observation,
 };
 return resumeDiaryObservationWithLinks(client,plan);
}
