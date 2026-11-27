/** PAP-945 / PAP-727 — source-owned Diary observation + independent PAP-1254 Mission links.
 * Pure command coordination; this module is NOT an ACL gate or runtime write admission.
 * A known Diary ID must never be silently replaced after any partial failure.
 */
import {V18bCoreError,type V18bPathDiary,type V18bDiaryMissionLink,type createV18bApiTransport} from "./tos-classroom-v18b-api";
import {resumeDiaryMissionLinks,validateMissionLinkChoices,type MissionChoice,type LinkOutcome,type CreateOutcome} from "./tos-diary-mission-link-workflow";
import type {PreparedDiarySubmission} from "./tos-diary-submit-preflight";

type Client=Pick<ReturnType<typeof createV18bApiTransport>,"register"|"diary"|"saveDraft"|"missionLinks"|"linkMission"|"resolveDiary"|"close">;
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

export type DiaryDraftOutcome=CreateOutcome|{
 state:"DRAFT_READY";diary:V18bPathDiary;links:V18bDiaryMissionLink[];submissionKey:string;
}|{
 state:"ALREADY_SUBMITTED";diary:V18bPathDiary;submissionKey:string;
}|{
 state:"DRAFT_PENDING";diaryId:string|null;submissionKey:string;errorCode:string;errorMessage:string;
};
export type DiaryClosePlan={
 diaryId:string;centerId:string;studentId:string;runningClassId:string;teachingContextKey:string;pathKey:string;
 expectedVersion:number;closeKey:string;selected:readonly MissionChoice[];observation:DiaryObservation;
};
export type DiaryCloseOutcome={
 state:"CLOSE_PENDING"|"CLOSED_VERIFIED";plan:DiaryClosePlan;diary:V18bPathDiary|null;
 errorCode?:string;errorMessage?:string;
};
type DraftClient=Pick<Client,"resolveDiary"|"register"|"diary"|"missionLinks"|"linkMission">;
type CloseClient=Pick<Client,"diary"|"missionLinks"|"close">;
function occurrenceScope(prepared:PreparedDiarySubmission,localDate:string){
 const r=prepared.registration;
 return {centerId:r.centerId,runningClassId:r.runningClassId,studentId:r.studentId,
  pathKey:r.pathKey,localDate};
}
function checkDiaryForRegistration(record:V18bPathDiary,prepared:PreparedDiarySubmission,status:"REGISTERED"|"CLOSED"){
 const r=prepared.registration;
 if(!record||!record.id||record.studentId!==r.studentId||
    record.teachingContextKey!==r.teachingContextKey||record.pathKey!==r.pathKey||
    (record.centerId!==undefined&&record.centerId!==r.centerId)||
    (record.runningClassId!==undefined&&record.runningClassId!==r.runningClassId)||
    record.status!==status||!Number.isSafeInteger(record.version)||record.version<1)
  throw new V18bCoreError(502,"DIARY_OCCURRENCE_READBACK_MISMATCH",
   "Core trả Nhật ký sai phạm vi hoặc trạng thái của lần học.");
}
function assignedChoices(selected:readonly MissionChoice[],eligibleMissionIds:readonly string[]){
 const choices=validateMissionLinkChoices(selected,eligibleMissionIds);
 if(choices.some(choice=>!choice.assignmentId))
  throw new V18bCoreError(403,"DIARY_ASSIGNMENT_REQUIRED",
   "Mỗi Nhiệm vụ cần Assignment đang hoạt động đã được Core xác minh.");
 return choices.map(choice=>({missionId:choice.missionId,assignmentId:choice.assignmentId!}));
}
function verifyLinkedAssignments(links:readonly V18bDiaryMissionLink[],diaryId:string,selected:readonly MissionChoice[]){
 if(!Array.isArray(links)||links.some(link=>link.diaryId!==diaryId))
  throw new V18bCoreError(502,"DIARY_LINK_READBACK_MISMATCH","Liên kết từ Core không khớp Nhật ký.");
 for(const choice of selected){
  const link=links.find(row=>row.missionId===choice.missionId);
  if(!link||!choice.assignmentId||link.assignmentId!==choice.assignmentId)
   throw new V18bCoreError(503,"DIARY_LINK_READBACK_INCOMPLETE",
    "Core chưa xác nhận đủ liên kết Nhiệm vụ và Assignment đã chọn.");
 }
 return [...links];
}
/** Explicit Start/Continue: resolve the exact occurrence first, register only after a source miss,
 * then durably link the explicitly selected Assignment IDs. It never writes observation fields.
 */
