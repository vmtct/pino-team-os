"use client";
/** PAP-944: context-owned Shift Leader board from actual Core, no fake closeout. */
import {useEffect,useState} from "react";
import type {StaffDutyBoard} from "@/lib/workforce-api";
import {dutyContextReadModel} from "./core-adapters";
import {ownShiftLeadDutySummary} from "@/lib/tos-vnext-shift-lead";
import {TosVNextButton,TosVNextCard,TosVNextHeading,TosVNextStatus} from "./TosVNextUI";
import styles from "./tos-vnext.module.css";
export function TosVNextShiftLead({centerId,workDate}:{centerId:string;workDate:string}){
 const [board,setBoard]=useState<StaffDutyBoard|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [epoch,setEpoch]=useState(0);
 useEffect(()=>{
  let active=true;setLoading(true);setError("");setBoard(null);
  void dutyContextReadModel(centerId,workDate)
   .then(value=>{if(active)setBoard(value)})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:"Không thể tải bảng ca.")})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[centerId,workDate,epoch]);
 const summary=board?ownShiftLeadDutySummary(board):null;
 return <>
  <TosVNextHeading title="Trưởng Ca" meta={workDate}/>
  {loading&&<p role="status" className={styles.secondary}>Đang đọc nghĩa vụ từ Core…</p>}
  {error&&<TosVNextCard><p role="alert" className={styles.trainingError}>{error}</p>
   <TosVNextButton variant="secondary" onClick={()=>setEpoch(x=>x+1)}>Thử lại</TosVNextButton></TosVNextCard>}
  {board&&summary&&<>
   <TosVNextCard><TosVNextHeading title="Nghĩa vụ của ca" meta={summary.dutyCount+" mục"}/>
    <p className={styles.body}>Cần xử lý: {summary.pendingCount} · Đang chặn: {summary.blockingCount}</p>
    <TosVNextStatus>{summary.checkoutAllowed?"Core gate: được phép":"Core gate: chưa cho phép"}</TosVNextStatus>
    <p className={styles.secondary}>Gate: {summary.checkoutGateMode}. Đây là bảng duty của chính nhân viên, không phải quyền quản lý toàn Trạm.</p>
   </TosVNextCard>
   <TosVNextCard><TosVNextHeading title="Nhiệm vụ theo ca"/>
    {board.duties.length===0?<p className={styles.secondary}>Core không trả nghĩa vụ nào cho ngày này.</p>:
     board.duties.map(duty=><div key={duty.obligationId} className={styles.trainingCertRow}>
      <strong>{duty.type}</strong><TosVNextStatus>{duty.status}</TosVNextStatus>
      <small>{duty.kind} · nguồn: {duty.sourceDomain} · {duty.blocking?"Có chặn bàn giao":"Theo dõi"}</small>
     </div>)}
   </TosVNextCard>
   <TosVNextCard><TosVNextHeading title="Bàn Giao / Đóng Ca"/>
    {!!board.gate.blockers.length&&board.gate.blockers.map((b,i)=>
     <p className={styles.trainingError} key={i}>{b.code} · {b.sourceDomain||"Core"}</p>)}
    {!!summary.unavailableSources.length&&
     <p className={styles.trainingError}>Nguồn Core chưa sẵn sàng: {summary.unavailableSources.join(", ")}</p>}
    <p className={styles.secondary}>Closeout, ngoại lệ và settlement vẫn do Core quyết định; chưa cấp tác vụ Station-wide từ UI mới.</p>
    <TosVNextButton disabled title="Chưa tích hợp Core handoff write và readback">Xác nhận bàn giao</TosVNextButton>
   </TosVNextCard>
  </>}
 </>;
}
