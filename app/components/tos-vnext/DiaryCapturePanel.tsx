"use client";
/** PAP-945 — authentic V18b Diary form shell. Staging write admission remains OFF.
 * No fake Diary, MissionResult, media receipt or local-only persistence.
 */
import {useEffect,useMemo,useRef,useState} from "react";
import {tosClassroomV18bApi,V18bCoreError,V18B_WRITE_ADMITTED,type V18bEligibleMissionsRead} from "@/lib/tos-classroom-v18b-api";
import {prepareDiarySubmission} from "@/lib/tos-diary-submit-preflight";
import {validateDiaryCaptureDraft} from "@/lib/tos-diary-capture-validation";
import {createDiaryObservationWithLinks,resumeDiaryObservationWithLinks,type ObservationOutcome} from "@/lib/tos-diary-observation-workflow";
import {resumeDiaryMissionLinks} from "@/lib/tos-diary-mission-link-workflow";
import {diaryUiReceipt,canCreateDiary,canRetryDiary} from "@/lib/tos-diary-ui-receipt";
import {inspectDiaryAfterReload,type ReloadReceipt} from "@/lib/tos-diary-reload-inspection";
import {reconcileUnknownDiaryRegister,type LostAckResult} from "@/lib/tos-diary-register-receipt-recovery";
import {readDiaryTicket,stageDiaryTicket,clearVerifiedDiaryTicket,type DiaryTicketState} from "@/lib/tos-diary-register-ticket";
import type {ClassroomV4ViewModel,ScheduledClass} from "@/lib/tos-classroom-v4-view-model";
import styles from "./diary-capture.module.css";

