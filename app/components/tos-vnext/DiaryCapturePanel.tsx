"use client";
/** PAP-945 / PAP-1400 — authenticated V18b Diary capture.
 * Explicit skip-opening entry + guarded Staging-only writer; Production OFF.
 * No fake opening, MissionResult, media receipt or local-only Diary truth.
 */
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {createV18bApiTransport,V18bCoreError,type V18bEligibleMissionsRead,type V18bEligibleMissionsInput,type V18bPathDiary,type V18bDiaryMissionLink} from "@/lib/tos-classroom-v18b-api";
import {prepareDiarySubmission,prepareSpecialtyDiarySubmission} from "@/lib/tos-diary-submit-preflight";
import {validateDiaryCaptureDraft} from "@/lib/tos-diary-capture-validation";
import {beginDiaryDraftWithLinks,resumeDiaryPartialDraft,resumeDiaryClose,type DiaryDraftOutcome,type DiaryPartialDraftPlan,type DiaryCloseOutcome,type DiaryClosePlan,type ObservationOutcome} from "@/lib/tos-diary-observation-workflow";
import {resumeDiaryMissionLinks} from "@/lib/tos-diary-mission-link-workflow";
import {diaryUiReceipt,canRetryDiary} from "@/lib/tos-diary-ui-receipt";
import {inspectDiaryAfterReload,type ReloadReceipt} from "@/lib/tos-diary-reload-inspection";
import {reconcileUnknownDiaryRegister,type LostAckResult} from "@/lib/tos-diary-register-receipt-recovery";
import {readDiaryTicket,stageDiaryTicket,clearVerifiedDiaryTicket,type DiaryTicketState} from "@/lib/tos-diary-register-ticket";
import {isConfirmedSkipDiaryEntry} from "@/lib/tos-diary-skip-opening";
import {isDiaryStagingWriterHost} from "@/lib/tos-diary-stage-admission";
import {diaryWriteView} from "@/lib/tos-diary-stage-status";
import {createTosMissionAssignmentApiTransport} from "@/lib/tos-mission-assignment-api";
import {assignmentScopeForCandidate} from "@/lib/tos-mission-assignment-workflow";
import {readTosMissionCompletion} from "@/lib/tos-mission-completion-read";
import {submitVerifiedC1Completion} from "@/lib/tos-mission-completion-command";
import {projectTosSpecialtyPickerChoices,readDiarySpecialtyCatalog} from "@/lib/tos-specialty-picker-read";
import {TosSpecialtyMissionChoiceList} from "@/app/classroom/TosSpecialtyMissionChoiceList";
import type {ClassroomV4ViewModel,ScheduledClass} from "@/lib/tos-classroom-v4-view-model";
import styles from "./diary-capture.module.css";

