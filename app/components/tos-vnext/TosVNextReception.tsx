"use client";
import {useEffect,useRef,useState} from "react";
import type {Assignment} from "@/lib/workforce-api";
import type {StudentVisit} from "@/lib/tos-day-of-learning-api";
import {receptionVisitReadModel} from "./core-adapters";
import {ownReceptionAssignments} from "@/lib/tos-vnext-reception";
import {TosVNextButton,TosVNextCard,TosVNextField,TosVNextStatus} from "../tos-ds";
import ReceptionV4Presentation from "./ReceptionV4Presentation";
import styles from "./tos-vnext.module.css";
export function TosVNextReception({centerId,workDate,assignments,centerName="",profileLabel=""}:{centerId:string;workDate:string;assignments:readonly Assignment[];centerName?:string;profileLabel?:string}){
 const [studentId,setStudentId]=useState("");
 const [visit,setVisit]=useState<StudentVisit|null|undefined>();
 const [pending,setPending]=useState(false);
 const [error,setError]=useState("");
 const requestEpoch=useRef(0);
 const requestPending=useRef(false);
 useEffect(()=>{requestEpoch.current++;requestPending.current=false;setVisit(undefined);setError("");setPending(false);setStudentId("");},[centerId,workDate]);
 useEffect(()=>()=>{requestEpoch.current++;},[]);

 async function findVisit(){
  if(requestPending.current||!studentId.trim()||!centerId)return;
  const epoch=++requestEpoch.current;
  requestPending.current=true;setPending(true);setError("");setVisit(undefined);
  try{const result=await receptionVisitReadModel(centerId,studentId.trim());if(requestEpoch.current===epoch)setVisit(result)}
  catch(e){if(requestEpoch.current===epoch)setError(e instanceof Error?e.message:"Không thể tra cứu Student Visit.")}
  finally{if(requestEpoch.current===epoch){requestPending.current=false;setPending(false)}}
 }
 const today=ownReceptionAssignments(assignments,centerId,workDate);
 const shiftTime=today.map(a=>(a.effectiveStartLocal||a.shift?.startLocalTime||"Chưa có giờ")+" — "+(a.effectiveEndLocal||a.shift?.endLocalTime||"Chưa có giờ")).join(" · ")||"Không có ca trong lịch hôm nay";
 return <ReceptionV4Presentation key={centerId+":"+workDate} centerName={centerName} profileLabel={profileLabel} workDate={workDate} shiftTime={shiftTime} visitLookup={<>
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
 </>}/>;
}
