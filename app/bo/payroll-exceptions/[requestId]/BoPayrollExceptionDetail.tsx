"use client";
/** PAP-1955 · BO Exception immutable read-only Detail/Chuyên Sâu/Lịch Sử. */
import {useEffect,useState} from "react";
import {BoFullDetail} from "@/app/bo/components/BoFullDetail";
import {BoProperties} from "@/app/bo/components/BoProperties";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {exceptionReadApi,ExceptionReadError} from "@/lib/bo-payroll-exceptions-read";
import {toExceptionReadRow,minorVnd,type ExceptionReadRow} from "@/lib/bo-payroll-exceptions-model";
import {exceptionProperties} from "../BoPayrollExceptionsReadView";
type ExceptionDetailProps={requestId:string;activeTab?:string};
export default function BoPayrollExceptionDetail(props:ExceptionDetailProps){
 const scope=useBoCenterSelection(),centerId=scope?.selected??"";
 const allowed=Boolean(scope&&!scope.loading&&!scope.error&&centerId&&scope.centers.some(c=>c.id===centerId));
 // PAP-1972: discard prior record/error state when authorization or identity changes.
 return <ExceptionDetailScope key={JSON.stringify([centerId,allowed,props.requestId])} {...props}/>;
}
function ExceptionDetailScope({requestId,activeTab}:ExceptionDetailProps){
 const scope=useBoCenterSelection(),centerId=scope?.selected??"";
 const authorized=Boolean(scope&&!scope.loading&&!scope.error&&centerId&&scope.centers.some(c=>c.id===centerId));
 const [record,setRecord]=useState<{centerId:string;row:ExceptionReadRow}|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{
  let live=true;
  if(!authorized)return;
  void exceptionReadApi.detail(centerId,requestId).then(value=>{
   if(!live)return;
   if(value.data.id!==requestId)throw Error("PAYROLL_EXCEPTION_CROSS_REQUEST_RESPONSE");
   setRecord({centerId,row:toExceptionReadRow(value.data,centerId)});
   setError("");
  }).catch(e=>{if(!live)return;setRecord(null);
   setError(e instanceof ExceptionReadError&&e.status===403?
    "Không có quyền xem ngoại lệ tại cơ sở này.":
    e instanceof Error?e.message:"Không thể đọc Core Payroll.");
  });
  return()=>{live=false;};
 },[authorized,centerId,requestId]);
 if(!authorized)return <p role="alert">{scope?.error||"Chọn cơ sở được cấp quyền để xem ngoại lệ."}</p>;
 if(error)return <p role="alert">{error}</p>;
 if(!record||record.centerId!==centerId||record.row.id!==requestId)
  return <p role="status">Đang tải yêu cầu từ Core…</p>;
 const r=record.row;
 const tabs=[
  {id:"detail",label:"Detail",
   content:<BoProperties items={exceptionProperties.map(([name,render])=>({
    key:name,label:name,value:render(r)}))}/>},
  {id:"specialized",label:"Chuyên Sâu",content:<section>
   <h2>Nguồn yêu cầu</h2>
   <p>Đây là khoảng yêu cầu; không được hiểu là số phút hay tiền lương đã duyệt.</p>
   <BoProperties items={[
    {key:"assignment",label:"Mã phân công",value:r.assignmentId},
    {key:"requested",label:"Khoảng giờ yêu cầu",value:r.requestedWindow},
    {key:"reason",label:"Lý do nhân viên",value:r.requestReason},
    {key:"submittedBy",label:"Người gửi được xác thực",value:r.submittedBy},
   ]}/></section>},
  {id:"history",label:"Lịch Sử",content:<section>
   <h2>Quyết định Core</h2>
   {r.source.decision?<BoProperties items={[
    {key:"status",label:"Quyết định",value:r.statusLabel},
    {key:"minutes",label:"Số phút duyệt",value:r.reviewedMinutes===null?"—":String(r.reviewedMinutes)},
    {key:"money",label:"Số tiền Core duyệt",value:minorVnd(r.reviewedAmountMinor)},
    {key:"reason",label:"Lý do",value:r.decisionReason},
    {key:"reviewedAt",label:"Thời điểm quyết định",value:r.reviewedAt},
    {key:"reviewer",label:"Reviewer (legal full name)",value:r.reviewerName},
    {key:"reviewerId",label:"Reviewer ID (technical)",value:r.reviewerId??"—"},
   ]}/>:<p>Chưa có quyết định được Core ghi nhận.</p>}
  </section>},
 ];
 const url="/bo/payroll-exceptions/"+encodeURIComponent(requestId)+"?centerId="+encodeURIComponent(centerId);
 return <BoFullDetail title={"Ngoại lệ & thêm giờ · "+r.workDate}
  description={r.statusLabel+" · Chỉ đọc từ Core"}
  currentUrl={url} returnTo={"/bo/payroll-exceptions?centerId="+encodeURIComponent(centerId)}
  designVariant="v25" activeTab={activeTab} tabs={tabs}/>;
}
