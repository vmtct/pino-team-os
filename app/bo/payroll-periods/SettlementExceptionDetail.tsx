"use client";
import Link from "next/link";
import {PayrollExceptionDecisionForm} from "../payroll-exceptions/PayrollExceptionDecisionForm";
import {useEffect,useState,useRef} from "react";
import {BoFullDetail} from "@/app/bo/components/BoFullDetail";
import {BoProperties} from "@/app/bo/components/BoProperties";
import {loadIncomeHistory} from "@/lib/bo-payroll-income-read";
import {decisionPayload,localClock,reviewApi} from "@/lib/bo-payroll-extra-review-api";
import {settlementDrawerSource,canReviewSettlementException,verifiedReviewReceipt,settlementExceptionDetail,settlementDrawerHref,settlementExceptionHref} from "@/lib/bo-payroll-settlement-drawer";
import {toExceptionReadRow,minorVnd,type ExceptionReadRow} from "@/lib/bo-payroll-exceptions-model";
import {exceptionProperties} from "../payroll-exceptions/BoPayrollExceptionsReadView";

/** PAP-1956 integrated detail only. Standalone PAP-1955 route stays unchanged. */
export function SettlementExceptionDetail({centerId,periodId,staffId,requestId,tab}:{centerId:string;periodId:string;staffId:string;requestId:string;tab:string|null}){
 const [row,setRow]=useState<ExceptionReadRow|null>(null),[error,setError]=useState("");
 const back=settlementDrawerHref(centerId,periodId,staffId);
 const [eligible,setEligible]=useState(false),[partial,setPartial]=useState(false),[from,setFrom]=useState(""),[to,setTo]=useState(""),[reason,setReason]=useState("");
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[actionError,setActionError]=useState(""),[notice,setNotice]=useState("");
 const mounted=useRef(false),inFlight=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);

 useEffect(()=>{
  let live=true;
  void (async()=>{
   const {current,financialCapabilities}=await loadIncomeHistory(centerId,periodId,staffId);
   const r=await settlementExceptionDetail(current,centerId,periodId,staffId,requestId);
   if(live){
    setRow(toExceptionReadRow(r,centerId));
    setEligible(canReviewSettlementException(settlementDrawerSource(current,centerId,periodId,staffId),financialCapabilities,centerId,requestId,r));
    setFrom(localClock(r.requestedStartAt));setTo(localClock(r.requestedEndAt));
   }
  })().catch(()=>{if(live)setError("Không xác minh được ngoại lệ trong kỳ lương của PTE này.");});
  return()=>{live=false;};
 },[centerId,periodId,staffId,requestId]);
 async function decide(mode:"FULL"|"PARTIAL"|"REJECTED"){
  if(!row||!eligible||uncertain||inFlight.current)return;
  let payload:ReturnType<typeof decisionPayload>;
  try{payload=decisionPayload(row.source,mode,from,to,reason);}
  catch(e){setActionError(e instanceof Error?e.message:"Dữ liệu duyệt không hợp lệ.");return;}
  inFlight.current=true;setBusy(true);setActionError("");setNotice("");
  let submitted=false;
  try{
   const before=await loadIncomeHistory(centerId,periodId,staffId);
   const fresh=await settlementExceptionDetail(before.current,centerId,periodId,staffId,requestId);
   if(!canReviewSettlementException(settlementDrawerSource(before.current,centerId,periodId,staffId),before.financialCapabilities,centerId,requestId,fresh)||
      fresh.requestedStartAt!==row.source.requestedStartAt||fresh.requestedEndAt!==row.source.requestedEndAt||fresh.requestReason!==row.source.requestReason||fresh.workDate!==row.source.workDate)
    throw Error("Ngoại lệ đã thay đổi. Vui lòng tải lại.");
   if(!mounted.current)return;
   submitted=true;
   const receipt=(await reviewApi.decide(payload,"pay-review-"+crypto.randomUUID())).data;
   const after=await loadIncomeHistory(centerId,periodId,staffId);
   const verified=await settlementExceptionDetail(after.current,centerId,periodId,staffId,requestId);
   verifiedReviewReceipt(fresh,receipt,verified,payload);
   if(mounted.current){setRow(toExceptionReadRow(verified,centerId));setEligible(false);setNotice("Core đã xác nhận quyết định.");}
  }catch(e){
   if(mounted.current){setUncertain(submitted);setEligible(false);setActionError(submitted?"Chưa xác nhận được kết quả. Tải lại trước khi thao tác tiếp.":e instanceof Error?e.message:"Không xác minh được ngoại lệ.");}
  }finally{inFlight.current=false;if(mounted.current)setBusy(false);}
 }
 if(error)return <><Link href={back}>Quay lại thu nhập</Link><p role="alert">{error}</p></>;
 if(!row)return <p role="status">Đang tải ngoại lệ từ Core…</p>;
 return <BoFullDetail title={"Ngoại lệ & thêm giờ · "+row.workDate} description={row.statusLabel+" · "+row.staffLegalName}
  currentUrl={settlementExceptionHref(centerId,periodId,staffId,requestId)} returnTo={back} designVariant="business-v25" activeTab={tab}
  tabs={[
  {id:"overview",label:"Thông tin",content:<><section className="property-section"><BoProperties authority compact items={exceptionProperties.map(([label,render])=>({key:label,label,value:render(row)}))}/></section>{actionError?<p role="alert">{actionError}</p>:null}{notice?<p role="status">{notice}</p>:null}{eligible?<PayrollExceptionDecisionForm partial={partial} from={from} to={to} reason={reason} busy={busy} uncertain={uncertain} onPartial={setPartial} onFrom={setFrom} onTo={setTo} onReason={setReason} onDecision={mode=>void decide(mode)}/>:null}</>},
  {id:"history",label:"Lịch Sử",content:<section className="property-section"><h3>Quyết định Core</h3>{row.source.decision?<BoProperties authority compact items={[
   {key:"status",label:"Quyết định",value:row.statusLabel},{key:"minutes",label:"Phút duyệt",value:row.reviewedMinutes??"—"},
   {key:"amount",label:"Tiền Core duyệt",value:minorVnd(row.reviewedAmountMinor)},{key:"reason",label:"Lý do",value:row.decisionReason},
   {key:"reviewer",label:"Người duyệt",value:row.reviewerName},{key:"reviewed",label:"Thời gian duyệt",value:row.reviewedAt}
  ]}/>:<p>Chưa có quyết định được Core ghi nhận.</p>}</section>}
 ]}/>;
}
