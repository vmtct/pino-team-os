"use client";
import Link from "next/link";
import {useEffect,useState,useRef} from "react";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {BoProperties} from "@/app/bo/components/BoProperties";
import {BoPill} from "@/app/bo/components/registration/BoValue";
import {money,periodApi,type PeriodStaffPage,type SettlementPreview} from "@/lib/bo-payroll-period-api";
import {settlementDrawerSource,settlementDrawerExceptions,settlementReadiness,pendingSettlementException,verifiedSettlementPreview,settlementExceptionHref,canPreviewAdjustment,projectAdjustmentDraft} from "@/lib/bo-payroll-settlement-drawer";
import {loadIncomeHistory} from "@/lib/bo-payroll-income-read";
import {confirmAdjustment,AdjustmentConfirmationError,type AdjustmentCommand} from "@/lib/bo-payroll-adjustment-confirmation";
import {toExceptionReadRow} from "@/lib/bo-payroll-exceptions-model";
import {payrollVerifiedName} from "@/lib/bo-payroll-safe-read-metadata";
import type {NativeReviewedException} from "@/lib/bo-payroll-exceptions-read";

const date=(v:string)=>v.split("-").reverse().join("/");
const dayLabel=(status:string)=>({READY:"Đã tính",NO_ATTENDANCE:"Chưa chấm công",NO_ASSIGNMENT:"Thiếu phân công",PENDING_CHECKOUT:"Chưa checkout",RATE_MISSING:"Thiếu Rate HO",RECONCILIATION_REQUIRED:"Cần đối soát"} as Record<string,string>)[status]??"—";
const statusLabels={DRAFT:"Bản nháp",PENDING:"Chờ duyệt",FINALIZED:"Đã chốt",PAID:"Đã thanh toán",ARCHIVED_UNAVAILABLE:"Không đủ dữ liệu"};
export function SettlementIncomeDrawer({centerId,period,staffId,onClose,onFinalized,submitAdjustment,onAdjusted}:{centerId:string;period:PeriodStaffPage["period"];staffId:string;onClose:()=>void;onFinalized:()=>void;submitAdjustment?:(command:AdjustmentCommand)=>Promise<unknown>;onAdjusted?:()=>void}){
 const [result,setResult]=useState<{source:ReturnType<typeof settlementDrawerSource>;exceptions:NativeReviewedException[];exceptionError:string;capability:unknown}|null>(null);
 const [error,setError]=useState("");
 const [confirmation,setConfirmation]=useState<SettlementPreview|null>(null),[ack,setAck]=useState(false),[actionError,setActionError]=useState(""),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [adjustmentAmount,setAdjustmentAmount]=useState(""),[adjustmentReason,setAdjustmentReason]=useState(""),[adjustmentDraft,setAdjustmentDraft]=useState<ReturnType<typeof projectAdjustmentDraft>|null>(null),[adjustmentError,setAdjustmentError]=useState("");
 const inFlight=useRef(false),mounted=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  let live=true;
  void (async()=>{
   const {current,financialCapabilities}=await loadIncomeHistory(centerId,period.id,staffId);
   if(current.period.startDate!==period.startDate||current.period.endDate!==period.endDate||current.period.status!==period.status)throw Error("Kỳ lương đã thay đổi. Vui lòng tải lại.");
   const source=settlementDrawerSource(current,centerId,period.id,staffId);
   let exceptions:NativeReviewedException[]=[];let exceptionError="";
   try{exceptions=await settlementDrawerExceptions(current,centerId,period.id,staffId);}
   catch{exceptionError="Không xác minh được danh sách ngoại lệ từ Core.";}
   if(live)setResult({source,exceptions,exceptionError,capability:financialCapabilities});
  })().catch(e=>{if(live)setError(e instanceof Error?e.message:"Không thể đọc thu nhập từ Core.");});
  return()=>{live=false;};
 },[centerId,period.id,period.startDate,period.endDate,period.status,staffId]);
 const source=result?.source;
 const readiness=source&&result?settlementReadiness(source,result.capability,centerId,result.exceptions,result.exceptionError):null;
 const adjustmentEligible=!!source&&!!result&&canPreviewAdjustment(source,result.capability,centerId)&&source.staff.staffMemberId===staffId&&source.period.id===period.id&&!uncertain;
 const pending=!!source&&!source.frozen&&!!result&&pendingSettlementException(source.preview.warnings,result.exceptions);
 async function previewSettlement(){
  if(!source||readiness!=="PREVIEW_REQUIRED"||inFlight.current||uncertain)return;
  inFlight.current=true;setBusy(true);setActionError("");setAck(false);setConfirmation(null);setAdjustmentDraft(null);
  try{
   const {data}=await periodApi.preview(centerId,period.id,staffId);
   const verified=verifiedSettlementPreview(source,data);
   if(mounted.current)setConfirmation(verified);
  }catch(e){if(mounted.current)setActionError(e instanceof Error?e.message:"Không thể xem trước quyết toán.");}
  finally{inFlight.current=false;if(mounted.current)setBusy(false);}
 }
 async function confirmSettlement(){
  if(!source||!confirmation||!ack||readiness!=="PREVIEW_REQUIRED"||inFlight.current||uncertain)return;
  inFlight.current=true;setBusy(true);setActionError("");
  try{
   const verified=verifiedSettlementPreview(source,confirmation);
   const key="pay-finalize-"+crypto.randomUUID();
   // Explicit staff-specific confirmation; existing Core command reauthorizes and verifies the fingerprint.
   const {data}=await periodApi.finalize(centerId,period.id,staffId,verified,key);
   if(!data.id||data.status!=="FINALIZED")throw Error("PAYROLL_FINALIZE_RECEIPT_UNVERIFIED");
   const readback=await loadIncomeHistory(centerId,period.id,staffId);
   const locked=settlementDrawerSource(readback.current,centerId,period.id,staffId);
   if(locked.staff.status!=="FINALIZED"||locked.staff.settlementId!==data.id||locked.staff.amountMinor!==verified.amountMinor||locked.preview.sourceFingerprint!==verified.sourceFingerprint)
    throw Error("PAYROLL_FINALIZE_READBACK_UNVERIFIED");
   if(mounted.current)onFinalized();
  }catch{
   if(mounted.current){setUncertain(true);setConfirmation(null);setActionError("Chưa xác nhận được kết quả từ Core. Tải lại kỳ lương để kiểm tra trước khi thao tác tiếp.");}
  }finally{inFlight.current=false;if(mounted.current)setBusy(false);}
 }
 async function confirmAdjustmentDraft(){
  if(!source||!adjustmentDraft||!adjustmentEligible||!submitAdjustment||!result||confirmation||inFlight.current||uncertain)return;
  inFlight.current=true;setBusy(true);setActionError("");setAdjustmentError("");
  try{
   const after=await confirmAdjustment(source,adjustmentDraft,{read:loadIncomeHistory,submit:submitAdjustment,active:()=>mounted.current,nonce:()=>crypto.randomUUID()});
   if(mounted.current){
    const next=settlementDrawerSource(after.current,centerId,period.id,staffId);
    setResult({...result,source:next,capability:after.financialCapabilities});
    setAdjustmentAmount("");setAdjustmentReason("");setAdjustmentDraft(null);onAdjusted?.();
   }
  }catch(e){
   if(mounted.current){
    setAdjustmentDraft(null);setUncertain(true);
    setActionError(e instanceof AdjustmentConfirmationError&&!e.submitted?"Dữ liệu kỳ lương đã thay đổi hoặc không đủ quyền. Tải lại trước khi điều chỉnh.":"Chưa xác nhận được kết quả điều chỉnh từ Core. Tải lại kỳ lương trước khi thao tác tiếp.");
   }
  }finally{inFlight.current=false;if(mounted.current)setBusy(false)}
 }
 const close=()=>{if(!inFlight.current)onClose();};
 const href=(day?:string)=>"/bo/payroll-periods?"+new URLSearchParams({centerId,record:period.id,incomeStaff:staffId,...(day?{incomeDay:day,fromSettlement:"1"}:{})});
 return <DrawerFrame title={source?payrollVerifiedName(source.staff.staffName):"Thu nhập PTE"} path="Kỳ lương · Quyết Toán" onClose={close}
  footer={<><button type="button" className="secondary-btn" disabled={busy} onClick={close}>Đóng</button>{readiness==="PREVIEW_REQUIRED"||readiness==="PENDING_EXCEPTION"?<button type="button" className="primary-btn" disabled={busy||uncertain||!!confirmation} onClick={()=>{if(pending){setActionError("Không thể quyết toán: còn yêu cầu ngoại lệ chưa duyệt.");return;}void previewSettlement();}}>Quyết Toán</button>:source?<Link className="secondary-btn" href={href()}>Full Detail</Link>:null}</>}>
   {error?<p role="alert">{error}</p>:!source||!result?<p role="status">Đang tải thu nhập từ Core…</p>:<>
    <section className="property-section" aria-label="Tổng hợp kỳ lương">
     <h3>Tổng hợp kỳ lương</h3>
     <BoProperties authority compact items={[
      {key:"staff",label:"PTE",value:payrollVerifiedName(source.staff.staffName)},
      {key:"period",label:"Kỳ lương",value:source.period.name},
      {key:"dates",label:"Khoảng ngày",value:date(source.period.startDate)+" – "+date(source.period.endDate)},
      {key:"status",label:"Trạng thái",value:statusLabels[source.staff.status]},
      {key:"amount",label:"Thu nhập trong kỳ",value:money(source.staff.amountMinor)},
      {key:"adjustments",label:"Điều chỉnh",value:money(source.preview.adjustmentsMinor)},
      {key:"extra",label:"Thêm giờ",value:money(source.preview.extraTimeMinor)}
     ]}/>
     {source.frozen?<p role="status">Thu nhập đã chốt là snapshot cố định từ Core.</p>:null}
     {pending?<p role="alert">Không thể quyết toán: còn yêu cầu ngoại lệ chưa duyệt.</p>:null}
     {readiness==="EXCEPTIONS_UNVERIFIED"||readiness==="SOURCE_UNVERIFIED"?<p role="alert">Chưa xác minh đủ dữ liệu để quyết toán. Vui lòng tải lại.</p>:null}
     {readiness==="PREVIEW_REQUIRED"?<p role="status">Cần xem trước và xác nhận dữ liệu trước khi quyết toán.</p>:null}
    </section>
    {actionError?<p role="alert">{actionError}</p>:null}
    {confirmation?<section className="property-section" aria-label="Xác nhận quyết toán"><h3>Xác nhận quyết toán</h3>
     <BoProperties authority compact items={[{key:"staff",label:"PTE",value:payrollVerifiedName(source.staff.staffName)},{key:"amount",label:"Số tiền chốt",value:money(confirmation.amountMinor)}]}/>
     {confirmation.warnings.length?<ul>{confirmation.warnings.map(w=><li key={w}>{w}</li>)}</ul>:null}
     <p>Khoản thu nhập đã chốt sẽ không được sửa trực tiếp.</p>
     <label><input type="checkbox" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)}/> Tôi đã kiểm tra số tiền và các cảnh báo.</label>
     <div className="editor-actions"><button type="button" className="secondary-btn" disabled={busy} onClick={()=>{setConfirmation(null);setAck(false);}}>Hủy</button><button type="button" className="primary-btn" disabled={!ack||busy||uncertain} onClick={()=>void confirmSettlement()}>Xác nhận quyết toán</button></div>
    </section>:null}
    <section className="property-section" aria-label="Ngày công"><h3>Ngày công</h3>
     {source.preview.days.length?<div className="pay-card-list">{source.preview.days.map(day=><Link key={day.workDate} className="pay-compact-day" href={href(day.workDate)}><span>{date(day.workDate)} · {day.paidMinutes??"—"} phút</span><strong>{money(day.amountMinor)}</strong><span>{dayLabel(day.status)}</span></Link>)}</div>:<p>Không có ngày công trong snapshot này.</p>}
    </section>
    <section className="property-section" aria-label="Điều chỉnh"><h3>Điều chỉnh</h3>
     {source.preview.adjustments.length?<div className="pay-card-list">{source.preview.adjustments.map(a=><div className="pay-staff-card" key={a.id}><div><strong>{a.reason||"—"}</strong></div><div className="pay-staff-money"><strong>{a.amountMinor>0?"+":""}{money(a.amountMinor)}</strong></div></div>)}</div>:<p>Không có điều chỉnh trong kỳ.</p>}
    </section>
     {adjustmentEligible?<section className="property-section" aria-label="Xem trước điều chỉnh"><h3>Xem trước điều chỉnh</h3>
      <div className="property-row"><label className="property-label" htmlFor="pay-adjustment-amount"><small aria-hidden="true">≡</small>Số tiền điều chỉnh (VND)</label><div className="property-control"><input id="pay-adjustment-amount" className="edit-input" type="text" value={adjustmentAmount} maxLength={14} placeholder="+100000 hoặc -100000" disabled={busy||uncertain||!!confirmation} onChange={e=>{setAdjustmentAmount(e.target.value);setAdjustmentDraft(null);setAdjustmentError("");}}/></div></div>
      <div className="property-row"><label className="property-label" htmlFor="pay-adjustment-reason"><small aria-hidden="true">≡</small>Lý do</label><div className="property-control"><textarea id="pay-adjustment-reason" className="edit-input" rows={3} value={adjustmentReason} minLength={3} maxLength={500} required disabled={busy||uncertain||!!confirmation} onChange={e=>{setAdjustmentReason(e.target.value);setAdjustmentDraft(null);setAdjustmentError("");}}/></div></div>
      <div className="editor-actions"><button type="button" className="secondary-btn" disabled={busy||uncertain||!!confirmation} onClick={()=>{setAdjustmentAmount("");setAdjustmentReason("");setAdjustmentDraft(null);setAdjustmentError("");}}>Hủy</button><button type="button" className="save" disabled={busy||uncertain||!!confirmation||!adjustmentAmount.trim()||!adjustmentReason.trim()} onClick={()=>{try{setAdjustmentDraft(projectAdjustmentDraft(source,result.capability,centerId,adjustmentAmount,adjustmentReason));setAdjustmentError("");}catch(e){setAdjustmentDraft(null);setAdjustmentError(e instanceof Error?e.message:"Không thể xem trước điều chỉnh.");}}}>Xem trước</button></div>
      {adjustmentError?<p role="alert">{adjustmentError}</p>:null}
      {adjustmentDraft?<><BoProperties authority compact items={[{key:"current",label:"Thu nhập hiện tại",value:money(adjustmentDraft.currentAmountMinor)},{key:"delta",label:"Điều chỉnh",value:(adjustmentDraft.amountMinor>0?"+":"")+money(adjustmentDraft.amountMinor)},{key:"projected",label:"Thu nhập dự kiến",value:money(adjustmentDraft.projectedAmountMinor)},{key:"reason",label:"Lý do",value:adjustmentDraft.reason}]}/><p role="status">Chỉ xem trước. Chưa ghi nhận điều chỉnh vào Core.</p>{submitAdjustment?<div className="editor-actions"><button type="button" className="save" disabled={busy||uncertain||!!confirmation} onClick={()=>void confirmAdjustmentDraft()}>Xác nhận điều chỉnh</button></div>:null}</>:null}
     </section>:null}
    <section className="property-section" aria-label="Ngoại lệ và thêm giờ"><h3>Ngoại lệ &amp; thêm giờ</h3>
     {result.exceptionError?<p role="alert">{result.exceptionError}</p>:result.exceptions.length?<div className="pay-card-list">{result.exceptions.map(raw=>{
      const r=toExceptionReadRow(raw,centerId);
      return <Link key={r.id} className="pay-staff-card" href={settlementExceptionHref(centerId,period.id,staffId,r.id)}>
       <div><strong>{date(r.workDate)}</strong><small>{r.requestedWindow}</small><small>{r.requestReason}</small></div>
       <div className="pay-staff-money"><BoPill text={r.statusLabel} color={r.status==="APPROVED"?"green":r.status==="PENDING"?"orange":"gray"}/><small>{r.reviewedMinutes===null?"—":r.reviewedMinutes+" phút đã duyệt"}</small></div></Link>;
     })}</div>:<p>Không có ngoại lệ được ghi nhận trong kỳ.</p>}
    </section>
   </>}
 </DrawerFrame>;
}