export async function beginDiaryDraftWithLinks(
 client:DraftClient,request:{prepared:PreparedDiarySubmission;localDate:string;beforeRegister:(key:string)=>boolean},
):Promise<DiaryDraftOutcome>{
 const {prepared}=request,submissionKey=identity(prepared.submissionKey,"SUBMISSION_KEY");
 const scope=occurrenceScope(prepared,request.localDate);
 let knownId:string|null=null;
 try{
  const selected=assignedChoices(prepared.selected,prepared.eligibleMissionIds);
  const resolution=await client.resolveDiary(scope);
  if(resolution.state!=="NOT_FOUND"){
   if(!resolution.diary)throw new V18bCoreError(502,"DIARY_RESOLVE_READBACK_MISSING","Core chưa trả Nhật ký đã tìm thấy.");
   knownId=resolution.diary.id;
   checkDiaryForRegistration(resolution.diary,prepared,resolution.state==="REGISTERED"?"REGISTERED":"CLOSED");
   if(resolution.state==="ALREADY_SUBMITTED")
    return {state:"ALREADY_SUBMITTED",diary:resolution.diary,submissionKey};
  }else{
   if(!request.beforeRegister(submissionKey))
    return {state:"DRAFT_PENDING",diaryId:null,submissionKey,errorCode:"DIARY_REGISTER_TICKET_UNAVAILABLE",
     errorMessage:"Không thể giữ mã Register gốc. Nhật ký chưa được tạo."};
   let registered:V18bPathDiary;
   try{registered=await client.register(prepared.registration,"pap945:"+submissionKey+":register");}
   catch(error){return {state:"REGISTER_UNCERTAIN",diaryId:null,submissionKey,...problem(error)};}
   knownId=identity(registered.id,"ID");
   checkDiaryForRegistration(registered,prepared,"REGISTERED");
   const afterRegister=await client.resolveDiary(scope);
   if(afterRegister.state!=="REGISTERED"||!afterRegister.diary||afterRegister.diary.id!==knownId){
    if(afterRegister.state==="ALREADY_SUBMITTED"&&afterRegister.diary)
     return {state:"ALREADY_SUBMITTED",diary:afterRegister.diary,submissionKey};
    throw new V18bCoreError(503,"DIARY_REGISTER_READBACK_PENDING",
     "Core chưa xác nhận lại đúng Diary sau khi bắt đầu bản nháp.");
   }
   checkDiaryForRegistration(afterRegister.diary,prepared,"REGISTERED");
  }
  const diaryId=identity(knownId??"","ID");
  const linked=await resumeDiaryMissionLinks(client,{
   diaryId,centerId:prepared.registration.centerId,submissionKey,selected,
  });
  if(linked.state!=="LINK_VERIFIED")return linked;
  const links=verifyLinkedAssignments(await client.missionLinks(diaryId,prepared.registration.centerId),diaryId,selected);
  const diary=await client.diary(diaryId,prepared.registration.centerId);
  checkDiaryForRegistration(diary,prepared,"REGISTERED");
  return {state:"DRAFT_READY",diary,links,submissionKey};
 }catch(error){
  return {state:"DRAFT_PENDING",diaryId:knownId,submissionKey,...problem(error)};
 }
}
export type DiaryPartialDraftPlan={
 diaryId:string;centerId:string;studentId:string;runningClassId:string;teachingContextKey:string;pathKey:string;
 expectedVersion:number;saveKey:string;fields:{interest:number|null;notes:string|null;difficulty:string|null};
};
export type DiaryPartialDraftOutcome={
 state:"DRAFT_SAVED"|"DRAFT_SAVE_PENDING";plan:DiaryPartialDraftPlan;diary:V18bPathDiary|null;
 errorCode?:string;errorMessage?:string;
};
type PartialDraftClient=Pick<Client,"diary"|"saveDraft">;
function partialDraftMatches(diary:V18bPathDiary,plan:DiaryPartialDraftPlan){
 return diary.status==="REGISTERED"&&diary.interest===plan.fields.interest&&
  diary.notes===plan.fields.notes&&(diary.difficulty??null)===plan.fields.difficulty;
}
function checkDiaryForPartialSave(diary:V18bPathDiary,plan:DiaryPartialDraftPlan){
 if(!diary||diary.id!==plan.diaryId||diary.studentId!==plan.studentId||
    diary.teachingContextKey!==plan.teachingContextKey||diary.pathKey!==plan.pathKey||
    (diary.centerId!==undefined&&diary.centerId!==plan.centerId)||
    (diary.runningClassId!==undefined&&diary.runningClassId!==plan.runningClassId))
  throw new V18bCoreError(502,"DIARY_DRAFT_SCOPE_MISMATCH",
   "Core trả Nhật ký không khớp Center, học viên, Path hoặc ngữ cảnh lớp.");
}
function partialPending(plan:DiaryPartialDraftPlan,error:unknown,diary:V18bPathDiary|null):DiaryPartialDraftOutcome{
 return {state:"DRAFT_SAVE_PENDING",plan,diary,...problem(error)};
}
/** Persist incomplete work without applying final-submit validation. The form can reopen
 * from Core after reload; every ambiguous write is reconciled against the same Diary ID.
 */
