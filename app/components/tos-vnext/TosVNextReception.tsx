"use client";
/** PAP-942: exactly 3 Reception tabs, authenticated Core reads only. */
import {useEffect,useRef,useState} from "react";
import type {Assignment} from "@/lib/workforce-api";
import type {StudentVisit} from "@/lib/tos-day-of-learning-api";
import {receptionVisitReadModel} from "./core-adapters";
import {ownReceptionAssignments,pickupRequiresCoreVerification} from "@/lib/tos-vnext-reception";
import {TosVNextBottomNav,TosVNextButton,TosVNextCard,TosVNextField,TosVNextHeading,TosVNextStatus} from "./TosVNextUI";
import styles from "./tos-vnext.module.css";
type Tab="today"|"visits"|"pinoria";
export function TosVNextReception({centerId,workDate,assignments}:{
 centerId:string;workDate:string;assignments:readonly Assignment[];
}){
 const [tab,setTab]=useState<Tab>("today");
 const [studentId,setStudentId]=useState("");
 const [visit,setVisit]=useState<StudentVisit|null|undefined>();
 const [pending,setPending]=useState(false);
 const [error,setError]=useState("");
 const requestEpoch=useRef(0);
 const requestPending=useRef(false);
 useEffect(()=>{requestEpoch.current++;requestPending.current=false;setVisit(undefined);setError("");setPending(false);setStudentId("");},[centerId,workDate]);
 useEffect(()=>()=>{requestEpoch.current++;},[]);
 const today=ownReceptionAssignments(assignments,centerId,workDate);
 async function findVisit(){
  if(requestPending.current||!studentId.trim()||!centerId)return;
  const epoch=++requestEpoch.current;
  requestPending.current=true;setPending(true);setError("");setVisit(undefined);
  try{const result=await receptionVisitReadModel(centerId,studentId.trim());if(requestEpoch.current===epoch)setVisit(result)}
  catch(e){if(requestEpoch.current===epoch)setError(e instanceof Error?e.message:"Không thể tra cứu Student Visit.")}
  finally{if(requestEpoch.current===epoch){requestPending.current=false;setPending(false)}}
 }
 return <>
  {tab==="today"&&<>
   <TosVNextHeading title="Hôm Nay" meta={workDate}/>
   <TosVNextCard>
    <TosVNextHeading title="Ca Tiếp Tân" meta={String(today.length)+" ca"}/>
    {today.length===0?<p className={styles.secondary}>Không có ca Tiếp Tân trong lịch của bạn hôm nay.</p>:
     today.map(a=><div className={styles.trainingCertRow} key={a.id}>
      <strong>{a.shift?.displayLabel||"Ca phân công"}</strong>
      <TosVNextStatus>{a.status}</TosVNextStatus>
      <small>{a.effectiveStartLocal||a.shift?.startLocalTime||"Chưa có giờ"} — {a.effectiveEndLocal||a.shift?.endLocalTime||"Chưa có giờ"}</small>
     </div>)}
    <p className={styles.secondary}>Lịch lấy từ Workforce Core của chính nhân viên, không tạo ca ảo.</p>
   </TosVNextCard>
   <TosVNextCard><TosVNextHeading title="Mở Ca"/>
    <p className={styles.secondary}>Bằng chứng camera, checklist và quyền Mở Ca đang chờ contract Core/PAP-759; không thể dùng ảnh minh họa để xác nhận.</p>
    <TosVNextButton disabled>Mở Ca · chờ xác minh</TosVNextButton>
   </TosVNextCard>
  </>}
  {tab==="visits"&&<>
   <TosVNextHeading title="Đón–Trả" meta="Student Visit · Core"/>
   <TosVNextCard>
    <TosVNextField label="Mã học viên Core">
     <input value={studentId} onChange={e=>{requestEpoch.current++;requestPending.current=false;setPending(false);setStudentId(e.target.value);setVisit(undefined);setError("")}}
      onKeyDown={e=>{if(e.key==="Enter"&&!e.nativeEvent.isComposing){e.preventDefault();void findVisit();}}}
      placeholder="Nhập ID học viên để tra cứu"/>
    </TosVNextField>
    <TosVNextButton onClick={()=>void findVisit()} disabled={pending||!studentId.trim()}>
     {pending?"Đang tìm…":"Tra cứu Student Visit"}
    </TosVNextButton>
    {error&&<p role="alert" className={styles.trainingError}>{error}</p>}
    {visit===null&&<p className={styles.secondary}>Không có Student Visit đang mở.</p>}
    {visit&&<><p className={styles.body}>Mã visit: {visit.id}</p>
     <p className={styles.secondary}>Đến: {visit.checkedInAt}</p>
     <p className={styles.secondary}>Trả: {visit.checkedOutAt||"Chưa có"}</p>
     <TosVNextStatus>Core revision {visit.version}</TosVNextStatus>
    </>}
   </TosVNextCard>
   <TosVNextCard>
    <TosVNextHeading title="Ghi nhận đón–trả"/>
    <p className={styles.secondary}>Chỉ mở thao tác ghi khi Core xác nhận quyền FRONT_DESK, danh tính người đón, idempotency và xử lý xung đột 409.</p>
    <TosVNextButton disabled={pickupRequiresCoreVerification()}>Check-in / Check-out</TosVNextButton>
   </TosVNextCard>
  </>}
  {tab==="pinoria"&&<>
   <TosVNextHeading title="Pinoria" meta="Core integration"/>
   <TosVNextCard><TosVNextStatus>Core API pending</TosVNextStatus>
    <p className={styles.body}>Quầy Wish chỉ mở sau khi có hợp đồng settlement được xác thực bởi Core.</p>
    <p className={styles.secondary}>Không cộng/trừ Wish, cấp vật phẩm hoặc ghi giao dịch mô phỏng.</p>
    <TosVNextButton disabled>Thao tác Pinoria</TosVNextButton>
   </TosVNextCard>
  </>}
  <TosVNextBottomNav label="Điều hướng Tiếp Tân" active={tab}
   onChange={id=>setTab(id as Tab)}
   items={[{id:"today",label:"Hôm Nay",icon:"◷"},{id:"visits",label:"Đón–Trả",icon:"⌂"},{id:"pinoria",label:"Pinoria",icon:"✦"}]}/>
 </>;
}
