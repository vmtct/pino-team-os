"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import {boApi,BoApiError} from "@/lib/bo-api";
import type {BoLearnerSubscription,BoRunningClass} from "@/lib/bo-model";
import {BoDataGrid,BoDataGridCanonicalId,BoDataGridStatus,type BoDataGridColumn} from "@/app/bo/components/data-grid";
import {useBoDialog} from "@/app/bo/components/registration/useBoDialog";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {subscriptionModule} from "@/app/bo/components/registration/BoStudentSubscriptionRelation";
import {enrollmentStatus,todayInHouseTimeZone,isEligibleClass,type BoEnrollmentRecord,type BoEnrollmentPlacementState,type BoEnrollmentCapacity} from "@/lib/bo-enrollment-contract";
import styles from "./subscription-enrollment.module.css";
type Ready={state:"ready";subscription:BoLearnerSubscription;enrollments:BoEnrollmentRecord[];placement:BoEnrollmentPlacementState;classes:BoRunningClass[]};
type Load=Ready|{state:"loading"}|{state:"error"|"permission";message:string};
type Action="attach"|"transfer"|"activate";
type Pending={action:Action;rowId?:string;classId?:string;date:string;version?:number;reason:string;time?:string;minutes?:number;key:string;policyEffectiveAt:string};
const enrollmentModule={...subscriptionModule,label:"Enrollment",fields:subscriptionModule.fields.filter(f=>f.key==="id").map(f=>({...f,label:"Enrollment ID"}))};
function problem(error:unknown){if(error instanceof BoApiError&&[401,403].includes(error.status))return "Không đủ quyền trên Path/Center (401/403).";if(error instanceof BoApiError&&error.status===409)return "Core trả 409: dữ liệu, capacity hoặc version đã thay đổi.";return error instanceof Error?error.message:"Không thể xử lý Enrollment.";}
export function BoSubscriptionEnrollmentTab({subscriptionId,onChanged}:{subscriptionId:string;onChanged?:()=>void}){
 const [asOf]=useState(()=>todayInHouseTimeZone()),[tick,setTick]=useState(0);
 const [load,setLoad]=useState<Load>({state:"loading"}),[active,setActive]=useState<BoEnrollmentRecord|null>(null);
 const [action,setAction]=useState<Action|null>(null),[classId,setClassId]=useState(""),[date,setDate]=useState(()=>todayInHouseTimeZone());
 const [time,setTime]=useState("18:00"),[minutes,setMinutes]=useState("90"),[reason,setReason]=useState("");
 const [capacity,setCapacity]=useState<{state:"loading"|"ready"|"error";value?:BoEnrollmentCapacity;message?:string}|null>(null);
 const [pending,setPending]=useState<Pending|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const fence=useRef(0),lock=useRef(false),panel=useRef<HTMLElement>(null);
 const close=()=>{if(!busy){setAction(null);setActive(null);}};
 useBoDialog(Boolean(action),close,panel);
 const refresh=useCallback(()=>setTick(n=>n+1),[]);
 useEffect(()=>{const id=++fence.current;void Promise.all([
   boApi.subscriptionById(subscriptionId),boApi.subscriptionEnrollments(subscriptionId),
   boApi.subscriptionPlacement(subscriptionId,asOf),boApi.scopeCatalog()
 ]).then(([subscription,enrollments,placement,scope])=>{if(id===fence.current)setLoad({state:"ready",subscription,enrollments,placement,classes:scope.classes});})
 .catch(e=>{if(id===fence.current)setLoad({state:e instanceof BoApiError&&[401,403].includes(e.status)?"permission":"error",message:problem(e)});});
 return()=>{fence.current++};},[subscriptionId,asOf,tick]);
 const ready=load.state==="ready"?load:null;
 const clsById=useMemo(()=>new Map(ready?.classes.map(c=>[c.id,c])??[]),[ready]);
 const center=ready?.enrollments.length?clsById.get(ready.enrollments[0].runningClassId)?.centerId:undefined;
 const available=ready?.classes.filter(c=>isEligibleClass(c,ready.subscription.pathProgramId,center))??[];
 const chosen=clsById.get(classId),flex=chosen?.deliveryTopology==="FLEXIBLE_STUDIO";
 const columns:readonly BoDataGridColumn<BoEnrollmentRecord>[]=useMemo(()=>[
  {key:"runningClassId",header:"Running Class",sticky:true,width:225,render:r=>{
    const cls=clsById.get(r.runningClassId);
    const weekday=cls?.recurrenceWeekdays?.map(d=>["CN","T2","T3","T4","T5","T6","T7"][d===7?0:d]??String(d)).join(", ");
    return <span className={styles.classIdentity}><strong>{cls?.name??r.runningClassId}</strong>
      {cls?<small>{weekday?weekday+" · ":""}{cls.startLocalTime}–{cls.endLocalTime}</small>:null}</span>;
  }},
  {key:"id",header:"Enrollment ID",width:180,render:r=><BoDataGridCanonicalId value={r.id}/>},
  {key:"effectiveFromLocalDate",header:"Hiệu lực từ",width:145,render:r=>r.effectiveFromLocalDate},
  {key:"effectiveUntilExclusiveLocalDate",header:"Đến trước ngày",width:160,render:r=>r.effectiveUntilExclusiveLocalDate??"—"},
  {key:"predecessorEnrollmentId",header:"Enrollment trước",width:180,render:r=>r.predecessorEnrollmentId?<BoDataGridCanonicalId value={r.predecessorEnrollmentId}/>: "—"},
  {key:"version",header:"Version",width:80,render:r=>r.version},
  {key:"actions",header:"Thao tác",width:145,render:r=>enrollmentStatus(r,asOf)==="CURRENT"
   ? <button type="button" className="secondary-btn" disabled={busy||!!pending} onClick={()=>open("transfer",r)}>Chuyển lớp</button>
   : <span aria-label="Không có thao tác">—</span>}
 ],[clsById,asOf,busy,pending]);
 function open(next:Action,row?:BoEnrollmentRecord){
  if(pending||busy)return;setActive(row??null);setAction(next);setError("");setNotice("");
  const first=available.find(c=>c.id!==row?.runningClassId);
  setClassId(first?.id??"");setDate(asOf);setReason("");setTime(first?.startLocalTime??"18:00");
  setMinutes(String(first?.defaultParticipationMinutes??90));setCapacity(null);
 }
 useEffect(()=>{if(!action||!["attach","transfer"].includes(action)||!classId||!date||!ready)return;
  let alive=true;setCapacity({state:"loading"});
  void boApi.enrollmentCapacity({runningClassId:classId,targetLocalDate:date,subscriptionId,
   ...(flex?{plannedEntryLocalTime:time,plannedDurationMinutes:Number(minutes)}:{})})
  .then(v=>{if(alive)setCapacity({state:"ready",value:v});}).catch(e=>{if(alive)setCapacity({state:"error",message:problem(e)});});
  return()=>{alive=false;};
 },[action,classId,date,subscriptionId,ready?.subscription.id,flex,time,minutes]);
 function createAttempt():Pending|null{
  if(!ready||!action)return null;
  if(action==="activate"){
   if(ready.subscription.lifecycle!=="DRAFT"||ready.placement.placementState!=="PLACED"||
     ready.placement.effectiveEnrollmentCount!==ready.placement.weeklySessionCommitment||
     !(ready.subscription.serviceStartsOn??ready.subscription.contractualStartsOn)){setError("Core chưa xác nhận Draft đủ placement.");return null;}
   return{action,date:(ready.subscription.serviceStartsOn??ready.subscription.contractualStartsOn)!,reason:"",version:ready.subscription.version,key:crypto.randomUUID(),policyEffectiveAt:new Date().toISOString()};
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){setError("Ngày hiệu lực không hợp lệ.");return null;}
  if(!chosen||!isEligibleClass(chosen,ready.subscription.pathProgramId,center)||classId===active?.runningClassId||
    capacity?.state!=="ready"||capacity.value?.status==="HARD_BLOCKED"){setError("Chọn Running Class ACTIVE cùng Path/Center và chờ Core capacity hợp lệ.");return null;}
  if(flex&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||Number(minutes)<=0||!Number.isInteger(Number(minutes)))){setError("Flexible Studio cần giờ vào và số phút hợp lệ.");return null;}
  if(action==="transfer"&&(!active||!reason.trim()||date<=active.effectiveFromLocalDate||
   active.effectiveUntilExclusiveLocalDate!==null&&date>=active.effectiveUntilExclusiveLocalDate)){setError("Cần lý do và ngày chuyển lớp thuộc hiệu lực Enrollment.");return null;}
  if(action==="attach"&&ready.placement.effectiveEnrollmentCount>=ready.placement.weeklySessionCommitment){setError("Đã đủ số lớp; không được over-place.");return null;}
  return{action,rowId:active?.id,classId,date,reason:reason.trim(),
    ...(flex?{time,minutes:Number(minutes)}:{}),key:crypto.randomUUID(),policyEffectiveAt:new Date().toISOString()};
 }
 async function execute(attempt:Pending){
  if(lock.current)return;lock.current=true;setBusy(true);setError("");setNotice("");
  try{
   // After an ambiguous network failure, read canonical state before replaying the SAME key.
   if(pending){
    const records=await boApi.subscriptionEnrollments(subscriptionId);
    const done=attempt.action==="transfer"?records.some(r=>r.predecessorEnrollmentId===attempt.rowId&&r.runningClassId===attempt.classId&&r.effectiveFromLocalDate===attempt.date)
     :attempt.action==="attach"?records.some(r=>r.runningClassId===attempt.classId&&r.effectiveFromLocalDate===attempt.date)
     :(await boApi.subscriptionById(subscriptionId)).lifecycle==="ACTIVE";
    if(done){setPending(null);setAction(null);setNotice("Core xác nhận thao tác đã được thực hiện.");refresh();onChanged?.();return;}
   }
   const context={commandEffectiveLocalDate:attempt.date,policyEffectiveAt:attempt.policyEffectiveAt};
   if(attempt.action==="attach")await boApi.placeEnrollment({
    subscriptionId,runningClassId:attempt.classId!,effectiveFromLocalDate:attempt.date,
    ...(attempt.time?{plannedEntryLocalTime:attempt.time,plannedDurationMinutes:attempt.minutes}:{}),...context
   },attempt.key);
   if(attempt.action==="transfer")await boApi.transferEnrollment(attempt.rowId!,{
    destinationRunningClassId:attempt.classId!,transferLocalDate:attempt.date,reason:attempt.reason,
    ...(attempt.time?{plannedEntryLocalTime:attempt.time,plannedDurationMinutes:attempt.minutes}:{}),...context
   },attempt.key);
   if(attempt.action==="activate")await boApi.activateSubscription(subscriptionId,{
     serviceStartsOn:attempt.date,expectedVersion:attempt.version!
   },attempt.key);
   setPending(null);setAction(null);setActive(null);setNotice("Core đã xác nhận Enrollment.");refresh();onChanged?.();
  }catch(e){setPending(attempt);setError(problem(e)+" Không tạo key mới: đọc lại Core và thử lại cùng lệnh.");refresh();}
  finally{lock.current=false;setBusy(false);}
 }
 function submit(e:FormEvent){e.preventDefault();if(!action||busy||pending)return;const cmd=createAttempt();if(cmd)void execute(cmd);}
 return <section data-bo-s3-enrollment="core" className={styles.root} aria-label="Subscription Enrollment">
  <div className={styles.heading}>
   <div>
    <h3>Enrollment {ready?<span className={styles.count}>{ready.placement.effectiveEnrollmentCount} / {ready.placement.weeklySessionCommitment} lớp</span>:null}</h3>
    {ready?<div className={styles.summary}>
      <BoDataGridStatus value={ready.placement.placementState==="PLACED"?"Đã phân lớp":ready.placement.placementState==="PARTIALLY_PLACED"?"Phân lớp một phần":"Chưa phân lớp"}
       tone={ready.placement.placementState==="PLACED"?"success":ready.placement.placementState==="PARTIALLY_PLACED"?"warning":"neutral"}/>
    </div>:null}
   </div>
   <div className={styles.buttons}>
    <button className="primary-btn" type="button" disabled={!ready||busy||!!pending||!["DRAFT","ACTIVE"].includes(ready.subscription.lifecycle)||ready.placement.effectiveEnrollmentCount>=ready.placement.weeklySessionCommitment} onClick={()=>open("attach")}>＋ Gắn lớp</button>
    {ready?.subscription.lifecycle==="DRAFT"&&ready.placement.placementState==="PLACED"?<button className="primary-btn" type="button"
     disabled={!!pending||busy||ready.placement.effectiveEnrollmentCount!==ready.placement.weeklySessionCommitment} onClick={()=>open("activate")}>Kích hoạt</button>:null}
   </div>
  </div>
  {notice?<p role="status">{notice}</p>:null}
  {error?<p role="alert" className={styles.alert}>{error}</p>:null}
  <BoDataGrid caption="Subscription Enrollments" rows={ready?.enrollments??[]} rowKey={r=>r.id} columns={columns}
    state={load.state==="ready"?"ready":load.state} stateMessage={load.state==="error"||load.state==="permission"?load.message:undefined}
    rowsAlreadyFiltered quickViewOpener onRowOpen={setActive} selectedRowKey={active?.id}
    onRefresh={refresh} resultLabel={ready?ready.enrollments.length+" Enrollment":undefined}
    emptyTitle="Chưa có Enrollment" emptyMessage="Chọn Gắn lớp để chọn Running Class hợp lệ."/>
  {active&&!action?<BoQuickView module={enrollmentModule} record={{id:active.id,name:clsById.get(active.runningClassId)?.name??active.runningClassId}}
    onClose={()=>setActive(null)} hideDetailAction
    extraSection={<section className="property-section"><h3>Thông tin Enrollment</h3>
      {[
       ["Running Class",clsById.get(active.runningClassId)?.name??active.runningClassId],
       ["Bắt đầu",active.effectiveFromLocalDate],
       ["Đến trước ngày",active.effectiveUntilExclusiveLocalDate??"—"],
       ["Enrollment trước",active.predecessorEnrollmentId??"—"],
       ["Chuyển tiếp",active.transitionKind??"—"],["Version",String(active.version)]
      ].map(([key,value])=><div className="property-row" key={key}><span className="property-label">{key}</span><span>{value}</span></div>)}
      {enrollmentStatus(active,asOf)==="CURRENT"?<div className={styles.buttons}>
        <button type="button" className="secondary-btn" disabled={!!pending||busy} onClick={()=>open("transfer",active)}>Chuyển lớp</button>
      </div>:null}
    </section>}
   />:null}
  {action?<><div className="drawer-scrim visible" aria-hidden="true" onClick={close}/>
    <aside className="drawer open" ref={panel} role="dialog" aria-modal="true" aria-labelledby="s3-title">
      <div className="drawer-top"><div className="drawer-header-copy"><span className="drawer-path">Subscription · Enrollment</span>
       <h2 id="s3-title" className="drawer-record-title">{action==="attach"?"Gắn lớp":action==="transfer"?"Chuyển lớp":"Kích hoạt Draft"}</h2>
      </div><button type="button" className="drawer-close" aria-label="Đóng" disabled={busy||!!pending} onClick={close}>×</button></div>
      <form id="s3-form" className="drawer-content" onSubmit={submit}>
       {action==="activate"?<p>Chỉ kích hoạt sau khi Core trả PLACED, đủ commitment và version mới nhất.</p>:null}
       {action!=="activate"?<><div className="property-row"><label htmlFor="s3-class">Running Class</label>
         <select id="s3-class" className="edit-input" value={classId} disabled={busy||!!pending} onChange={e=>setClassId(e.target.value)}>
           <option value="">Chọn Running Class</option>
           {available.filter(c=>c.id!==active?.runningClassId).map(c=><option key={c.id} value={c.id}>{c.name} · {c.startLocalTime}</option>)}
         </select></div>
         <div className="property-row"><label htmlFor="s3-date">{action==="transfer"?"Ngày chuyển lớp":"Hiệu lực từ"}</label>
          <input id="s3-date" className="edit-input" type="date" value={date} disabled={busy||!!pending} onChange={e=>setDate(e.target.value)}/></div></>:null}
       {action!=="activate"&&flex?<><div className="property-row"><label htmlFor="s3-time">Giờ vào</label>
         <input id="s3-time" className="edit-input" type="time" value={time} onChange={e=>setTime(e.target.value)} disabled={busy||!!pending}/></div>
         <div className="property-row"><label htmlFor="s3-minutes">Thời lượng (phút)</label>
         <input id="s3-minutes" className="edit-input" type="number" step="1" min="1" value={minutes} onChange={e=>setMinutes(e.target.value)} disabled={busy||!!pending}/></div></>:null}
       {action==="transfer"?<div className="property-row"><label htmlFor="s3-reason">Lý do chuyển lớp</label>
         <textarea id="s3-reason" className="edit-input" value={reason} required disabled={busy||!!pending} onChange={e=>setReason(e.target.value)}/></div>:null}
       {action!=="activate"?<p role="status">Core capacity: {capacity?.state==="ready"?capacity.value?.status:capacity?.state==="error"?capacity.message:capacity?.state==="loading"?"Đang kiểm tra…":"Chọn lớp/ngày"}</p>:null}
       {error?<p role="alert" className={styles.alert}>{error}</p>:null}
      </form>
      <div className="drawer-footer"><div className="lab-bottom">
       <button className="secondary-btn" type="button" disabled={busy||!!pending} onClick={close}>Hủy</button>
       <button className="primary-btn" type="submit" form="s3-form" disabled={busy||!!pending||(action!=="activate"&&(capacity?.state!=="ready"||capacity.value?.status==="HARD_BLOCKED"))}>Xác nhận qua Core</button>
       {pending?<button className="secondary-btn" type="button" disabled={busy} onClick={()=>void execute(pending)}>Đọc lại Core / thử lại cùng key</button>:null}
      </div></div>
    </aside></>:null}
  {pending&&!action?<button type="button" className="secondary-btn" disabled={busy} onClick={()=>void execute(pending)}>Kiểm tra lệnh chưa xác nhận</button>:null}
 </section>;
}