export async function resumeDiaryPartialDraft(
 client:PartialDraftClient,plan:DiaryPartialDraftPlan,
):Promise<DiaryPartialDraftOutcome>{
 identity(plan.diaryId,"ID");identity(plan.centerId,"CENTER");identity(plan.studentId,"STUDENT");
 identity(plan.runningClassId,"CLASS");identity(plan.teachingContextKey,"CONTEXT");identity(plan.pathKey,"PATH");
 identity(plan.saveKey,"SAVE_KEY");
 if(!Number.isSafeInteger(plan.expectedVersion)||plan.expectedVersion<1)
  throw new V18bCoreError(400,"DIARY_VERSION_INVALID","Phiên bản Nhật ký không hợp lệ.");
 const fields=plan.fields;
 if(!fields||!([null,1,2,3,4].includes(fields.interest))||
    (fields.notes!==null&&typeof fields.notes!=="string")||
    (fields.difficulty!==null&&typeof fields.difficulty!=="string"))
  throw new V18bCoreError(400,"DIARY_DRAFT_FIELDS_INVALID","Thông tin bản nháp không hợp lệ.");
 const normalized={interest:fields.interest,notes:fields.notes?.trim()||null,difficulty:fields.difficulty?.trim()||null};
 const canonical={...plan,fields:normalized};
 let current:V18bPathDiary|null=null;
 try{
  current=await client.diary(plan.diaryId,plan.centerId);
  checkDiaryForPartialSave(current,canonical);
  if(partialDraftMatches(current,canonical))return {state:"DRAFT_SAVED",plan:canonical,diary:current};
  if(current.status!=="REGISTERED"||current.version!==plan.expectedVersion)
   throw new V18bCoreError(409,"DIARY_DRAFT_VERSION_CONFLICT",
    "Nhật ký đã đổi phiên bản hoặc đã đóng; cần đọc lại trước khi lưu.");
  try{
   await client.saveDraft(plan.diaryId,{centerId:plan.centerId,expectedVersion:plan.expectedVersion,
    interest:normalized.interest,notes:normalized.notes,difficulty:normalized.difficulty},
    "pap2277:"+plan.saveKey+":draft");
  }catch(error){
   const afterLostAck=await client.diary(plan.diaryId,plan.centerId);
   checkDiaryForPartialSave(afterLostAck,canonical);
   if(partialDraftMatches(afterLostAck,canonical))return {state:"DRAFT_SAVED",plan:canonical,diary:afterLostAck};
   throw error;
  }
  const savedDiary=await client.diary(plan.diaryId,plan.centerId);
  checkDiaryForPartialSave(savedDiary,canonical);
  if(!partialDraftMatches(savedDiary,canonical))
   throw new V18bCoreError(503,"DIARY_DRAFT_READBACK_INCOMPLETE","Core chưa xác nhận đủ nội dung bản nháp.");
  return {state:"DRAFT_SAVED",plan:canonical,diary:savedDiary};
 }catch(error){return partialPending(canonical,error,current);}
}
function checkDiaryForClose(record:V18bPathDiary,plan:DiaryClosePlan){
 if(!record||record.id!==plan.diaryId||record.studentId!==plan.studentId||
    record.teachingContextKey!==plan.teachingContextKey||record.pathKey!==plan.pathKey||
    (record.centerId!==undefined&&record.centerId!==plan.centerId)||
    (record.runningClassId!==undefined&&record.runningClassId!==plan.runningClassId))
  throw new V18bCoreError(502,"DIARY_CLOSE_SCOPE_MISMATCH",
   "Core trả Nhật ký không khớp Center, học viên, Path hoặc ngữ cảnh lớp.");
}
function closedWith(record:V18bPathDiary,observation:DiaryObservation){
 return record.status==="CLOSED"&&record.interest===observation.interest&&record.notes===observation.notes&&
  (record.difficulty??null)===(observation.difficulty??null);
}
function closePending(plan:DiaryClosePlan,error:unknown,diary:V18bPathDiary|null=null):DiaryCloseOutcome{
 return {state:"CLOSE_PENDING",plan,diary,...problem(error)};
}
function closeVerified(plan:DiaryClosePlan,diary:V18bPathDiary):DiaryCloseOutcome{
 return {state:"CLOSED_VERIFIED",plan,diary};
}
/** Final submit is a single Core Close command after fresh Diary + Mission-link readbacks.
 * If its ACK is lost, read the same Diary first; never synthesize Submitted or close a new ID.
 */
