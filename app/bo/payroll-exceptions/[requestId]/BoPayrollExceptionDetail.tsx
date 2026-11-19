"use client";
/** PAP-1955 · BO Exception immutable read-only Detail/Chuyên Sâu/Lịch Sử. */
import {useEffect,useState,useRef} from "react";
import {BoFullDetail} from "@/app/bo/components/BoFullDetail";
import {PropertySections} from "@/app/components/workspace-renderer/Properties";
import {BoProperties} from "@/app/bo/components/BoProperties";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {exceptionReadApi,ExceptionReadError,canReviewStandalone,sameStandaloneRequest} from "@/lib/bo-payroll-exceptions-read";
import {toExceptionReadRow,minorVnd,type ExceptionReadRow} from "@/lib/bo-payroll-exceptions-model";
import {exceptionPresentation} from "../BoPayrollExceptionsReadView";
import {PayrollExceptionDecisionForm} from "../PayrollExceptionDecisionForm";
import {decisionPayload,localClock,reviewApi} from "@/lib/bo-payroll-extra-review-api";
import {verifiedReviewReceipt} from "@/lib/bo-payroll-settlement-drawer";
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
 const fields=exceptionPresentation.module.fields;
 const tabs=[
  {id:"detail",label:"Th\u00f4ng tin",
   content:<><PropertySections variant="detail" fields={fields} record={exceptionPresentation.record(r)} sections={[{id:"request",label:"Yêu cầu",fields:fields.slice(0,7).map(f=>f.key)},{id:"decision",label:"Quyết định",fields:fields.slice(7,-4).map(f=>f.key)},{id:"audit",label:"Lịch sử bản ghi",fields:fields.slice(-4).map(f=>f.key)}]}/>{canReviewStandalone(r.source,centerId,requestId)?<StandaloneReview key={r.id} row={r} onReviewed={row=>setRecord({centerId,row})}/>:null}</>},
  {id:"history",label:"Lịch Sử",content:<section>
   <h2>Quyết định Core</h2>
   {r.source.decision?<BoProperties authority compact items={[
    {key:"status",label:"Quyết định",value:r.statusLabel},
    {key:"minutes",label:"Số phút duyệt",value:r.reviewedMinutes===null?"—":String(r.reviewedMinutes)},
    {key:"money",label:"Số tiền Core duyệt",value:minorVnd(r.reviewedAmountMinor)},
    {key:"reason",label:"Lý do",value:r.decisionReason},
    {key:"reviewedAt",label:"Thời điểm quyết định",value:r.reviewedAt},
    {key:"reviewer",label:"Người duyệt",value:r.reviewerName},
   ]}/>:<p>Chưa có quyết định được Core ghi nhận.</p>}
  </section>},
 ];
 const url="/bo/payroll-exceptions/"+encodeURIComponent(requestId)+"?centerId="+encodeURIComponent(centerId);
 return <BoFullDetail title={"Ngoại lệ & thêm giờ · "+r.workDate}
  description={r.statusLabel+" · "+r.staffLegalName}
  currentUrl={url} returnTo={"/bo/payroll-exceptions?centerId="+encodeURIComponent(centerId)}
  designVariant="business-v25" activeTab={activeTab} tabs={tabs}/>;
}

function StandaloneReview({row,onReviewed}:{row:ExceptionReadRow;onReviewed:(row:ExceptionReadRow)=>void}){
 const [partial,setPartial]=useState(false),[from,setFrom]=useState(localClock(row.source.requestedStartAt)),[to,setTo]=useState(localClock(row.source.requestedEndAt)),[reason,setReason]=useState("");
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState("");
 const active=useRef(false),inFlight=useRef(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false}},[]);
 async function decide(mode:"FULL"|"PARTIAL"|"REJECTED"){
  if(inFlight.current||uncertain||!canReviewStandalone(row.source,row.source.centerId,row.id))return;
  let payload:ReturnType<typeof decisionPayload>;
  try{payload=decisionPayload(row.source,mode,from,to,reason)}catch(e){setError(e instanceof Error?e.message:"Invalid input");return}
  inFlight.current=true;setBusy(true);setError("");let submitted=false;
  try{
   const fresh=(await exceptionReadApi.detail(row.source.centerId,row.id)).data;
   if(!canReviewStandalone(fresh,row.source.centerId,row.id)||!sameStandaloneRequest(row.source,fresh))throw Error("Ngo\u1ea1i l\u1ec7 \u0111\u00e3 thay \u0111\u1ed5i. T\u1ea3i l\u1ea1i tr\u01b0\u1edbc khi thao t\u00e1c.");
   if(!active.current)return;
   submitted=true;
   const receipt=(await reviewApi.decide(payload,"pay-review-"+crypto.randomUUID())).data;
   const after=(await exceptionReadApi.detail(row.source.centerId,row.id)).data;
   verifiedReviewReceipt(fresh,receipt,after,payload);
   if(active.current)onReviewed(toExceptionReadRow(after,row.source.centerId));
  }catch(e){
   if(active.current){setUncertain(true);setError(submitted?"Ch\u01b0a x\u00e1c nh\u1eadn \u0111\u01b0\u1ee3c k\u1ebft qu\u1ea3. T\u1ea3i l\u1ea1i tr\u01b0\u1edbc khi thao t\u00e1c ti\u1ebfp.":e instanceof Error?e.message:"Cannot verify request");}
  }finally{inFlight.current=false;if(active.current)setBusy(false)}
 }
 return <>{error?<p role="alert">{error}</p>:null}<PayrollExceptionDecisionForm partial={partial} from={from} to={to} reason={reason} busy={busy} uncertain={uncertain} onPartial={setPartial} onFrom={setFrom} onTo={setTo} onReason={setReason} onDecision={mode=>void decide(mode)}/></>;
}