type Read={key:string;phase:"idle"|"loading"|"ready"|"error";data:V18bEligibleMissionsRead|null;message:string};
type DraftStatus={phase:"idle"|"loading"|"ready"|"closed"|"error";diary:V18bPathDiary|null;links:V18bDiaryMissionLink[];message:string};
const emptyDraft:DraftStatus={phase:"idle",diary:null,links:[],message:""};
const idle:Read={key:"",phase:"idle",data:null,message:""};
const interestLabels=["Phản kháng","Không tương tác","Tương tác","Hứng thú, đào sâu"] as const;
// PAP-1400: default disabled in Production and all noncanonical hosts. The guarded
// Staging-CD build must positively set NEXT_PUBLIC_PINO_DIARY_STAGING_WRITE=true.
// This client switch never overrides source-owned Core ACL/roster/Mission checks.
function ticketStorage():Storage|null {
 try{return typeof window==="undefined"?null:window.sessionStorage}catch{return null}
}
export default function DiaryCapturePanel({model,classroom,confirmedSkipClassId}:{
 model:ClassroomV4ViewModel;classroom:ScheduledClass;confirmedSkipClassId:string;
}){
 const students=model.data.students.filter(s=>classroom.eligibleStudentIds.includes(s.id)&&!model.conflictStudentIds.includes(s.id));
 const [studentId,setStudentId]=useState("");
 const [read,setRead]=useState<Read>(idle);
 const [missionIds,setMissionIds]=useState<string[]>([]);
 const [recoveryMissionIds,setRecoveryMissionIds]=useState<string[]>([]);
 const [notes,setNotes]=useState("");
 const [interest,setInterest]=useState<number|null>(null);
 const [difficulty,setDifficulty]=useState("");
 const [showValidation,setShowValidation]=useState(false);
 const [receipt,setReceipt]=useState<ObservationOutcome|null>(null);
 const [draftStatus,setDraftStatus]=useState<DraftStatus>(emptyDraft);
 const [draftDirty,setDraftDirty]=useState(false);
 const [closeReceipt,setCloseReceipt]=useState<DiaryCloseOutcome|null>(null);
 // PAP-1756: independent Core C1, never infer from Diary or C2 MissionResult.
 const [completionIntent,setCompletionIntent]=useState<string[]>([]);
 const [completionStatus,setCompletionStatus]=useState<Record<string,"READING"|"IN_PROGRESS"|"VERIFIED"|"UNVERIFIED">>({});
 const [completionBusy,setCompletionBusy]=useState(false);
 const [completionMessage,setCompletionMessage]=useState("");
 const [registerTicket,setRegisterTicket]=useState<DiaryTicketState>({state:"UNAVAILABLE",key:null});
 const [registerRecovery,setRegisterRecovery]=useState<LostAckResult|null>(null);
 const [recovering,setRecovering]=useState(false);
 const [busy,setBusy]=useState(false);
 const [stagingHostAdmitted,setStagingHostAdmitted]=useState(false);
 const [runtimeError,setRuntimeError]=useState("");
 const [knownDiaryId,setKnownDiaryId]=useState("");
 const [reloadReceipt,setReloadReceipt]=useState<ReloadReceipt|null>(null);
 const [reloadBusy,setReloadBusy]=useState(false);
 const reloadGeneration=useRef(0);
 // Founder PAP-727: explicit "Vào lớp không mở ca" is sufficient entry-mode for
 // a Diary, NOT an opening/photo/timekeeping event. Core independently checks Staff,
 // Center, occurrence, actual roster and Mission; local confirmation grants no ACL.
 const skipEntryConfirmed=isConfirmedSkipDiaryEntry(model,classroom,confirmedSkipClassId);
 const writerApi=useMemo(()=>createV18bApiTransport(stagingHostAdmitted),[stagingHostAdmitted]);
 const readCatalog=useCallback((scope:V18bEligibleMissionsInput)=>readDiarySpecialtyCatalog(scope,classroom.pathProgramId),[classroom.pathProgramId]);
 const recoveryApi=useMemo(()=>({...writerApi,eligibleMissions:readCatalog}),[writerApi,readCatalog]);
 const writeAdmitted=stagingHostAdmitted&&skipEntryConfirmed;
 const locked=receipt!==null||busy||reloadBusy||completionBusy||recovering||draftStatus.phase==="loading"||closeReceipt?.state==="CLOSE_PENDING";
 const formLocked=locked||draftStatus.phase==="closed";
 const receiptView=diaryUiReceipt(receipt);
 const writeView=diaryWriteView({
  admitted:writeAdmitted,busy,checking:recovering||reloadBusy,
  ticket:registerTicket.state,outcome:receipt?.state??null,
 });
 const permitted=students.some(x=>x.id===studentId);
 const key=JSON.stringify([model.centerId,classroom.runningClassId,model.today,classroom.id,classroom.pathProgramId,studentId]);
 useEffect(()=>{
  setStagingHostAdmitted(isDiaryStagingWriterHost(
   process.env.NEXT_PUBLIC_PINO_DIARY_STAGING_WRITE==="true",window.location.hostname));
  setRegisterTicket(readDiaryTicket(ticketStorage()));
 },[]);
 useEffect(()=>{reloadGeneration.current++;setKnownDiaryId("");setReloadReceipt(null);setRegisterRecovery(null);
  setDraftStatus({...emptyDraft,phase:"loading",message:"Đang đọc Nhật ký của lần học…"});
  setDraftDirty(false);setCloseReceipt(null);setReceipt(null);},[key]);
 useEffect(()=>{
  if(!permitted)return;
  let active=true;
  setRead({key,phase:"loading",data:null,message:""});
  void readCatalog({
   centerId:model.centerId,runningClassId:classroom.runningClassId,
   studentId,localDate:model.today,teachingContextKey:classroom.id,
  }).then(data=>{
   if(active)setRead({key,phase:"ready",data,message:""});
  }).catch(error=>{
   if(!active)return;
   setRead({key,phase:"error",data:null,
    message:error&&typeof error==="object"&&"status" in error&&[401,403].includes(Number(error.status))
     ?"Bạn không có quyền xem Nhiệm vụ của học viên này."
     :"Không thể tải Mission hợp lệ từ Core. Vui lòng thử lại."});
  });
  return()=>{active=false};
 },[key,permitted,model.centerId,model.today,classroom.id,classroom.runningClassId,studentId,readCatalog]);
 const current=permitted&&read.key===key?read:idle;
 const eligibility=current.phase==="ready"?current.data:null;
 // PAP-2277: reopening the existing TOS panel resolves the canonical occurrence read-only.
 // It restores a REGISTERED draft or CLOSED receipt; selection itself never writes.
 useEffect(()=>{
  if(!permitted||current.phase==="idle"||current.phase==="loading"||current.phase==="error"||!eligibility)return;
  let active=true;
  const generation=++reloadGeneration.current;
  void (async()=>{
   try{
    const resolution=await writerApi.resolveDiary({centerId:model.centerId,
     runningClassId:classroom.runningClassId,studentId,pathKey:eligibility.pathProgramId,localDate:model.today});
    if(!active||reloadGeneration.current!==generation)return;
    if(resolution.state==="NOT_FOUND"){
     setDraftStatus(emptyDraft);
     return;
    }
    if(!resolution.diary)throw new V18bCoreError(502,"DIARY_RESOLVE_READBACK_MISSING","Core chưa trả Nhật ký đã tìm thấy.");
    const links=await writerApi.missionLinks(resolution.diary.id,model.centerId);
    if(!active||reloadGeneration.current!==generation)return;
    if(links.some(link=>link.diaryId!==resolution.diary!.id))
     throw new V18bCoreError(502,"DIARY_LINK_READBACK_MISMATCH","Liên kết Core không khớp Nhật ký.");
    setDraftStatus({phase:resolution.state==="REGISTERED"?"ready":"closed",
     diary:resolution.diary,links,message:resolution.state==="REGISTERED"
      ?"Đã mở lại bản nháp Nhật ký từ Core."
      :"Core xác nhận Nhật ký đã gửi."});
    setMissionIds(previous=>[...new Set([...previous,...links.map(link=>link.missionId)])]);
    setNotes(resolution.diary.notes??"");
    setInterest(resolution.diary.interest);
    setDifficulty(resolution.diary.difficulty??"");
    setDraftDirty(false);
   }catch(error){
    if(!active||reloadGeneration.current!==generation)return;
    setDraftStatus({phase:"error",diary:null,links:[],
     message:error instanceof V18bCoreError?error.message:"Chưa xác minh được Nhật ký tại Core. Không thể tạo bản ghi mới."});
   }
  })();
  return()=>{active=false;};
 },[permitted,current.phase,eligibility?.pathProgramId,eligibility,key,writerApi,model.centerId,model.today,
  classroom.runningClassId,studentId]);
 // PAP-1497: display the entire verified contract, but new selection is available-only.
 const specialtyRows=useMemo(()=>eligibility?projectTosSpecialtyPickerChoices(eligibility.items):[],[eligibility]);
 const availableIds=useMemo(()=>new Set(specialtyRows.filter(row=>row.available).map(row=>row.missionId)),[specialtyRows]);
 const recoveryChosen=useMemo(()=>recoveryMissionIds.map(missionId=>{
  const row=eligibility?.items.find(x=>x.missionId===missionId);
  return {missionId,...(row?.assignmentId?{assignmentId:row.assignmentId}:{})};
 }),[eligibility,recoveryMissionIds]);
 const linkedMissionIds=useMemo(()=>new Set(draftStatus.links.map(link=>link.missionId)),[draftStatus.links]);
 const newMissionIds=missionIds.filter(id=>!linkedMissionIds.has(id));
 const newMissionChoices=useMemo(()=>newMissionIds.map(missionId=>{
  const row=eligibility?.items.find(item=>item.missionId===missionId);
  return {missionId,...(row?.assignmentId?{assignmentId:row.assignmentId}:{})};
 }),[eligibility,newMissionIds]);
 const preflight=useMemo(()=>{
  if(!permitted||!eligibility||eligibility.hasMore)return false;
  if(newMissionIds.length===0)return true;
  try{
   // Sentinel can only be used for local validation. Never a submitted idempotency key.
   prepareSpecialtyDiarySubmission({model,classroom,studentId,eligibility,selected:newMissionChoices,submissionKey:"PAP945_PREFLIGHT_ONLY"});
   return true;
  }catch{return false;}
 },[permitted,model,classroom,studentId,eligibility,newMissionIds.length,newMissionChoices]);
 // PAP-1756: read actual independent C1 execution before enabling the checkbox.
 // No optimistic success or inference from Diary/MissionResult.
 useEffect(()=>{
  if(!permitted||!eligibility||eligibility.hasMore)return;
  const linked=eligibility.items.filter(item=>item.assignmentId!==null&&availableIds.has(item.missionId));
  if(linked.length===0)return;
  let active=true;
  // Undefined status remains disabled until an asynchronous verified Core read.
  void (async()=>{
   const states:Record<string,"IN_PROGRESS"|"VERIFIED"|"UNVERIFIED">={};
   try{
    const day=await writerApi.today(model.centerId,model.today);
    const occurrence=day.occurrences.find(item=>
     item.runningClassId===classroom.runningClassId&&item.teachingContextKey===classroom.id);
    if(!occurrence)throw new Error("Missing canonical classroom occurrence");
    const scope=assignmentScopeForCandidate(day,occurrence,studentId);
    const assignments=createTosMissionAssignmentApiTransport(false);
    for(const item of linked){
     if(!active)return;
     try{
      const assignment=await assignments.get(scope,item.assignmentId!);
      if(assignment.missionId!==item.missionId||assignment.status!=="ASSIGNED")throw new Error("Inactive assignment");
      const execution=await readTosMissionCompletion(day,occurrence,studentId,assignment);
      states[item.missionId]=execution.executionStatus==="COMPLETED"?"VERIFIED":execution.executionStatus==="IN_PROGRESS"?"IN_PROGRESS":"UNVERIFIED";
     }catch{states[item.missionId]="UNVERIFIED";}
    }
   }catch{
    for(const item of linked)states[item.missionId]="UNVERIFIED";
   }
   if(active)setCompletionStatus(previous=>({...previous,...states}));
  })();
  return()=>{active=false;};
 },[permitted,eligibility,availableIds,writerApi,model.centerId,model.today,
   classroom.id,classroom.runningClassId,studentId]);
 const activeMissions=eligibility?.items.filter(item=>item.assignmentId&&availableIds.has(item.missionId)&&
  (completionStatus[item.missionId]==="IN_PROGRESS"||
   (missionIds.includes(item.missionId)&&linkedMissionIds.has(item.missionId))))??[];
 const checkingActiveMissions=eligibility?.items.some(item=>item.assignmentId&&availableIds.has(item.missionId)&&!completionStatus[item.missionId])??false;
 const submitEligibleMissionIds=[...new Set([...activeMissions.map(item=>item.missionId),
  ...draftStatus.links.map(link=>link.missionId)])];
 const errors=[
  ...validateDiaryCaptureDraft({studentId,missionIds,eligibleIds:submitEligibleMissionIds,
   eligibilityLoaded:current.phase==="ready",eligibilityHasMore:eligibility?.hasMore??false,notes,interest,difficulty}),
  ...(studentId&&current.phase==="error"?[current.message]:[]),
  ...(missionIds.length>0&&!preflight?["Mission hoặc ngữ cảnh học chưa được Core xác nhận."]:[]),
 ];
 async function persistPartialDraft(diary:V18bPathDiary,links:V18bDiaryMissionLink[],saveKey:string){
  if(!draftDirty)return diary;
  const plan:DiaryPartialDraftPlan={
   diaryId:diary.id,centerId:model.centerId,studentId,runningClassId:classroom.runningClassId,
   teachingContextKey:classroom.id,pathKey:diary.pathKey,expectedVersion:diary.version,saveKey,
   fields:{interest,notes:notes.trim()||null,difficulty:difficulty.trim()||null},
  };
  const outcome=await resumeDiaryPartialDraft(writerApi,plan);
  if(outcome.state==="DRAFT_SAVED"&&outcome.diary){
   setDraftDirty(false);
   setDraftStatus({phase:"ready",diary:outcome.diary,links,message:"Bản nháp đã lưu trên Core; có thể tiếp tục hoặc gửi."});
   return outcome.diary;
  }
  setDraftStatus({phase:"ready",diary,links,message:outcome.errorMessage??"Bản nháp chưa được Core xác nhận."});
  setRuntimeError(outcome.errorMessage??"Bản nháp chưa được Core xác nhận.");
  return null;
 }
 async function beginDraft(){
  if(!writeAdmitted||busy||!permitted||!eligibility||eligibility.hasMore||
     !preflight||registerTicket.state!=="EMPTY"||draftStatus.phase==="closed")return;
  const selectedIds=draftStatus.phase==="ready"?newMissionIds:missionIds;
  if(selectedIds.length===0){
   if(draftStatus.phase==="ready"&&draftStatus.diary&&draftDirty){
    setBusy(true);setRuntimeError("");
    try{await persistPartialDraft(draftStatus.diary,draftStatus.links,crypto.randomUUID());}
    catch(error){setRuntimeError(error instanceof V18bCoreError?error.message:"Chưa lưu được bản nháp.");}
    finally{setBusy(false);}
    return;
   }
   setRuntimeError("Chọn Nhiệm vụ mới hoặc thay đổi thông tin bản nháp trước khi tiếp tục.");return;
  }
  setBusy(true);setRuntimeError("");setShowValidation(false);
  try{
   const fresh=await readCatalog({centerId:model.centerId,runningClassId:classroom.runningClassId,
    studentId,localDate:model.today,teachingContextKey:classroom.id});
   if(fresh.hasMore)throw new V18bCoreError(409,"DIARY_ELIGIBILITY_INCOMPLETE","Danh sách Mission chưa đầy đủ.");
   const selected=selectedIds.map(missionId=>{
    const row=fresh.items.find(item=>item.missionId===missionId);
    return {missionId,...(row?.assignmentId?{assignmentId:row.assignmentId}:{})};
   });
   const prepared=prepareSpecialtyDiarySubmission({model,classroom,studentId,eligibility:fresh,
    selected,submissionKey:crypto.randomUUID()});
   const storage=ticketStorage();
   const outcome:DiaryDraftOutcome=await beginDiaryDraftWithLinks(writerApi,{
    prepared,localDate:model.today,beforeRegister:key=>{
     if(!stageDiaryTicket(storage,key))return false;
     setRegisterTicket(readDiaryTicket(storage));
     return true;
    },
   });
   if(outcome.state==="DRAFT_READY"){
    setDraftStatus({phase:"ready",diary:outcome.diary,links:outcome.links,
     message:"Bản nháp đã được Core xác nhận; có thể tiếp tục ghi nhận hoặc gửi."});
    setMissionIds(previous=>[...new Set([...previous,...outcome.links.map(link=>link.missionId)])]);
    if(clearVerifiedDiaryTicket(storage,outcome.submissionKey))setRegisterTicket(readDiaryTicket(storage));
    setReceipt(null);setCloseReceipt(null);
    if(draftDirty)await persistPartialDraft(outcome.diary,outcome.links,outcome.submissionKey);
   }else if(outcome.state==="ALREADY_SUBMITTED"){
    setDraftStatus({phase:"closed",diary:outcome.diary,links:[],
     message:"Core xác nhận Nhật ký này đã gửi."});
    setNotes(outcome.diary.notes??"");setInterest(outcome.diary.interest);setDifficulty(outcome.diary.difficulty??"");setDraftDirty(false);
   }else if(outcome.state==="LINK_PENDING"||outcome.state==="REGISTER_UNCERTAIN"){
    setReceipt(outcome);
   }else{
    const message="errorMessage" in outcome&&outcome.errorMessage?
     outcome.errorMessage:"Core chưa xác minh được Diary và liên kết Nhiệm vụ.";
    setDraftStatus({phase:"error",diary:null,links:[],message});
    setRuntimeError(message);
    if("diaryId" in outcome&&outcome.diaryId)setKnownDiaryId(outcome.diaryId);
    setRegisterTicket(readDiaryTicket(storage));
   }
  }catch(error){setRuntimeError(error instanceof V18bCoreError?error.message:
   "Chưa thể bắt đầu bản nháp. Đối soát cùng lần học trước khi tạo Diary khác.");}
  finally{setBusy(false);}
 }
 async function runC1AfterClose(plan:DiaryClosePlan){
  if(!completionIntent.length)return;
  setCompletionBusy(true);setCompletionMessage("");
  try{
   const fresh=await readCatalog({centerId:model.centerId,runningClassId:classroom.runningClassId,
    studentId,localDate:model.today,teachingContextKey:classroom.id});
   if(fresh.hasMore)throw new V18bCoreError(409,"DIARY_ELIGIBILITY_INCOMPLETE","Danh sách Mission chưa đầy đủ.");
   const day=await writerApi.today(model.centerId,model.today);
   const occurrence=day.occurrences.find(item=>
    item.runningClassId===classroom.runningClassId&&item.teachingContextKey===classroom.id);
   if(!occurrence)throw new V18bCoreError(403,"MISSION_C1_OCCURRENCE_MISSING","Không xác nhận được lớp.");
   const scope=assignmentScopeForCandidate(day,occurrence,studentId);
   const assignments=createTosMissionAssignmentApiTransport(false);
   const diaryReceipt=await resumeDiaryMissionLinks(writerApi,{
    diaryId:plan.diaryId,centerId:plan.centerId,submissionKey:plan.closeKey,selected:plan.selected,
   });
   if(diaryReceipt.state!=="LINK_VERIFIED")
    throw new V18bCoreError(503,"DIARY_C1_LINK_RECEIPT_MISSING","Chưa xác minh lại liên kết Diary và Assignment.");
   for(const missionId of completionIntent){
    const selected=plan.selected.find(item=>item.missionId===missionId);
    const latest=fresh.items.find(item=>item.missionId===missionId);
    if(!selected?.assignmentId||latest?.assignmentId!==selected.assignmentId||
       completionStatus[missionId]!=="IN_PROGRESS")
     throw new V18bCoreError(409,"MISSION_C1_ASSIGNMENT_STALE",
      "Nhiệm vụ đã đổi hoặc Core chưa xác minh. Nhật ký đã gửi; C1 chưa được ghi.");
    const assignment=await assignments.get(scope,selected.assignmentId);
    if(assignment.missionId!==missionId||assignment.status!=="ASSIGNED")
     throw new V18bCoreError(409,"MISSION_C1_MISSION_MISMATCH","Assignment không còn khớp Nhiệm vụ.");
    const result=await submitVerifiedC1Completion({
     day,occurrence,studentId,assignment,diaryReceipt,checked:true,writeAdmitted,
     idempotencyKey:"pap1756:"+plan.closeKey+":"+assignment.id,
    });
    if(result.state==="VERIFIED")setCompletionStatus(previous=>({...previous,[missionId]:"VERIFIED"}));
    else{
     setCompletionStatus(previous=>({...previous,[missionId]:"UNVERIFIED"}));
     setCompletionMessage("Nhật ký đã gửi; C1 chưa được Core xác nhận. Không gửi lại tự động.");
     break;
    }
   }
  }catch(error){
   setCompletionMessage(error instanceof Error?error.message:"Nhật ký đã gửi; Completion chưa được Core xác nhận.");
  }finally{setCompletionBusy(false);}
 }
 async function submitDiary(){
  if(!writeAdmitted||busy||!permitted||registerTicket.state!=="EMPTY"||draftStatus.phase==="closed")return;
  if(draftStatus.phase!=="ready"||!draftStatus.diary||newMissionIds.length>0||draftDirty){
   const showErrors=errors.length>0;
   await beginDraft();
   if(showErrors)setShowValidation(true);
   return;
  }
  if(errors.length){setShowValidation(true);return;}
  if(draftStatus.links.length===0){setRuntimeError("Chưa có liên kết Nhiệm vụ được Core xác nhận.");return;}
  setBusy(true);setRuntimeError("");setCloseReceipt(null);
  try{
   const plan:DiaryClosePlan={
    diaryId:draftStatus.diary.id,centerId:model.centerId,studentId,
    runningClassId:classroom.runningClassId,teachingContextKey:classroom.id,
    pathKey:draftStatus.diary.pathKey,expectedVersion:draftStatus.diary.version,
    closeKey:crypto.randomUUID(),
    selected:draftStatus.links.map(link=>({missionId:link.missionId,assignmentId:link.assignmentId})),
    observation:{interest:interest!,notes,difficulty:difficulty.trim()||null},
   };
   const outcome=await resumeDiaryClose(writerApi,plan);
   setCloseReceipt(outcome);
   if(outcome.state==="CLOSED_VERIFIED"&&outcome.diary){
    setDraftStatus({phase:"closed",diary:outcome.diary,links:draftStatus.links,
     message:"Core đã xác nhận Nhật ký đã gửi."});
    setNotes(outcome.diary.notes??"");setInterest(outcome.diary.interest);setDifficulty(outcome.diary.difficulty??"");setDraftDirty(false);
    await runC1AfterClose(outcome.plan);
   }else setRuntimeError(outcome.errorMessage??"Nhật ký đang chờ Core xác nhận; không hiển thị là đã gửi.");
  }catch(error){setRuntimeError(error instanceof V18bCoreError?error.message:"Chưa xác minh được lệnh gửi tại Core.");}
  finally{setBusy(false);}
 }
 async function retryClose(){
  if(!closeReceipt||closeReceipt.state!=="CLOSE_PENDING"||busy)return;
  setBusy(true);setRuntimeError("");
  try{
   const outcome=await resumeDiaryClose(writerApi,closeReceipt.plan);
   setCloseReceipt(outcome);
   if(outcome.state==="CLOSED_VERIFIED"&&outcome.diary){
    setDraftStatus({phase:"closed",diary:outcome.diary,links:draftStatus.links,
     message:"Core đã xác nhận Nhật ký đã gửi."});
    setNotes(outcome.diary.notes??"");setInterest(outcome.diary.interest);setDifficulty(outcome.diary.difficulty??"");setDraftDirty(false);
    await runC1AfterClose(outcome.plan);
   }else setRuntimeError(outcome.errorMessage??"Nhật ký vẫn đang chờ Core xác nhận.");
  }catch(error){setRuntimeError(error instanceof V18bCoreError?error.message:"Chưa đối soát được Nhật ký gốc.");}
  finally{setBusy(false);}
 }
 async function retryDiary(){
  if(!canRetryDiary(receipt,writeAdmitted)||busy||receipt?.state!=="LINK_PENDING")return;
  setBusy(true);setRuntimeError("");
  try{
   const next=await resumeDiaryMissionLinks(writerApi,receipt.plan);
   if(next.state!=="LINK_VERIFIED"){setReceipt(next);return;}
   const diary=await writerApi.diary(next.plan.diaryId,model.centerId);
   const links=await writerApi.missionLinks(next.plan.diaryId,model.centerId);
   if(diary.status!=="REGISTERED"||links.some(link=>link.diaryId!==diary.id))
    throw new V18bCoreError(502,"DIARY_DRAFT_READBACK_MISMATCH","Core chưa xác nhận đúng bản nháp và các liên kết.");
   setDraftStatus({phase:"ready",diary,links,message:"Bản nháp đã được Core xác nhận; có thể tiếp tục ghi nhận hoặc gửi."});
   setMissionIds(previous=>[...new Set([...previous,...links.map(link=>link.missionId)])]);
   if(clearVerifiedDiaryTicket(ticketStorage(),next.plan.submissionKey))
    setRegisterTicket(readDiaryTicket(ticketStorage()));
   setReceipt(null);
  }catch(error){setRuntimeError(error instanceof V18bCoreError?error.message:
   "Không đối soát được Diary gốc. Không tạo bản ghi thứ hai.");}
  finally{setBusy(false);}
 }
 async function inspectOriginalRegister(){
  if(busy||reloadBusy||recovering||!permitted||!eligibility||eligibility.hasMore||
   registerTicket.state!=="PENDING"||!recoveryMissionIds.length)return;
  const generation=++reloadGeneration.current;
  setRecovering(true);setRuntimeError("");setRegisterRecovery(null);
  try{
   // Reconstruct original scope from fresh Core roster and Mission eligibility only.
   const fresh=await readCatalog({
    centerId:model.centerId,runningClassId:classroom.runningClassId,studentId,
    localDate:model.today,teachingContextKey:classroom.id,
   });
   if(fresh.hasMore)throw new V18bCoreError(409,"DIARY_ELIGIBILITY_INCOMPLETE","Danh sách Mission chưa đầy đủ.");
   const prepared=prepareDiarySubmission({model,classroom,studentId,eligibility:fresh,
    selected:recoveryChosen,submissionKey:registerTicket.key});
   const outcome=await reconcileUnknownDiaryRegister(recoveryApi,{
    registration:prepared.registration,submissionKey:prepared.submissionKey,
    localDate:model.today,selectedMissionIds:recoveryMissionIds,
   });
   if(reloadGeneration.current===generation){
    setRegisterRecovery(outcome);
    if(outcome.state==="RECEIPT_FOUND_READONLY"&&clearVerifiedDiaryTicket(ticketStorage(),registerTicket.key))
     setRegisterTicket(readDiaryTicket(ticketStorage()));
   }
  }catch(error){if(reloadGeneration.current===generation)
   setRuntimeError(error instanceof V18bCoreError?error.message:
    "Không đối soát được biên nhận. Giữ mã gửi gốc, không tạo Diary mới.");}
  finally{if(reloadGeneration.current===generation)setRecovering(false);}
 }
 async function inspectExistingDiary(){
  if(reloadBusy||busy||!permitted||!knownDiaryId.trim()||!recoveryMissionIds.length||!eligibility||eligibility.hasMore)return;
  const generation=++reloadGeneration.current;
  setReloadReceipt(null);setReloadBusy(true);
  try{
   const found=await inspectDiaryAfterReload(recoveryApi,{
    centerId:model.centerId,runningClassId:classroom.runningClassId,
    studentId,localDate:model.today,teachingContextKey:classroom.id,
    diaryId:knownDiaryId.trim(),selectedMissionIds:[...recoveryMissionIds],
   });
   if(reloadGeneration.current===generation)setReloadReceipt(found);
  }finally{if(reloadGeneration.current===generation)setReloadBusy(false);}
 }
 function onStudent(value:string){
  reloadGeneration.current++;setStudentId(value);setRead(idle);setMissionIds([]);setRecoveryMissionIds([]);setNotes("");setInterest(null);setDifficulty("");setDraftDirty(false);setShowValidation(false);
  setKnownDiaryId("");setReloadReceipt(null);setReloadBusy(false);setRegisterRecovery(null);
  setCompletionIntent([]);setCompletionStatus({});setCompletionMessage("");setCompletionBusy(false);
 }
 function toggleMission(id:string,checked:boolean){
  reloadGeneration.current++;setReloadReceipt(null);setReloadBusy(false);
  setMissionIds(prev=>checked?[...prev.filter(x=>x!==id),id]:prev.filter(x=>x!==id));
  if(!checked)setCompletionIntent(previous=>previous.filter(item=>item!==id));
 }
 return <section className={styles.panel} aria-label="Soạn Nhật ký lớp học từ dữ liệu Core">
  <div className={styles.heading}><h3>Nhật ký học viên</h3><span role="status" aria-live="polite">{writeView.label}</span></div>
  <p className={styles.hint}>{writeView.message}{current.phase==="error"&&draftStatus.phase==="loading"
   ?" Chưa đọc được danh sách Mission; chưa thể xác định Nhật ký an toàn."
   :draftStatus.message?" "+draftStatus.message:""}</p>
  {students.length===0?<p role="status" className={styles.hint}>Lớp chưa có học viên hợp lệ trong roster để tạo Nhật ký.</p>:
   <label className={styles.field}>Học viên
    <select value={permitted?studentId:""} disabled={locked} onChange={e=>onStudent(e.target.value)}>
     <option value="">Chọn học viên</option>
     {students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
   </label>}
  {permitted&&current.phase==="ready"&&<section aria-label="Danh sách nhiệm vụ và lý do khóa" data-specialty-selection="read-only">
   <TosSpecialtyMissionChoiceList items={specialtyRows}
    studentName={students.find(s=>s.id===studentId)?.name??"Học viên"}
    onSelect={()=>{}} disabled/>
   {eligibility?.hasMore&&<p role="status" className={styles.hint}>Danh sách nhiệm vụ chưa đầy đủ. Chưa thể giao nhiệm vụ.</p>}
  </section>}
  {permitted&&<fieldset className={styles.missions} disabled={current.phase!=="ready"||formLocked}>
   <legend>Nhiệm vụ đang làm có thể ghi Nhật ký <span aria-hidden="true">*</span></legend>
   {current.phase==="idle"||current.phase==="loading"?<p role="status">Đang xác nhận Mission từ Core…</p>:
    current.phase==="error"?<p role="alert">{current.message}</p>:
    checkingActiveMissions?<p role="status">Đang kiểm tra nhiệm vụ đang làm…</p>:
    activeMissions.length===0?<p role="status">Học viên chưa có nhiệm vụ đang làm.</p>:
    <div className={styles.choices}>{activeMissions.map(m=><div key={m.missionId} className={styles.choice}>
     <label><input type="checkbox" checked={missionIds.includes(m.missionId)} onChange={e=>toggleMission(m.missionId,e.target.checked)}/>
      <span>{m.code} · {m.name} <small>Cấp {m.level}</small></span>
     </label>
     {missionIds.includes(m.missionId)&&<label className={styles.complete}>
      <input type="checkbox" aria-label={"Nhiệm vụ hoàn tất: "+m.name}
       checked={completionStatus[m.missionId]==="VERIFIED"||completionIntent.includes(m.missionId)}
       disabled={formLocked||!writeAdmitted||!m.assignmentId||
        completionStatus[m.missionId]!=="IN_PROGRESS"}
       onChange={e=>setCompletionIntent(previous=>e.target.checked?
        [...previous.filter(id=>id!==m.missionId),m.missionId]:
        previous.filter(id=>id!==m.missionId))}/>
      Nhiệm vụ hoàn tất <small>{completionStatus[m.missionId]==="VERIFIED"?
       "Core đã xác nhận hoàn tất C1":completionStatus[m.missionId]==="UNVERIFIED"?
       "Chưa xác minh C1; không tự gửi lại":!m.assignmentId?
       "Chưa có Assignment hợp lệ":completionStatus[m.missionId]==="IN_PROGRESS"?
       "Ghi C1 sau khi Nhật ký được Core xác minh":
       "Đang đọc trạng thái C1 từ Core"}</small>
     </label>}
    </div>)}</div>}
   {eligibility?.hasMore&&<p className={styles.hint}>Danh sách chưa đầy đủ; chưa cho phép gửi.</p>}
  </fieldset>}
  <label className={styles.field}>Ghi chú quan sát
   <textarea rows={3} value={notes} disabled={formLocked} onChange={e=>{setNotes(e.target.value);setDraftDirty(true);}} placeholder="Ghi nhận hoạt động, tương tác và lưu ý của học viên"/>
  </label>
  <fieldset className={styles.missions} disabled={formLocked}><legend>Mức hứng thú</legend>
   <div className={styles.ratings}>{interestLabels.map((name,index)=><label key={name}><input type="radio" name={"diary-interest-"+classroom.id} checked={interest===index+1} onChange={()=>{setInterest(index+1);setDraftDirty(true);}}/>{index+1} · {name}</label>)}</div>
  </fieldset>
  {interest===1&&<label className={styles.field}>Khó khăn
   <textarea value={difficulty} disabled={formLocked} onChange={e=>{setDifficulty(e.target.value);setDraftDirty(true);}} rows={2}/>
  </label>}
  <p className={styles.hint}>Ảnh bằng chứng và ghi kết quả MissionResult sẽ được kết nối bằng các writer độc lập; hiện chưa gửi/lưu tệp.</p>
  {showValidation&&errors.length>0&&<ul role="alert" className={styles.errors}>{errors.map(e=><li key={e}>{e}</li>)}</ul>}
  {permitted&&<section className={styles.reloadPanel} aria-label="Đối soát Nhật ký sau khi tải lại trang">
   <strong>Đối soát Nhật ký đã có</strong>
   <p className={styles.hint}>Sau khi tải lại trang, nhập ID Diary đã ghi nhận và chọn các Mission để kiểm tra trực tiếp trên Core. Chỉ xem, không lưu hoặc retry.</p>
   <fieldset className={styles.missions} disabled={busy||reloadBusy||recovering||!eligibility}>
    <legend>Nhiệm vụ cần đối soát (chỉ đọc)</legend>
    {specialtyRows.map(m=><label key={m.missionId} className={styles.field}>
     <input type="checkbox" checked={recoveryMissionIds.includes(m.missionId)} onChange={e=>{
      reloadGeneration.current++;setReloadReceipt(null);setRegisterRecovery(null);
      setRecoveryMissionIds(previous=>e.target.checked?[...previous.filter(id=>id!==m.missionId),m.missionId]:previous.filter(id=>id!==m.missionId));
     }}/>{m.code} · {m.name}{m.available?"":" · Đang khóa"}
    </label>)}
   </fieldset>
   <label className={styles.field}>Diary ID đã biết
    <input type="text" maxLength={160} value={knownDiaryId} disabled={busy||reloadBusy||recovering} placeholder="ID từ biên nhận Nhật ký"
     onChange={e=>{reloadGeneration.current++;setKnownDiaryId(e.target.value);setReloadReceipt(null);}}/>
   </label>
   <button className={styles.secondary} type="button" disabled={busy||reloadBusy||!knownDiaryId.trim()||!recoveryMissionIds.length||!eligibility||eligibility.hasMore}
    onClick={()=>void inspectExistingDiary()}>{reloadBusy?"Đang đối soát…":"Kiểm tra Diary trên Core"}</button>
   {reloadReceipt&&<div className={reloadReceipt.state==="LINK_VERIFIED_READONLY"?styles.receiptSuccess:styles.receiptPending} role="status" aria-live="polite">
    <strong>{reloadReceipt.state==="LINK_VERIFIED_READONLY"?"Core đã xác minh":"Cần đối soát thêm"}</strong>
    <p>{reloadReceipt.message}</p>
    {reloadReceipt.diaryId&&<small>Diary ID: {reloadReceipt.diaryId}</small>}
    {reloadReceipt.pendingMissionIds.length>0&&<small>Mission chưa xác minh: {reloadReceipt.pendingMissionIds.join(", ")}</small>}
   </div>}
  </section>}
  {registerTicket.state==="UNAVAILABLE"&&<p role="status" className={styles.hint}>
   Không thể xác minh mã gửi gốc của tab. Chức năng tạo Nhật ký sẽ khóa để tránh trùng bản ghi.
  </p>}
  {registerTicket.state==="PENDING"&&<section className={styles.reloadPanel} aria-label="Đối soát khóa gửi Nhật ký gốc">
   <strong>Có bản gửi Nhật ký cần đối soát</strong>
   <p className={styles.hint}>Chọn lại đúng học viên và Nhiệm vụ từ Core, sau đó kiểm tra biên nhận gốc.
    Không tự tạo Diary mới hoặc gửi lại Register khi mất phản hồi.</p>
   <button type="button" className={styles.secondary} disabled={busy||recovering||reloadBusy||!permitted||
    !eligibility||eligibility.hasMore||recoveryMissionIds.length===0} onClick={()=>void inspectOriginalRegister()}>
    {recovering?"Đang đối soát biên nhận…":"Tìm Diary từ mã gửi gốc"}
   </button>
  </section>}
  {registerRecovery&&<div role="status" aria-live="polite"
   className={registerRecovery.state==="RECEIPT_FOUND_READONLY"?styles.receiptSuccess:styles.receiptPending}>
   <strong>{registerRecovery.state==="RECEIPT_FOUND_READONLY"?"Đã xác minh Core":"Cần đối soát thêm"}</strong>
   <p>{registerRecovery.message}</p>
   {registerRecovery.diaryId&&<small>Diary ID gốc: {registerRecovery.diaryId}</small>}
  </div>}
  {receiptView&&<div role="status" aria-live="polite" className={receiptView.severity==="success"?styles.receiptSuccess:styles.receiptPending}>
   <strong>{receiptView.title}</strong><p>{receiptView.message}</p>
   {receiptView.diaryId&&<small>Diary ID: {receiptView.diaryId}</small>}
   {receiptView.pendingMissionIds.length>0&&<small>Nhiệm vụ đang chờ: {receiptView.pendingMissionIds.join(", ")}</small>}
   {receiptView.canRetry&&<button className={styles.secondary} disabled={!canRetryDiary(receipt,writeAdmitted)||busy} type="button" onClick={()=>void retryDiary()}>Đối soát và thử lại trên cùng Diary</button>}
  </div>}
  {closeReceipt&&<div role="status" aria-live="polite"
   className={closeReceipt.state==="CLOSED_VERIFIED"?styles.receiptSuccess:styles.receiptPending}>
   <strong>{closeReceipt.state==="CLOSED_VERIFIED"?"Đã gửi":"Đang chờ Core xác nhận"}</strong>
   <p>{closeReceipt.state==="CLOSED_VERIFIED"?"Core đã xác nhận Nhật ký ở trạng thái Submitted.":
    closeReceipt.errorMessage??"Chưa xác minh được kết quả gửi. Giữ nguyên Diary để đối soát."}</p>
   {closeReceipt.diary&&<small>Diary ID: {closeReceipt.diary.id}</small>}
   {closeReceipt.state==="CLOSE_PENDING"&&<button className={styles.secondary} type="button" disabled={busy}
    onClick={()=>void retryClose()}>Đối soát và thử lại cùng Nhật ký</button>}
  </div>}
  {runtimeError&&<p role="alert" className={styles.errors}>{runtimeError}</p>}
  {completionMessage&&<p role="status" aria-live="polite" className={styles.hint}>{completionMessage}</p>}
  <div className={styles.actions}>
   <button type="button" className={styles.secondary} disabled={busy} onClick={()=>setShowValidation(true)}>Kiểm tra biểu mẫu</button>
   <button type="button" className={styles.primary}
    disabled={!writeAdmitted||busy||!permitted||!eligibility||eligibility.hasMore||!preflight||!missionIds.length||
     draftStatus.phase==="loading"||draftStatus.phase==="closed"||registerTicket.state!=="EMPTY"||
     closeReceipt?.state==="CLOSE_PENDING"}
    onClick={()=>void submitDiary()} aria-describedby={!writeAdmitted?"tos-diary-admission-message":undefined}>Gửi Nhật ký</button>
  </div>
  {!writeAdmitted&&<p id="tos-diary-admission-message" className={styles.hint}>Chưa thể gửi Nhật ký ở lớp này.</p>}
 </section>;
}
