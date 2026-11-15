"use client";
import Link from "next/link";
import {useCallback,useEffect,useRef,useState} from "react";
import {boApi} from "@/lib/bo-api";
import type {BoStaffCompensationEntry} from "@/lib/bo-model";
import {BoProperties} from "@/app/bo/components/BoProperties";
import {BoFullDetail} from "@/app/bo/components/BoFullDetail";
import {BoPill} from "@/app/bo/components/registration/BoValue";
import {loadIncomeHistory,scopedIncomeDay,verifiedCompensationRows,type IncomePeriod} from "@/lib/bo-payroll-income-read";
import {money} from "@/lib/bo-payroll-period-api";
import {payrollVerifiedName} from "@/lib/bo-payroll-safe-read-metadata";
const ROOT="/bo/payroll-periods";
const periodHref=(centerId:string,id:string)=>ROOT+"?"+new URLSearchParams({centerId,record:id,tab:"settlements"});
const date=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v.split("-").reverse().join("/"):"—";
const incomeHref=(centerId:string,id:string,staffId:string)=>ROOT+"?"+new URLSearchParams({centerId,record:id,incomeStaff:staffId});
const dayLabel=(status:string)=>({READY:"Đã tính",NO_ATTENDANCE:"Chưa chấm công",NO_ASSIGNMENT:"Thiếu phân công",PENDING_CHECKOUT:"Chưa checkout",RATE_MISSING:"Thiếu Rate HO",RECONCILIATION_REQUIRED:"Cần đối soát"} as Record<string,string>)[status]??"—";
const statuses={DRAFT:{text:"Bản nháp",color:"gray"},PENDING:{text:"Chờ duyệt",color:"orange"},FINALIZED:{text:"Đã chốt",color:"blue"},PAID:{text:"Đã thanh toán",color:"green"},ARCHIVED_UNAVAILABLE:{text:"Không đủ dữ liệu",color:"gray"}} as const;
export function PayrollIncomeDetail({centerId,centerName,id,staffId,tab,dayDate}:{centerId:string;centerName:string;id:string;staffId:string;tab:string|null;dayDate:string|null}){
 const [result,setResult]=useState<{rows:IncomePeriod[];error:string;nextOffset:number|null}|null>(null);
 useEffect(()=>{let live=true;void loadIncomeHistory(centerId,id,staffId).then(page=>{if(live)setResult({rows:[page.current,...page.rows],error:"",nextOffset:page.nextOffset});}).catch(()=>{if(live)setResult({rows:[],error:"Không thể tải thu nhập từ Core.",nextOffset:null});});return()=>{live=false;};},[centerId,id,staffId]);
 const [role,setRole]=useState<string|null>(null);
 const [rates,setRates]=useState<BoStaffCompensationEntry[]|null>(null);
 const [rateStatus,setRateStatus]=useState<"hidden"|"loading"|"ready"|"denied">("hidden");
 const generation=useRef(0);
 const invalidate=useCallback(()=>{generation.current++;},[]);
 const conceal=useCallback(()=>{invalidate();setRates(null);setRateStatus("hidden");},[invalidate]);
 useEffect(()=>{let live=true;void boApi.staffRecord(staffId).then(r=>{if(live&&r.id===staffId)setRole(r.roleLabel);}).catch(()=>{});return()=>{live=false;};},[staffId]);
 useEffect(()=>{const hide=()=>{if(document.hidden)conceal();};const pageHide=()=>conceal();document.addEventListener("visibilitychange",hide);window.addEventListener("pagehide",pageHide);return()=>{invalidate();document.removeEventListener("visibilitychange",hide);window.removeEventListener("pagehide",pageHide);};},[conceal,invalidate]);
 async function reveal(){const run=++generation.current;setRates(null);setRateStatus("loading");try{const data=await boApi.staffCompensation(staffId,centerId);if(run!==generation.current)return;setRates(verifiedCompensationRows(data,staffId));setRateStatus("ready");}catch{if(run===generation.current){setRates(null);setRateStatus("denied");}}}
 const currentRates=rates?.filter(r=>r.state==="CURRENT")??[];
 const rate=currentRates.length===1?currentRates[0]:null;
 const rateControl=rateStatus==="ready"?<button type="button" className="secondary-btn" onClick={conceal}>Ẩn thông tin lương</button>:<button type="button" className="secondary-btn" disabled={rateStatus==="loading"} onClick={()=>void reveal()}>Hiện lịch sử lương</button>;
 const [busy,setBusy]=useState(false),[pageError,setPageError]=useState("");
 async function more(){if(busy||!result||result.nextOffset===null)return;setBusy(true);setPageError("");try{const p=await loadIncomeHistory(centerId,id,staffId,result.nextOffset);if(p.rows.some(r=>result.rows.some(old=>old.period.id===r.period.id)))throw Error("Duplicate period");setResult({rows:[...result.rows,...p.rows],error:"",nextOffset:p.nextOffset});}catch{setPageError("Không thể tải thêm kỳ lương.");}finally{setBusy(false);}}
 const back=periodHref(centerId,id);
 if(!result)return <p role="status">Đang tải thu nhập…</p>;
 if(result.error)return <><Link href={back}>Quay lại kỳ lương</Link><p role="alert">{result.error}</p></>;
 const current=result.rows[0];
 if(!current)return <p role="alert">Không có dữ liệu thu nhập.</p>;
 if(dayDate){
  const day=scopedIncomeDay(current,dayDate);
  if(!day)return <><Link href={incomeHref(centerId,id,staffId)}>Quay lại thu nhập</Link><p role="alert">Không có ngày công trong kỳ này.</p></>;
  const frozen=current.staff.status==="FINALIZED"||current.staff.status==="PAID";
  const detailUrl=incomeHref(centerId,id,staffId)+"&incomeDay="+encodeURIComponent(dayDate);
  return <BoFullDetail title={payrollVerifiedName(current.staff.staffName)+" · "+date(dayDate)} description={centerName+" · "+current.period.name} currentUrl={detailUrl} returnTo={incomeHref(centerId,id,staffId)} activeTab={tab} tabs={[
   {id:"overview",label:"Thông tin",content:<section className="property-section"><h3>Chi tiết</h3><BoProperties items={[["PTE",payrollVerifiedName(current.staff.staffName)],["Ngày",date(dayDate)],["Phút trả lương",day.paidMinutes===null?"—":day.paidMinutes+" phút"],["Lương ngày",money(day.amountMinor)],["Trạng thái",dayLabel(day.status)],["Nguồn",frozen?"Snapshot kỳ đã chốt":"Core · kỳ hiện tại"]].map(([label,value])=>({key:label,label,value}))}/></section>},
   {id:"specialized",label:"Chuyên Sâu",content:<p>{frozen?"Snapshot cố định của kỳ lương; không tính lại từ dữ liệu hiện tại.":"Dữ liệu ngày công trong dự tính kỳ lương từ Core."}</p>},
   {id:"history",label:"Lịch Sử",content:<p role="status">Không có lịch sử riêng của ngày công trong projection này.</p>}
  ]}/>;
 }
 return <BoFullDetail title={payrollVerifiedName(current.staff.staffName)} description={"Thu nhập PTE · "+centerName} currentUrl={ROOT+"?"+new URLSearchParams({centerId,record:id,incomeStaff:staffId})} returnTo={back} activeTab={tab} tabs={[
 {id:"overview",label:"Thông tin",content:<>
 <section className="property-section"><h3>Thông tin PTE</h3><BoProperties items={[["PTE ID",staffId],["Họ tên",payrollVerifiedName(current.staff.staffName)],["Vai trò",role??"—"],["Rate HO",rate?money(rate.amountMinor):"—"],["Hiệu lực",rate?date(rate.effectiveFrom):"—"],["Chủ sở hữu Rate","HO (chỉ đọc tại BO)"],["Lương kỳ",money(current.staff.amountMinor)],["Tình trạng",statuses[current.staff.status].text],["Created Time","—"],["Created By","—"],["Last Modified Time","—"],["Last Modified By","—"]].map(([label,value])=>({key:label,label,value}))}/>{rateControl}{rateStatus==="denied"?<p role="alert">Không có quyền xem mức lương hoặc dữ liệu không khả dụng.</p>:null}</section>
 <section className="property-section"><h3>Thu nhập theo kỳ</h3><div className="pay-card-list">{result.rows.map(({period,staff})=><article className="pay-staff-card" key={period.id}><div><strong>{period.name}</strong><small>{date(period.startDate)} – {date(period.endDate)}</small></div><div className="pay-staff-money"><strong>{money(staff.amountMinor)}</strong><BoPill {...statuses[staff.status]}/></div><div className="pay-staff-actions"><Link className="secondary-btn" href={periodHref(centerId,period.id)}>Xem kỳ</Link></div>{staff.warnings?.length?<p role="status">Có khoản cần đối soát.</p>:null}</article>)}</div>{result.nextOffset!==null?<button type="button" className="secondary-btn" disabled={busy} onClick={()=>void more()}>Tải thêm kỳ</button>:null}{pageError?<p role="alert">{pageError}</p>:null}</section>
 <section className="property-section"><h3>Ngày công</h3><div className="pay-card-list">{result.rows.flatMap(({period,staff})=>(staff.preview?.days??[]).map(day=><Link href={incomeHref(centerId,period.id,staffId)+"&incomeDay="+encodeURIComponent(day.workDate)} key={period.id+":"+day.workDate} className="pay-compact-day"><span>{date(day.workDate)} · {day.paidMinutes??"—"} phút</span><strong>{money(day.amountMinor)}</strong><span>{dayLabel(day.status)}</span></Link>))}</div></section>
 </>},
 {id:"history",label:"Lịch Sử",content:<section className="property-section"><h3>Lịch sử Rate HO</h3>{rateControl}{rateStatus==="denied"?<p role="alert">Không có quyền xem mức lương hoặc dữ liệu không khả dụng.</p>:null}{rateStatus==="ready"?(rates?.length?rates.map(r=><BoProperties key={r.id} items={[{key:"effective",label:"Hiệu lực",value:date(r.effectiveFrom)},{key:"amount",label:"Rate HO",value:money(r.amountMinor)},{key:"state",label:"Trạng thái",value:r.state}]}/>):<p role="status">Không có lịch sử mức lương được phép xem.</p>):null}</section>}
 ]}/>;
}
