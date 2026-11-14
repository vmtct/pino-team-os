"use client";
/** PAP-1954 · BO Salary Daily Full Detail, read only. */
import {useEffect,useState} from "react";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {BoFullDetail} from "@/app/bo/components/BoFullDetail";
import {dailyReadApi,DailyReadError} from "@/lib/bo-payroll-daily-api";
import {payrollDailyRow,type BoPayrollDailyRow} from "@/lib/bo-payroll-daily-view-model";
import {dailyPropertyFields} from "../../BoPayrollDailyReadView";
import styles from "../../bo-payroll-daily.module.css";
function Properties({row}:{row:BoPayrollDailyRow}){
 return <dl className={styles.properties}>{dailyPropertyFields.map(([name,render])=>
  <div key={name}><dt>{name}</dt><dd>{render(row)}</dd></div>)}</dl>;
}
export default function BoPayrollDailyDetail({staffMemberId,workDate,activeTab}:{
 staffMemberId:string;workDate:string;activeTab?:string;
}){
 const scope=useBoCenterSelection(),centerId=scope?.selected??"";
 const allowed=Boolean(scope&&!scope.loading&&!scope.error&&centerId&&scope.centers.some(c=>c.id===centerId));
 const [data,setData]=useState<{centerId:string;row:BoPayrollDailyRow}|null>(null);
 const [error,setError]=useState("");
 const url="/bo/payroll-daily/"+encodeURIComponent(staffMemberId)+"/"+encodeURIComponent(workDate)+
  "?centerId="+encodeURIComponent(centerId);
 useEffect(()=>{
  let live=true;
  if(!allowed)return;
  void dailyReadApi.detail(centerId,staffMemberId,workDate).then(reply=>{
   if(!live)return;setData({centerId,row:payrollDailyRow(reply.data,centerId)});setError("");
  }).catch(cause=>{if(!live)return;setData(null);
   setError(cause instanceof DailyReadError&&cause.status===403?
    "Không có quyền xem dữ liệu lương tại cơ sở này.":
    cause instanceof Error?cause.message:"Không thể tải Core Payroll.");
  });
  return()=>{live=false;};
 },[allowed,centerId,staffMemberId,workDate]);
 if(!allowed)return <p role="alert">{scope?.error||"Chọn cơ sở được cấp quyền để xem lương."}</p>;
 if(error)return <p role="alert">{error}</p>;
 if(!data||data.centerId!==centerId||data.row.staffMemberId!==staffMemberId||
  data.row.workDate!==workDate)return <p role="status">Đang tải chi tiết Core…</p>;
 const row=data.row;
 const tabs=[
  {id:"detail",label:"Detail",content:<Properties row={row}/>},
  {id:"specialized",label:"Chuyên Sâu",content:<section className={styles.detail}>
   <h2>Chứng từ nguồn Core</h2>
   <p>Ngày công lấy từ phân công và chấm công được phép xem, không tính lương lại trên BO.</p>
   <dl className={styles.properties}>
    <div><dt>Mã phân công</dt><dd>{row.assignmentRefs}</dd></div>
    <div><dt>Check-in/out ghi nhận</dt><dd>{row.recordedInOut}</dd></div>
    <div><dt>Check-in/out hiệu lực</dt><dd>{row.actualInOut}</dd></div>
   </dl></section>},
  {id:"history",label:"Lịch Sử",content:<section className={styles.detail}>
   <h2>Điều chỉnh ngày công</h2>
   {row.override?<dl className={styles.properties}>
    <div><dt>Created Time</dt><dd>{row.override.createdAt}</dd></div>
    <div><dt>Created By</dt><dd>—</dd></div>
    <div><dt>Actor ID (technical)</dt><dd>{row.override.createdByUserId}</dd></div>
    <div><dt>Lý do</dt><dd>{row.override.reason}</dd></div>
   </dl>:<p>Core chưa trả về sự kiện điều chỉnh cho ngày này.</p>}
  </section>},
 ];
 return <BoFullDetail title={"Bảng lương ngày · "+row.workDate}
  description="Bản ghi ngày công dẫn xuất · Chỉ xem" currentUrl={url}
  returnTo={"/bo/payroll-daily?centerId="+encodeURIComponent(centerId)}
  designVariant="v25" activeTab={activeTab} tabs={tabs}/>;
}
