"use client";
import { useMemo, useState } from "react";
import {
  boStudentSpecialtyStatus,boStudentSpecialtyStatusText,validateBoStudentSpecialtyList,
} from "@/lib/bo-student-specialty-view";
import styles from "../components/BoFullDetail.module.css";

/** PAP-1496. BO Student business tab, no independent TDD shell or Core writer.
 * Props must come from an authorized Center-scoped Core Student reader.
 */
export function StudentSpecialtyTab({
  items, currentCenterLocalDate, onGrant, readOnly = false,
}: {
  items: unknown;
  currentCenterLocalDate: string;
  onGrant?: (specialtyId:string,startDate:string)=>Promise<void>;
  readOnly?: boolean;
}) {
  const [startDates,setStartDates]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const state=useMemo(()=>{
    try{return{rows:validateBoStudentSpecialtyList(items),error:""};}
    catch{return{rows:[],error:"Chưa tải được quyền Chuyên Đề. Vui lòng tải lại dữ liệu."};}
  },[items]);
  const validToday=/^\d{4}-\d{2}-\d{2}$/.test(currentCenterLocalDate);
  async function grant(id:string,canGrant:boolean,alreadyGranted:boolean){
    if(readOnly||!onGrant||!canGrant||alreadyGranted||busy||!validToday)return;
    const startDate=startDates[id]??currentCenterLocalDate;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||startDate<currentCenterLocalDate){
      setError("Ngày bắt đầu không được trước ngày hiện tại.");return;
    }
    setBusy(id);setError("");setNotice("");
    try{
      await onGrant(id,startDate);
      setNotice("Đã gửi yêu cầu mở khóa. Kiểm tra quyền vừa cập nhật từ Core.");
    }catch{
      setError("Không thể xác nhận mở khóa. Vui lòng kiểm tra và thử lại.");
    }finally{setBusy("");}
  }
  return <section className={styles.section} aria-label="Chuyên Đề của học viên">
    <h2>Chuyên Đề</h2>
    {state.error?<p role="alert">{state.error}</p>:null}
    {!state.error&&!state.rows.length?<p role="status">Chưa có Chuyên Đề khả dụng.</p>:null}
    {error?<p role="alert">{error}</p>:null}
    {notice?<p role="status">{notice}</p>:null}
    {!state.error&&state.rows.map(row=>{
      const status=boStudentSpecialtyStatus(row);
      const date=startDates[row.specialtyId]??currentCenterLocalDate;
      return <article key={row.specialtyId} aria-label={"Chuyên đề "+row.name}>
        <h3>{row.name}</h3>
        <p>{boStudentSpecialtyStatusText(status)} · {row.progress.completedDistinctMissionCount}/{row.progress.totalDistinctMissionCount} nhiệm vụ hoàn thành</p>
        {row.grant?<p>Ngày bắt đầu: <time dateTime={row.grant.startDate}>{row.grant.startDate}</time></p>:null}
        {row.progress.missingMissionIds.length>0?
          <p>Còn {row.progress.missingMissionIds.length} nhiệm vụ chưa hoàn thành.</p>:null}
        {!row.grant?<>
          {row.grantBlockReasons.length>0?<ul>{row.grantBlockReasons.map((reason,index)=><li key={index}>{reason}</li>)}</ul>:null}
          <label>Ngày bắt đầu
            <input type="date" min={validToday?currentCenterLocalDate:undefined}
              value={validToday?date:""} disabled={readOnly||!onGrant||!row.canGrant||Boolean(busy)||!validToday}
              onChange={event=>setStartDates(x=>({...x,[row.specialtyId]:event.target.value}))}/>
          </label>
          <button type="button" disabled={readOnly||!onGrant||!row.canGrant||Boolean(busy)||!validToday}
            onClick={()=>void grant(row.specialtyId,row.canGrant,Boolean(row.grant))}>
            {busy===row.specialtyId?"Đang ghi nhận…":"Mở khóa Chuyên Đề"}
          </button>
        </>:null}
      </article>;
    })}
  </section>;
}
