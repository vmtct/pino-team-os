"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {BoProperties} from "@/app/bo/components/BoProperties";
import {BoPill} from "@/app/bo/components/registration/BoValue";
import {money,type PeriodStaffPage} from "@/lib/bo-payroll-period-api";
import {settlementDrawerSource,settlementDrawerExceptions,pendingSettlementException,settlementExceptionHref} from "@/lib/bo-payroll-settlement-drawer";
import {loadIncomeHistory} from "@/lib/bo-payroll-income-read";
import {toExceptionReadRow} from "@/lib/bo-payroll-exceptions-model";
import {payrollVerifiedName} from "@/lib/bo-payroll-safe-read-metadata";
import type {NativeReviewedException} from "@/lib/bo-payroll-exceptions-read";

const date=(v:string)=>v.split("-").reverse().join("/");
const statusLabels={DRAFT:"Bản nháp",PENDING:"Chờ duyệt",FINALIZED:"Đã chốt",PAID:"Đã thanh toán",ARCHIVED_UNAVAILABLE:"Không đủ dữ liệu"};
export function SettlementIncomeDrawer({centerId,period,staffId,onClose}:{centerId:string;period:PeriodStaffPage["period"];staffId:string;onClose:()=>void}){
 const [result,setResult]=useState<{source:ReturnType<typeof settlementDrawerSource>;exceptions:NativeReviewedException[];exceptionError:string}|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{
  let live=true;
  void (async()=>{
   const {current}=await loadIncomeHistory(centerId,period.id,staffId);
   if(current.period.startDate!==period.startDate||current.period.endDate!==period.endDate)throw Error("Kỳ lương đã thay đổi. Vui lòng tải lại.");
   const source=settlementDrawerSource(current,centerId,period.id,staffId);
   let exceptions:NativeReviewedException[]=[];let exceptionError="";
   try{exceptions=await settlementDrawerExceptions(current,centerId,period.id,staffId);}
   catch{exceptionError="Không xác minh được danh sách ngoại lệ từ Core.";}
   if(live)setResult({source,exceptions,exceptionError});
  })().catch(e=>{if(live)setError(e instanceof Error?e.message:"Không thể đọc thu nhập từ Core.");});
  return()=>{live=false;};
 },[centerId,period.id,period.startDate,period.endDate,staffId]);
 const source=result?.source;
 const href=(day?:string)=>"/bo/payroll-periods?"+new URLSearchParams({centerId,record:period.id,incomeStaff:staffId,...(day?{incomeDay:day,fromSettlement:"1"}:{})});
 return <DrawerFrame title={source?payrollVerifiedName(source.staff.staffName):"Thu nhập PTE"} path="Kỳ lương · Quyết Toán" onClose={onClose}
  footer={<><button type="button" className="secondary-btn" onClick={onClose}>Đóng</button>{source?<Link className="secondary-btn" href={href()}>Full Detail</Link>:null}</>}>
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
     {!source.frozen&&pendingSettlementException(source.preview.warnings,result.exceptions)?<p role="alert">Không thể quyết toán: còn yêu cầu ngoại lệ chưa duyệt.</p>:null}
    </section>
    <section className="property-section" aria-label="Ngày công"><h3>Ngày công</h3>
     {source.preview.days.length?<div className="pay-card-list">{source.preview.days.map(day=><Link key={day.workDate} className="pay-compact-day" href={href(day.workDate)}><span>{date(day.workDate)} · {day.paidMinutes??"—"} phút</span><strong>{money(day.amountMinor)}</strong><span>{day.status}</span></Link>)}</div>:<p>Không có ngày công trong snapshot này.</p>}
    </section>
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