type Read={key:string;phase:"idle"|"loading"|"ready"|"error";data:V18bEligibleMissionsRead|null;message:string};
const idle:Read={key:"",phase:"idle",data:null,message:""};
const interestLabels=["Phản kháng","Không tương tác","Tương tác","Hứng thú, đào sâu"] as const;
// A real writer may only be admitted after safe authenticated reload recovery and PAP-1222 E2E.
const UI_RELOAD_RECOVERY_ADMITTED=false;
function ticketStorage():Storage|null {
 try{return typeof window==="undefined"?null:window.sessionStorage}catch{return null}
}
export default function DiaryCapturePanel({model,classroom}:{model:ClassroomV4ViewModel;classroom:ScheduledClass}){
 const students=model.data.students.filter(s=>classroom.eligibleStudentIds.includes(s.id)&&!model.conflictStudentIds.includes(s.id));
 const [studentId,setStudentId]=useState("");
 const [read,setRead]=useState<Read>(idle);
 const [missionIds,setMissionIds]=useState<string[]>([]);
 const [notes,setNotes]=useState("");
 const [interest,setInterest]=useState<number|null>(null);
 const [difficulty,setDifficulty]=useState("");
 const [showValidation,setShowValidation]=useState(false);
 const [receipt,setReceipt]=useState<ObservationOutcome|null>(null);
 const [registerTicket,setRegisterTicket]=useState<DiaryTicketState>({state:"UNAVAILABLE",key:null});
 const [registerRecovery,setRegisterRecovery]=useState<LostAckResult|null>(null);
 const [recovering,setRecovering]=useState(false);
 const [busy,setBusy]=useState(false);
 const [runtimeError,setRuntimeError]=useState("");
 const [knownDiaryId,setKnownDiaryId]=useState("");
 const [reloadReceipt,setReloadReceipt]=useState<ReloadReceipt|null>(null);
 const [reloadBusy,setReloadBusy]=useState(false);
 const reloadGeneration=useRef(0);
 // Opening is a separate PAP-759 Core source. Local photo/presentation state is NOT proof.
 // Its source model is still UNAVAILABLE; do not admit a writer until Core opens it.
 const openingFromCore=model.openingReadState==="LOADED"&&
  Boolean(model.data.openings[classroom.id]?.openedAt&&model.data.openings[classroom.id]?.rounds?.some(r=>r.photos.length>0));
 const writeAdmitted=V18B_WRITE_ADMITTED&&UI_RELOAD_RECOVERY_ADMITTED&&openingFromCore;
 const locked=receipt!==null||busy||reloadBusy;
 const receiptView=diaryUiReceipt(receipt);
 const permitted=students.some(x=>x.id===studentId);
 const key=JSON.stringify([model.centerId,classroom.runningClassId,model.today,classroom.id,studentId]);
 useEffect(()=>{setRegisterTicket(readDiaryTicket(ticketStorage()));},[]);
 useEffect(()=>{reloadGeneration.current++;setKnownDiaryId("");setReloadReceipt(null);setRegisterRecovery(null);},[key]);
 useEffect(()=>{
  if(!permitted)return;
  let active=true;
  setRead({key,phase:"loading",data:null,message:""});
  void tosClassroomV18bApi.eligibleMissions({
   centerId:model.centerId,runningClassId:classroom.runningClassId,
   studentId,localDate:model.today,teachingContextKey:classroom.id,
  }).then(data=>{
   if(active)setRead({key,phase:"ready",data,message:""});
  }).catch(error=>{
   if(!active)return;
   setRead({key,phase:"error",data:null,
    message:error instanceof V18bCoreError&&[401,403].includes(error.status)
     ?"Bạn không có quyền xem Nhiệm vụ của học viên này."
     :"Không thể tải Mission hợp lệ từ Core. Vui lòng thử lại."});
  });
  return()=>{active=false};
 },[key,permitted,model.centerId,model.today,classroom.id,classroom.runningClassId,studentId]);
 const current=permitted&&read.key===key?read:idle;
 const eligibility=current.phase==="ready"?current.data:null;
 const chosen=useMemo(()=>missionIds.map(missionId=>{
  const row=eligibility?.items.find(x=>x.missionId===missionId);
  return {missionId,...(row?.assignmentId?{assignmentId:row.assignmentId}:{})};
 }),[eligibility,missionIds]);
 const preflight=useMemo(()=>{
  if(!permitted||!eligibility||eligibility.hasMore)return false;
  try{
   // Sentinel can only be used for local validation. Never a submitted idempotency key.
   prepareDiarySubmission({model,classroom,studentId,eligibility,selected:chosen,submissionKey:"PAP945_PREFLIGHT_ONLY"});
   return true;
  }catch{return false;}
 },[permitted,model,classroom,studentId,eligibility,chosen]);
 const errors=[
  ...validateDiaryCaptureDraft({studentId,missionIds,eligibleIds:eligibility?.items.map(x=>x.missionId)??[],
   eligibilityLoaded:current.phase==="ready",eligibilityHasMore:eligibility?.hasMore??false,notes,interest,difficulty}),
  ...(studentId&&current.phase==="error"?[current.message]:[]),
  ...(missionIds.length>0&&!preflight?["Mission hoặc ngữ cảnh học chưa được Core xác nhận."]:[]),
 ];
 async function submitDiary(){
  if(!canCreateDiary(receipt,writeAdmitted)||busy||!permitted||!eligibility||registerTicket.state!=="EMPTY")return;
  if(errors.length){setShowValidation(true);return;}
  setBusy(true);setRuntimeError("");
  try{
   const fresh=await tosClassroomV18bApi.eligibleMissions({centerId:model.centerId,
    runningClassId:classroom.runningClassId,studentId,localDate:model.today,teachingContextKey:classroom.id});
   if(fresh.hasMore)throw new V18bCoreError(409,"DIARY_ELIGIBILITY_INCOMPLETE","Danh sách Mission chưa đầy đủ.");
   const prepared=prepareDiarySubmission({model,classroom,studentId,eligibility:fresh,
    selected:chosen,submissionKey:crypto.randomUUID()});
   const storage=ticketStorage();
   // Save only the opaque original key BEFORE network, not student scope/notes.
   if(!stageDiaryTicket(storage,prepared.submissionKey))
    throw new V18bCoreError(503,"DIARY_TICKET_UNAVAILABLE","Còn bản gửi chưa đối soát hoặc không giữ được mã gửi gốc.");
   setRegisterTicket(readDiaryTicket(storage));
   const outcome=await createDiaryObservationWithLinks(tosClassroomV18bApi,{prepared,
    observation:{interest:interest!,notes,difficulty:difficulty.trim()||null}});
   setReceipt(outcome);
   if(outcome.state==="LINK_VERIFIED"&&clearVerifiedDiaryTicket(storage,prepared.submissionKey))
    setRegisterTicket(readDiaryTicket(storage));
  }catch(error){setRuntimeError(error instanceof V18bCoreError?error.message:
    "Chưa thể xác nhận lệnh gửi. Giữ mã gốc để đối soát, không Register lần hai.");}
  finally{setBusy(false);}
 }
 async function retryDiary(){
  if(!canRetryDiary(receipt,writeAdmitted)||busy||!receipt)return;
  setBusy(true);setRuntimeError("");
  try{
   const next=receipt.state==="OBSERVATION_PENDING"
    ?await resumeDiaryObservationWithLinks(tosClassroomV18bApi,receipt.plan)
    :receipt.state==="LINK_PENDING"
     ?await resumeDiaryMissionLinks(tosClassroomV18bApi,receipt.plan)
     :null;
   if(next){
    setReceipt(next);
    if(next.state==="LINK_VERIFIED"&&clearVerifiedDiaryTicket(ticketStorage(),next.plan.submissionKey))
     setRegisterTicket(readDiaryTicket(ticketStorage()));
   }
  }catch(error){setRuntimeError(error instanceof V18bCoreError?error.message:
   "Không đối soát được Diary gốc. Không tạo bản ghi thứ hai.");}
  finally{setBusy(false);}
 }
 async function inspectOriginalRegister(){
  if(busy||reloadBusy||recovering||!permitted||!eligibility||eligibility.hasMore||
   registerTicket.state!=="PENDING"||!missionIds.length)return;
  const generation=++reloadGeneration.current;
  setRecovering(true);setRuntimeError("");setRegisterRecovery(null);
  try{
   // Reconstruct original scope from fresh Core roster and Mission eligibility only.
   const fresh=await tosClassroomV18bApi.eligibleMissions({
    centerId:model.centerId,runningClassId:classroom.runningClassId,studentId,
    localDate:model.today,teachingContextKey:classroom.id,
   });
   if(fresh.hasMore)throw new V18bCoreError(409,"DIARY_ELIGIBILITY_INCOMPLETE","Danh sách Mission chưa đầy đủ.");
   const prepared=prepareDiarySubmission({model,classroom,studentId,eligibility:fresh,
    selected:chosen,submissionKey:registerTicket.key});
   const outcome=await reconcileUnknownDiaryRegister(tosClassroomV18bApi,{
    registration:prepared.registration,submissionKey:prepared.submissionKey,
    localDate:model.today,selectedMissionIds:chosen.map(x=>x.missionId),
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
  if(reloadBusy||busy||!permitted||!knownDiaryId.trim()||!missionIds.length||!eligibility||eligibility.hasMore)return;
  const generation=++reloadGeneration.current;
  setReloadReceipt(null);setReloadBusy(true);
  try{
   const found=await inspectDiaryAfterReload(tosClassroomV18bApi,{
    centerId:model.centerId,runningClassId:classroom.runningClassId,
    studentId,localDate:model.today,teachingContextKey:classroom.id,
    diaryId:knownDiaryId.trim(),selectedMissionIds:[...missionIds],
   });
   if(reloadGeneration.current===generation)setReloadReceipt(found);
  }finally{if(reloadGeneration.current===generation)setReloadBusy(false);}
 }
 function onStudent(value:string){
  reloadGeneration.current++;setStudentId(value);setRead(idle);setMissionIds([]);setNotes("");setInterest(null);setDifficulty("");setShowValidation(false);
  setKnownDiaryId("");setReloadReceipt(null);setReloadBusy(false);
 }
 function toggleMission(id:string,checked:boolean){
  reloadGeneration.current++;setReloadReceipt(null);setReloadBusy(false);
  setMissionIds(prev=>checked?[...prev.filter(x=>x!==id),id]:prev.filter(x=>x!==id));
 }
 return <section className={styles.panel} aria-label="Soạn Nhật ký lớp học từ dữ liệu Core">
  <div className={styles.heading}><h3>Nhật ký học viên</h3><span>Chưa mở quyền ghi</span></div>
  <p className={styles.hint}>Biểu mẫu đang hoàn thiện. Nội dung bạn nhập chưa được lưu; không có dữ liệu nào được gửi đến Core.</p>
  {students.length===0?<p role="status" className={styles.hint}>Lớp chưa có học viên hợp lệ trong roster để tạo Nhật ký.</p>:
   <label className={styles.field}>Học viên
    <select value={permitted?studentId:""} disabled={locked} onChange={e=>onStudent(e.target.value)}>
     <option value="">Chọn học viên</option>
     {students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
   </label>}
  {permitted&&<fieldset className={styles.missions} disabled={current.phase!=="ready"||locked}>
   <legend>Nhiệm vụ <span aria-hidden="true">*</span></legend>
   {current.phase==="idle"||current.phase==="loading"?<p role="status">Đang xác nhận Mission từ Core…</p>:
    current.phase==="error"?<p role="alert">{current.message}</p>:
    eligibility?.items.length===0?<p role="status">Không có Mission đủ điều kiện; không thể tạo Nhật ký.</p>:
    <div className={styles.choices}>{eligibility?.items.map(m=><div key={m.missionId} className={styles.choice}>
     <label><input type="checkbox" checked={missionIds.includes(m.missionId)} onChange={e=>toggleMission(m.missionId,e.target.checked)}/>
      <span>{m.code} · {m.name} <small>Cấp {m.level}</small></span>
     </label>
     {missionIds.includes(m.missionId)&&<label className={styles.complete}>
      <input type="checkbox" checked={false} disabled readOnly/>
      Nhiệm vụ hoàn tất <small>Chưa nhận kết quả MissionResult từ Core</small>
     </label>}
    </div>)}</div>}
   {eligibility?.hasMore&&<p className={styles.hint}>Danh sách chưa đầy đủ; chưa cho phép gửi.</p>}
  </fieldset>}
  <label className={styles.field}>Ghi chú quan sát
   <textarea rows={3} value={notes} disabled={locked} onChange={e=>setNotes(e.target.value)} placeholder="Ghi nhận hoạt động, tương tác và lưu ý của học viên"/>
  </label>
  <fieldset className={styles.missions} disabled={locked}><legend>Mức hứng thú</legend>
   <div className={styles.ratings}>{interestLabels.map((name,index)=><label key={name}><input type="radio" name={"diary-interest-"+classroom.id} checked={interest===index+1} onChange={()=>setInterest(index+1)}/>{index+1} · {name}</label>)}</div>
  </fieldset>
  {interest===1&&<label className={styles.field}>Khó khăn
   <textarea value={difficulty} disabled={locked} onChange={e=>setDifficulty(e.target.value)} rows={2}/>
  </label>}
  <p className={styles.hint}>Ảnh bằng chứng và ghi kết quả MissionResult sẽ được kết nối bằng các writer độc lập; hiện chưa gửi/lưu tệp.</p>
  {showValidation&&errors.length>0&&<ul role="alert" className={styles.errors}>{errors.map(e=><li key={e}>{e}</li>)}</ul>}
  {permitted&&<section className={styles.reloadPanel} aria-label="Đối soát Nhật ký sau khi tải lại trang">
   <strong>Đối soát Nhật ký đã có</strong>
   <p className={styles.hint}>Sau khi tải lại trang, nhập ID Diary đã ghi nhận và chọn các Mission để kiểm tra trực tiếp trên Core. Chỉ xem, không lưu hoặc retry.</p>
   <label className={styles.field}>Diary ID đã biết
    <input type="text" maxLength={160} value={knownDiaryId} disabled={busy||reloadBusy} placeholder="ID từ biên nhận Nhật ký"
     onChange={e=>{reloadGeneration.current++;setKnownDiaryId(e.target.value);setReloadReceipt(null);}}/>
   </label>
   <button className={styles.secondary} type="button" disabled={busy||reloadBusy||!knownDiaryId.trim()||!missionIds.length||!eligibility||eligibility.hasMore}
    onClick={()=>void inspectExistingDiary()}>{reloadBusy?"Đang đối soát…":"Kiểm tra Diary trên Core"}</button>
   {reloadReceipt&&<div className={reloadReceipt.state==="LINK_VERIFIED_READONLY"?styles.receiptSuccess:styles.receiptPending} role="status" aria-live="polite">
    <strong>{reloadReceipt.state==="LINK_VERIFIED_READONLY"?"Core đã xác minh":"Cần đối soát thêm"}</strong>
    <p>{reloadReceipt.message}</p>
    {reloadReceipt.diaryId&&<small>Diary ID: {reloadReceipt.diaryId}</small>}
    {reloadReceipt.pendingMissionIds.length>0&&<small>Mission chưa xác minh: {reloadReceipt.pendingMissionIds.join(", ")}</small>}
   </div>}
  </section>}
  {receiptView&&<div role="status" aria-live="polite" className={receiptView.severity==="success"?styles.receiptSuccess:styles.receiptPending}>
   <strong>{receiptView.title}</strong><p>{receiptView.message}</p>
   {receiptView.diaryId&&<small>Diary ID: {receiptView.diaryId}</small>}
   {receiptView.pendingMissionIds.length>0&&<small>Nhiệm vụ đang chờ: {receiptView.pendingMissionIds.join(", ")}</small>}
   {receiptView.canRetry&&<button className={styles.secondary} disabled={!canRetryDiary(receipt,writeAdmitted)||busy} type="button" onClick={()=>void retryDiary()}>Đối soát và thử lại trên cùng Diary</button>}
  </div>}
  {runtimeError&&<p role="alert" className={styles.errors}>{runtimeError}</p>}
  <div className={styles.actions}>
   <button type="button" className={styles.secondary} disabled={busy} onClick={()=>setShowValidation(true)}>Kiểm tra biểu mẫu</button>
   <button type="button" className={styles.primary} disabled={!canCreateDiary(receipt,writeAdmitted)||busy} onClick={()=>void submitDiary()} aria-describedby="tos-diary-admission-message">Gửi Nhật ký</button>
  </div>
  <p id="tos-diary-admission-message" className={styles.hint}>Chưa bật ghi Staging và khôi phục sau reload · Không tạo Diary, MissionResult hay Progression.</p>
 </section>;
}
