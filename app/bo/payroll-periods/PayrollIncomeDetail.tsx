"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {BoProperties} from "@/app/bo/components/BoProperties";
import {BoFullDetail} from "@/app/bo/components/BoFullDetail";
import {BoPill} from "@/app/bo/components/registration/BoValue";
import {loadIncomeHistory,type IncomePeriod} from "@/lib/bo-payroll-income-read";
import {money} from "@/lib/bo-payroll-period-api";
import {payrollVerifiedName} from "@/lib/bo-payroll-safe-read-metadata";
const ROOT="/bo/payroll-periods";
const periodHref=(centerId:string,id:string)=>ROOT+"?"+new URLSearchParams({centerId,record:id,tab:"settlements"});
const date=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v.split("-").reverse().join("/"):"—";
const statuses={DRAFT:{text:"Bản nháp",color:"gray"},PENDING:{text:"Chờ duyệt",color:"orange"},FINALIZED:{text:"Đã chốt",color:"blue"},PAID:{text:"Đã thanh toán",color:"green"},ARCHIVED_UNAVAILABLE:{text:"Không đủ dữ liệu",color:"gray"}} as const;
export function PayrollIncomeDetail({centerId,centerName,id,staffId,tab}:{centerId:string;centerName:string;id:string;staffId:string;tab:string|null}){
 const [result,setResult]=useState<{rows:IncomePeriod[];error:string;nextOffset:number|null}|null>(null);
 useEffect(()=>{let live=true;void loadIncomeHistory(centerId,id,staffId).then(page=>{if(live)setResult({rows:[page.current,...page.rows],error:"",nextOffset:page.nextOffset});}).catch(()=>{if(live)setResult({rows:[],error:"Không thể tải thu nhập từ Core.",nextOffset:null});});return()=>{live=false;};},[centerId,id,staffId]);
 const [busy,setBusy]=useState(false),[pageError,setPageError]=useState("");
 async function more(){if(busy||!result||result.nextOffset===null)return;setBusy(true);setPageError("");try{const p=await loadIncomeHistory(centerId,id,staffId,result.nextOffset);if(p.rows.some(r=>result.rows.some(old=>old.period.id===r.period.id)))throw Error("Duplicate period");setResult({rows:[...result.rows,...p.rows],error:"",nextOffset:p.nextOffset});}catch{setPageError("Không thể tải thêm kỳ lương.");}finally{setBusy(false);}}
 const back=periodHref(centerId,id);
 if(!result)return <p role="status">Đang tải thu nhập…</p>;
 if(result.error)return <><Link href={back}>Quay lại kỳ lương</Link><p role="alert">{result.error}</p></>;
 const current=result.rows[0];
 if(!current)return <p role="alert">Không có dữ liệu thu nhập.</p>;
 return <BoFullDetail title={payrollVerifiedName(current.staff.staffName)} description={"Thu nhập PTE · "+centerName} currentUrl={ROOT+"?"+new URLSearchParams({centerId,record:id,incomeStaff:staffId})} returnTo={back} activeTab={tab} tabs={[
 {id:"overview",label:"Thông tin",content:<>
 <section className="property-section"><h3>Thông tin PTE</h3><BoProperties items={[["PTE",payrollVerifiedName(current.staff.staffName)],["ID",staffId],["Vai trò","—"],["Đơn giá HO","—"],["Ngày hiệu lực","—"]].map(([label,value])=>({key:label,label,value}))}/></section>
 <section className="property-section"><h3>Thu nhập theo kỳ</h3><div className="pay-card-list">{result.rows.map(({period,staff})=><article className="pay-staff-card" key={period.id}><div><strong>{period.name}</strong><small>{date(period.startDate)} – {date(period.endDate)}</small></div><div className="pay-staff-money"><strong>{money(staff.amountMinor)}</strong><BoPill {...statuses[staff.status]}/></div><div className="pay-staff-actions"><Link className="secondary-btn" href={periodHref(centerId,period.id)}>Xem kỳ</Link></div>{staff.warnings?.length?<p role="status">Có khoản cần đối soát.</p>:null}</article>)}</div>{result.nextOffset!==null?<button type="button" className="secondary-btn" disabled={busy} onClick={()=>void more()}>Tải thêm kỳ</button>:null}{pageError?<p role="alert">{pageError}</p>:null}</section>
 <section className="property-section"><h3>Ngày công</h3><div className="pay-card-list">{result.rows.flatMap(({period,staff})=>(staff.preview?.days??[]).map(day=><article key={period.id+":"+day.workDate} className="pay-compact-day"><span>{date(day.workDate)} · {day.paidMinutes??"—"} phút</span><strong>{money(day.amountMinor)}</strong><span>{{READY:"Đã tính",NO_ATTENDANCE:"Chưa chấm công",NO_ASSIGNMENT:"Thiếu phân công",PENDING_CHECKOUT:"Chưa checkout",RATE_MISSING:"Thiếu Rate HO",RECONCILIATION_REQUIRED:"Cần đối soát"}[day.status as "READY"]??"—"}</span></article>))}</div></section>
 </>},
 {id:"history",label:"Lịch Sử",content:<p role="status">Chưa có nguồn lịch sử PTE được cấp quyền.</p>}
 ]}/>;
}
