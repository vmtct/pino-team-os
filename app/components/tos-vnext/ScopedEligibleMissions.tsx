"use client";
/** PAP-945 / PAP-727: source-backed Mission choices, deliberately READ ONLY. */
import {useEffect,useState} from "react";
import {tosClassroomV18bApi,V18bCoreError,type V18bEligibleMissionChoice} from "@/lib/tos-classroom-v18b-api";
import type {ClassroomV4ViewModel,ScheduledClass} from "@/lib/tos-classroom-v4-view-model";
import styles from "./scoped-eligible-missions.module.css";

type State={key:string;phase:"idle"|"loading"|"ready"|"error";choices:V18bEligibleMissionChoice[];hasMore:boolean;message:string};
const empty:State={key:"",phase:"idle",choices:[],hasMore:false,message:""};

export default function ScopedEligibleMissions({model,classroom}:{model:ClassroomV4ViewModel;classroom:ScheduledClass}){
 const [studentId,setStudentId]=useState("");
 const [state,setState]=useState<State>(empty);
 const students=model.data.students.filter(s=>classroom.eligibleStudentIds.includes(s.id)&&!model.conflictStudentIds.includes(s.id));
 const authorized=students.some(s=>s.id===studentId);
 const key=JSON.stringify([model.centerId,classroom.runningClassId,model.today,classroom.id,studentId]);
 useEffect(()=>{
  if(!authorized)return;
  let active=true;
  setState({key,phase:"loading",choices:[],hasMore:false,message:""});
  void tosClassroomV18bApi.eligibleMissions({
   centerId:model.centerId,runningClassId:classroom.runningClassId,studentId,
   localDate:model.today,teachingContextKey:classroom.id,
  }).then(data=>{
   if(active)setState({key,phase:"ready",choices:data.items,hasMore:data.hasMore,message:""});
  }).catch(error=>{
   if(!active)return;
   const denied=error instanceof V18bCoreError&&(error.status===401||error.status===403);
   setState({key,phase:"error",choices:[],hasMore:false,
    message:denied?"Bạn không có quyền xem Nhiệm vụ của học viên này.":"Chưa thể tải Nhiệm vụ từ Core. Vui lòng thử lại sau."});
  });
  return()=>{active=false};
 },[key,authorized,model.centerId,classroom.runningClassId,classroom.id,model.today,studentId]);
 const current=authorized&&state.key===key?state:empty;
 return <section className={styles.panel} aria-label="Nhiệm vụ đủ điều kiện từ Core">
  <div className={styles.heading}><strong>Nhiệm vụ đủ điều kiện</strong><span>Chỉ xem · dữ liệu Core</span></div>
  <p className={styles.hint}>Danh sách này chỉ dành cho học viên đang thuộc roster lớp. Chưa kích hoạt giao nhiệm vụ hoặc ghi Nhật ký.</p>
  {students.length===0?<p className={styles.empty} role="status">Chưa có học viên hợp lệ trong roster để xem Nhiệm vụ.</p>:
   <label className={styles.label}>Học viên
    <select aria-label="Chọn học viên xem nhiệm vụ đủ điều kiện" value={authorized?studentId:""} onChange={e=>setStudentId(e.target.value)}>
     <option value="">Chọn học viên</option>
     {students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
   </label>}
  {authorized&&<div aria-live="polite">
   {current.phase==="idle"||current.phase==="loading"?<p className={styles.empty} role="status">Đang tải Nhiệm vụ hợp lệ…</p>:
    current.phase==="error"?<p className={styles.error} role="alert">{current.message}</p>:
    current.choices.length===0?<p className={styles.empty} role="status">Core chưa có Nhiệm vụ ACTIVE/READY phù hợp học viên và Path này.</p>:
    <ul className={styles.list}>{current.choices.map(m=><li key={m.missionId}><strong>{m.code} · {m.name}</strong><span>Cấp {m.level} · {m.assignmentId?"Đã có Assignment":"Chưa có Assignment"}</span></li>)}</ul>}
   {current.phase==="ready"&&current.hasMore&&<p className={styles.hint}>Còn Nhiệm vụ ở trang tiếp theo; danh sách này chưa đầy đủ.</p>}
  </div>}
 </section>;
}