export async function resumeDiaryClose(
 client:CloseClient,plan:DiaryClosePlan,
):Promise<DiaryCloseOutcome>{
 identity(plan.diaryId,"ID");identity(plan.centerId,"CENTER");identity(plan.studentId,"STUDENT");
 identity(plan.runningClassId,"CLASS");identity(plan.teachingContextKey,"CONTEXT");
 identity(plan.pathKey,"PATH");identity(plan.closeKey,"CLOSE_KEY");
 const observation=requireObservation(plan.observation);
 if(!Number.isSafeInteger(plan.expectedVersion)||plan.expectedVersion<1)
  throw new V18bCoreError(400,"DIARY_VERSION_INVALID","Phiên bản Nhật ký không hợp lệ.");
 let current:V18bPathDiary|null=null;
 try{
  current=await client.diary(plan.diaryId,plan.centerId);
  checkDiaryForClose(current,plan);
  if(closedWith(current,observation))return closeVerified(plan,current);
  if(current.status!=="REGISTERED"||current.version!==plan.expectedVersion)
   throw new V18bCoreError(409,"DIARY_CLOSE_VERSION_CONFLICT",
    "Nhật ký đã đổi phiên bản hoặc đã đóng; cần đọc lại trước khi gửi.");
  const selected=assignedChoices(plan.selected,plan.selected.map(choice=>choice.missionId));
  verifyLinkedAssignments(await client.missionLinks(plan.diaryId,plan.centerId),plan.diaryId,selected);
  try{
   await client.close(plan.diaryId,{
    centerId:plan.centerId,expectedVersion:plan.expectedVersion,
    interest:observation.interest,notes:observation.notes,difficulty:observation.difficulty,
   },"pap2277:"+plan.closeKey);
  }catch(error){
   // Close may have committed despite a lost response. The readback below is authoritative.
   const afterLostAck=await client.diary(plan.diaryId,plan.centerId);
   checkDiaryForClose(afterLostAck,plan);
   if(closedWith(afterLostAck,observation))return closeVerified(plan,afterLostAck);
   throw error;
  }
  const receipt=await client.diary(plan.diaryId,plan.centerId);
  checkDiaryForClose(receipt,plan);
  if(!closedWith(receipt,observation))
   throw new V18bCoreError(503,"DIARY_CLOSE_READBACK_INCOMPLETE",
    "Core chưa xác nhận trạng thái Submitted và nội dung Nhật ký.");
  return closeVerified(plan,receipt);
 }catch(error){
  if(current?.status==="CLOSED"&&closedWith(current,observation))return closeVerified(plan,current);
  return closePending(plan,error,current);
 }
}
