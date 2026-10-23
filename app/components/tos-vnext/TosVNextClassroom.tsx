"use client";
/** PAP-945: top-down V18b Classroom projection with exact single detail header. */
import {useEffect,useState} from "react";
import {tosClassroomV18bApi,V18bCoreError,type V18bClassroomOccurrence}
 from "@/lib/tos-classroom-v18b-api";
import {TosVNextButton,TosVNextCard,TosVNextHeading,TosVNextStatus} from "./TosVNextUI";
import styles from "./tos-vnext.module.css";
export function TosVNextClassroom({centerId,localDate,onDetailChange}:{
 centerId:string;localDate:string;onDetailChange:(open:boolean)=>void
}){
 const [rows,setRows]=useState<V18bClassroomOccurrence[]>([]);
 const [selected,setSelected]=useState<V18bClassroomOccurrence|null>(null);
 const [busy,setBusy]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let valid=true;setBusy(true);setError("");setRows([]);setSelected(null);onDetailChange(false);
  void tosClassroomV18bApi.today(centerId,localDate)
   .then(day=>{if(valid)setRows(day.occurrences)})
   .catch(e=>{if(valid){setRows([]);setError(e instanceof V18bCoreError&&[404,501,503].includes(e.status)?
    "Core Classroom V18b chưa được phát hành hoặc chưa khả dụng. Không hiển thị danh sách giả.":
    e instanceof Error?e.message:"Không thể tải lớp học.");}})
   .finally(()=>{if(valid)setBusy(false)});
  return()=>{valid=false};
 // onDetailChange is only used at transition; avoid resetting on callback identity changes.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[centerId,localDate,refresh]);
 function open(row:V18bClassroomOccurrence){setSelected(row);onDetailChange(true)}
 function back(){setSelected(null);onDetailChange(false)}
 if(selected&&!busy&&!error)return <>
  <header className={styles.classDetailHeader} data-tos-vnext="classroom-detail-header">
   <button type="button" onClick={back} aria-label="Trở về danh sách lớp">‹</button>
   <div><strong>{selected.operationalName}</strong>
    <small>{selected.occurrence.localInterval?.startsAt||localDate}</small></div>
  </header>
  <TosVNextHeading title="Học viên" meta={selected.roster.length+" học viên"}/>
  {selected.roster.map(student=><TosVNextCard key={student.studentProfileId}>
   <TosVNextHeading title={student.studentDisplayName} meta={student.status==="CONFLICT"?"Cần kiểm tra":"Dự kiến"}/>
   <p className={styles.secondary}>{student.includedManually?"Được thêm vào lớp":"Theo Enrollment / Renewal Grace"}</p>
   <TosVNextButton disabled title="Chưa triển khai thao tác mở Path Diary trong UI">Mở Path Diary</TosVNextButton>
  </TosVNextCard>)}
  {selected.roster.length===0&&<TosVNextCard><p className={styles.secondary}>Core không trả học viên dự kiến cho lớp này.</p></TosVNextCard>}
  <TosVNextCard><TosVNextStatus>Diary Core pending</TosVNextStatus>
   <p className={styles.secondary}>Path Diary V18b phải xác minh quyền, Mission, media riêng tư và Core PR #1770 trước khi ghi.</p>
  </TosVNextCard>
 </>;
 return <>
  <TosVNextHeading title="Lớp Học" meta={localDate}/>
  {busy&&<p role="status" className={styles.secondary}>Đang đọc lớp từ Core…</p>}
  {error&&<TosVNextCard><p role="alert" className={styles.trainingError}>{error}</p>
   <TosVNextButton variant="secondary" onClick={()=>setRefresh(x=>x+1)}>Tải lại</TosVNextButton></TosVNextCard>}
  {!busy&&!error&&rows.length===0&&<TosVNextCard><p className={styles.secondary}>Không có lớp được phân công/được phép xem hôm nay.</p></TosVNextCard>}
  {!busy&&!error&&rows.map(row=><TosVNextCard key={row.teachingContextKey}>
   <TosVNextHeading title={row.operationalName}
    meta={row.occurrence.localInterval?.startsAt?.split("T")[1]?.slice(0,5)||localDate}/>
   <p className={styles.secondary}>{row.roster.length} học viên · {row.rosterCoverage==="ENROLLMENTS_AND_GRACE_ONLY"?"Enrollment / Grace":"Theo Core"}</p>
   <TosVNextButton variant="secondary" onClick={()=>open(row)}>Vào lớp</TosVNextButton>
  </TosVNextCard>)}
 </>;
}
