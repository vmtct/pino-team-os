"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {BoFullDetail} from "@/app/bo/components/BoFullDetail";
import {BoProperties} from "@/app/bo/components/BoProperties";
import {loadIncomeHistory} from "@/lib/bo-payroll-income-read";
import {settlementExceptionDetail,settlementDrawerHref,settlementExceptionHref} from "@/lib/bo-payroll-settlement-drawer";
import {toExceptionReadRow,minorVnd,type ExceptionReadRow} from "@/lib/bo-payroll-exceptions-model";
import {exceptionProperties} from "../payroll-exceptions/BoPayrollExceptionsReadView";

/** PAP-1956 integrated detail only. Standalone PAP-1955 route stays unchanged. */
export function SettlementExceptionDetail({centerId,periodId,staffId,requestId,tab}:{centerId:string;periodId:string;staffId:string;requestId:string;tab:string|null}){
 const [row,setRow]=useState<ExceptionReadRow|null>(null),[error,setError]=useState("");
 const back=settlementDrawerHref(centerId,periodId,staffId);
 useEffect(()=>{
  let live=true;
  void (async()=>{
   const {current}=await loadIncomeHistory(centerId,periodId,staffId);
   const r=await settlementExceptionDetail(current,centerId,periodId,staffId,requestId);
   if(live)setRow(toExceptionReadRow(r,centerId));
  })().catch(()=>{if(live)setError("Không xác minh được ngoại lệ trong kỳ lương của PTE này.");});
  return()=>{live=false;};
 },[centerId,periodId,staffId,requestId]);
 if(error)return <><Link href={back}>Quay lại thu nhập</Link><p role="alert">{error}</p></>;
 if(!row)return <p role="status">Đang tải ngoại lệ từ Core…</p>;
 return <BoFullDetail title={"Ngoại lệ & thêm giờ · "+row.workDate} description={row.statusLabel+" · "+row.staffLegalName}
  currentUrl={settlementExceptionHref(centerId,periodId,staffId,requestId)} returnTo={back} designVariant="business-v25" activeTab={tab}
  tabs={[
  {id:"overview",label:"Thông tin",content:<section className="property-section"><BoProperties authority compact items={exceptionProperties.map(([label,render])=>({key:label,label,value:render(row)}))}/></section>},
  {id:"history",label:"Lịch Sử",content:<section className="property-section"><h3>Quyết định Core</h3>{row.source.decision?<BoProperties authority compact items={[
   {key:"status",label:"Quyết định",value:row.statusLabel},{key:"minutes",label:"Phút duyệt",value:row.reviewedMinutes??"—"},
   {key:"amount",label:"Tiền Core duyệt",value:minorVnd(row.reviewedAmountMinor)},{key:"reason",label:"Lý do",value:row.decisionReason},
   {key:"reviewer",label:"Người duyệt",value:row.reviewerName},{key:"reviewed",label:"Thời gian duyệt",value:row.reviewedAt}
  ]}/>:<p>Chưa có quyết định được Core ghi nhận.</p>}</section>}
 ]}/>;
}
