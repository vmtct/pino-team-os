"use client";
import {useEffect,useState} from "react";
import {periodApi,money,type PayPeriod,type PeriodStaff,type PeriodStaffPage} from "@/lib/bo-payroll-period-api";
import {periodSummaries,staffWithWorkEvidence} from "@/lib/bo-payroll-read-model";
import {BoPill} from "./BoValue";
import type {BoRecord} from "@/lib/bo-registration";
export function BoPayrollPeriodDetail({record,tab}:{record:BoRecord;tab:"Detail"|"Quyết Toán"}){
 const [period,setPeriod]=useState<PayPeriod|null>(null);
 const [page,setPage]=useState<PeriodStaffPage|null>(null);
 const [rows,setRows]=useState<PeriodStaff[]>([]);
 const [offset,setOffset]=useState<number|null>(null);
 const [load,setLoad]=useState<"loading"|"ready"|"error">("loading");
 const [error,setError]=useState("");
 const centerId=String(record.centerId??"");
 useEffect(()=>{
  let live=true;
  void Promise.all([periodApi.get(centerId,record.id),periodApi.staff(centerId,record.id)])
   .then(([p,r])=>{if(!live)return;setPeriod(p.data);setPage(r.data);setRows(r.data.rows);setOffset(r.data.nextOffset);setLoad("ready");})
   .catch(e=>{if(!live)return;setLoad("error");setError(e instanceof Error?e.message:"Không thể đọc quyết toán");});
  return()=>{live=false;};
 },[centerId,record.id]);
 async function more(){
  if(offset===null)return;
  try{const p=await periodApi.staff(centerId,record.id,offset);
   setRows(r=>[...r,...p.data.rows]);setOffset(p.data.nextOffset);}
  catch(e){setError(e instanceof Error?e.message:"Không thể tải thêm PTE");}
 }
 if(!centerId||!record.id)return <div role="alert">Không đủ thông tin Center/kỳ lương.</div>;
 if(load==="loading")return <div role="status">Đang tải dữ liệu quyết toán…</div>;
 if(load==="error")return <div role="alert">{error}</div>;
 const totals=page?periodSummaries(page.periodTotals):null;
 const staff=staffWithWorkEvidence(rows);
 const props:[string,string][]=[
  ["Period ID",record.id],["Tên kỳ",String(record.name)],["Từ ngày",String(period?.startDate||record.startDate||"—")],
  ["Đến ngày",String(period?.endDate||record.endDate||"—")],
  ["Trạng thái",period?.status==="ARCHIVED"?"Lưu trữ":"Đang mở"],["Center",String(record.centerName||"—")]
 ];
 const kpis=<div className="payroll-ro-kpis" role="group" aria-label="Tổng lương kỳ">
  <div className="payroll-ro-kpi"><span>Tổng Dự Kiến</span><strong data-pay-total-expected>{totals?money(totals.expected):"—"}</strong></div>
  <div className="payroll-ro-kpi"><span>Tổng Quyết Toán</span><strong data-pay-total-finalized>{totals?money(totals.finalized):"—"}</strong></div>
 </div>;
 if(tab==="Detail")return <><section className="property-section"><h3>Chi tiết</h3>{props.map(([k,v])=><div key={k} className="property-row"><div className="property-label">{k}</div><div className="property-control">{v}</div></div>)}</section>{kpis}
  <section className="property-section"><h3>PTE đã tính được lương</h3><div className="payroll-ro-compact">{staff.filter(x=>x.amountMinor!==null).map(x=><div className="payroll-ro-compact-row" key={x.staffMemberId}><span>{x.staffMemberId}</span><strong>{money(x.amountMinor)}</strong></div>)}{!staff.some(x=>x.amountMinor!==null)?<div className="payroll-ro-empty">Chưa có lương tính được.</div>:null}</div></section></>;
 return <>{kpis}<section className="property-section"><h3>Quyết toán theo PTE</h3>{staff.length?
  <div className="table-scroll"><div className="payroll-ro-table" role="table" aria-label="Bảng quyết toán theo PTE">
   <div className="payroll-ro-row payroll-ro-head" role="row"><span role="columnheader">PTE</span><span role="columnheader">Thành tiền</span><span role="columnheader">Trạng thái</span><span role="columnheader">Thao tác</span></div>
   {staff.map(x=><div className="payroll-ro-row" role="row" key={x.staffMemberId}>
    <span role="cell">{x.staffMemberId}</span><strong role="cell" className="payroll-ro-amount">{money(x.amountMinor)}</strong>
    <span role="cell"><BoPill text={x.status==="FINALIZED"||x.status==="PAID"?"Đã chốt":x.status==="PENDING"?"Cần xử lý":x.status==="DRAFT"?"Bản nháp":"Không đủ dữ liệu"}/></span>
    <span role="cell">—</span>
   </div>)}</div></div>:<div className="payroll-ro-empty">Chưa có giờ công được xác nhận trong kỳ.</div>}</section>
   {offset!==null?<button type="button" className="secondary-btn" onClick={()=>void more()}>Tải thêm PTE</button>:null}
   {error?<p role="alert">{error}</p>:null}</>;
}
