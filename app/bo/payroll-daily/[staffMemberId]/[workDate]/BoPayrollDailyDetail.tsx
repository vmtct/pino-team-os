"use client";
/** PAP-1954 · BO Salary Daily Full Detail, read only. */
import {useEffect,useState} from "react";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {BoFullDetail} from "@/app/bo/components/BoFullDetail";
import {dailyReadApi,DailyReadError} from "@/lib/bo-payroll-daily-api";
import {payrollDailyRow,type BoPayrollDailyRow} from "@/lib/bo-payroll-daily-view-model";
import {dailyPropertyFields} from "../../BoPayrollDailyReadView";
import {BoProperties} from "@/app/bo/components/BoProperties";
import {payrollAuditTime} from "@/lib/bo-payroll-safe-read-metadata";
function Properties({row}:{row:BoPayrollDailyRow}){
 return <BoProperties items={dailyPropertyFields.map(([name,render])=>({key:name,label:name,value:render(row)}))}/>;
}
type DailyDetailProps={staffMemberId:string;workDate:string;activeTab?:string};
export default function BoPayrollDailyDetail(props:DailyDetailProps){
 const scope=useBoCenterSelection(),centerId=scope?.selected??"";
 const allowed=Boolean(scope&&!scope.loading&&!scope.error&&centerId&&scope.centers.some(c=>c.id===centerId));
 // PAP-1972: changing identity or authorization discards both stale data and errors.
 return <DailyDetailScope key={JSON.stringify([centerId,allowed,props.staffMemberId,props.workDate])} {...props}/>;
}
function DailyDetailScope({staffMemberId,workDate,activeTab}:DailyDetailProps){
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
   if(!live)return;
   const row=payrollDailyRow(reply.data,centerId);
   if(row.staffMemberId!==staffMemberId||row.workDate!==workDate)throw Error("PAYROLL_DAILY_CROSS_RECORD_RESPONSE");
   setData({centerId,row});setError("");
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
  {id:"specialized",label:"Chuyên Sâu",content:<section>
   <h2>Chứng từ nguồn Core</h2>
   <p>Ngày công lấy từ phân công và chấm công được phép xem, không tính lương lại trên BO.</p>
   <BoProperties items={[{key:"assignment",label:"Mã phân công",value:row.assignmentRefs},
    {key:"recorded",label:"Check-in/out ghi nhận",value:row.recordedInOut},
    {key:"actual",label:"Check-in/out hiệu lực",value:row.actualInOut}]}/></section>},
  {id:"history",label:"Lịch Sử",content:<section>
   <h2>Điều chỉnh ngày công</h2>
   {row.override?<BoProperties items={[{key:"time",label:"Created Time",value:payrollAuditTime(row.override.createdAt)},
    {key:"by",label:"Created By",value:"—"},
    {key:"actor",label:"Actor ID (technical)",value:row.override.createdByUserId},
    {key:"reason",label:"Lý do",value:row.override.reason}]}/>:<p>Core chưa trả về sự kiện điều chỉnh cho ngày này.</p>}
  </section>},
 ];
 return <BoFullDetail title={"Bảng lương ngày · "+row.workDate}
  description="Bản ghi ngày công dẫn xuất · Chỉ xem" currentUrl={url}
  returnTo={"/bo/payroll-daily?centerId="+encodeURIComponent(centerId)}
  designVariant="v25" activeTab={activeTab} tabs={tabs}/>;
}
