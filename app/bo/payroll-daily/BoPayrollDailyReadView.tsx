"use client";
/** PAP-1954 · BO Salary Daily read-only TDD: Table → Drawer → Full Detail.
 * No FE wage calculation, override, Create, Paid or Phase W writes.
 */
import {useRouter} from "next/navigation";
import {useEffect,useState} from "react";
import {PayrollDsaReadTable,payrollPresentation} from "../payroll-periods/PayrollNativeTable";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {dailyReadApi,DailyReadError} from "@/lib/bo-payroll-daily-api";
import {payrollDailyRow,displayDailyMoney,validDailyWindow,type BoPayrollDailyRow} from "@/lib/bo-payroll-daily-view-model";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";

const statuses:Record<BoPayrollDailyRow["status"],string>={
 READY:"Đã tính",NO_ATTENDANCE:"Chưa chấm công",NO_ASSIGNMENT:"Thiếu phân công",
 PENDING_CHECKOUT:"Chưa checkout",RATE_MISSING:"Thiếu Rate HO",
 RECONCILIATION_REQUIRED:"Cần đối soát",
};
export const dailyPropertyFields:[string,(row:BoPayrollDailyRow)=>string][]=[
 ["Ngày làm",r=>r.workDate],["Nhân viên",r=>r.staffDisplayName],
 ["Lớp/Ca",()=>"—"],["Check-in/out hiệu lực",r=>r.actualInOut],
 ["Check-in/out gốc",r=>r.recordedInOut],["Phút tính",r=>r.paidMinutes===null?"—":String(r.paidMinutes)],
 ["Rate HO",r=>displayDailyMoney(r.appliedRateMinor)],
 ["Lương chuẩn",r=>displayDailyMoney(r.standardMinor)],
 ["Lương ngày",r=>displayDailyMoney(r.effectiveMinor)],
 ["Trạng thái",r=>statuses[r.status]],["Điều chỉnh",r=>r.overrideStatus],
 ["Created Time",r=>r.createdAt],["Created By",r=>r.createdBy],
 ["Last Modified Time",r=>r.updatedAt],["Last Modified By",r=>r.updatedBy],
];
export const dailyPresentation=payrollPresentation("Bảng lương ngày","Nhân viên",(r:BoPayrollDailyRow)=>r.staffDisplayName,dailyPropertyFields);
function vnToday():string{
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const get=(name:string)=>parts.find(p=>p.type===name)?.value??"";
 return [get("year"),get("month"),get("day")].join("-");
}
function offsetDay(day:string,count:number):string{
 return new Date(Date.parse(day+"T00:00:00Z")+count*86400000).toISOString().slice(0,10);
}
function apiError(error:unknown){
 if(error instanceof DailyReadError){
  if(error.status===401)return "Phiên BO hết hạn. Đăng nhập lại.";
  if(error.status===403)return "Không có quyền đọc dữ liệu lương tại cơ sở này.";
  if(error.status===404)return "Dữ liệu lương không khả dụng tại cơ sở này.";
 }
 return error instanceof Error?error.message:"Không thể tải bảng lương Core.";
}
export default function BoPayrollDailyReadView(){
 const scope=useBoCenterSelection(),centerId=scope?.selected??"";
 const allowed=Boolean(scope&&!scope.loading&&!scope.error&&centerId&&scope.centers.some(c=>c.id===centerId));
 // PAP-1972: switching Center or revoking scope destroys the old request/Drawer lifetime.
 return <DailyScopeView key={JSON.stringify([centerId,allowed])}/>;
}
function DailyScopeView(){
 const router=useRouter();
 const scope=useBoCenterSelection(),centerId=scope?.selected??"";
 const allowed=Boolean(scope&&!scope.loading&&!scope.error&&centerId&&scope.centers.some(c=>c.id===centerId));
 const [startDate,setStartDate]=useState(()=>offsetDay(vnToday(),-29));
 const [endDate,setEndDate]=useState(vnToday);
 const [rows,setRows]=useState<BoPayrollDailyRow[]>([]);
 const [total,setTotal]=useState(0),[offset,setOffset]=useState(0),[pageSize,setPageSize]=useState(15),[refresh,setRefresh]=useState(0);
 const [selected,setSelected]=useState<string|null>(null);
 const [state,setState]=useState<"loading"|"ready"|"error"|"permission">("loading");
 const [message,setMessage]=useState("");
 const valid=validDailyWindow(startDate,endDate);
 const scopeKey=[centerId,startDate,endDate,offset,pageSize,refresh].join("|");
 const [servedScope,setServedScope]=useState("");
 useEffect(()=>{
  let live=true;
  if(!allowed||!valid)return;
  void dailyReadApi.list({centerId,startDate,endDate,limit:pageSize,offset})
   .then(payload=>{
    if(!live)return;
    const next=payload.data.data.map(r=>payrollDailyRow(r,centerId));
    if(!Number.isSafeInteger(payload.data.total)||payload.data.total<next.length)
     throw new Error("PAYROLL_DAILY_PAGINATION_MISMATCH");
    setRows(next);setTotal(payload.data.total);setState("ready");setMessage("");setServedScope(scopeKey);
   }).catch(error=>{
    if(!live)return;setRows([]);setTotal(0);setMessage(apiError(error));setServedScope(scopeKey);
    setState(error instanceof DailyReadError&&[401,403].includes(error.status)?"permission":"error");
   });
  return()=>{live=false;};
 },[allowed,centerId,startDate,endDate,offset,pageSize,refresh,valid,scopeKey]);
 const safeRows=allowed&&valid&&servedScope===scopeKey?rows:[];
 const safeTotal=allowed&&valid&&servedScope===scopeKey?total:0;
 const safeSelected=safeRows.find(row=>row.id===selected)??null;
 return <section aria-label="Bảng lương ngày" data-pap-ticket="PAP-1954">
  <div className="page-heading"><div className="page-heading-left"><h1>Bảng lương ngày</h1></div></div>
  {scope?.loading?<p role="status">Đang xác thực cơ sở…</p>:!allowed?
   <p role="alert">{scope?.error||"Chọn cơ sở được cấp quyền để xem lương."}</p>:
   null}
  {allowed&&!valid?<p role="alert">Khoảng ngày không hợp lệ; tối đa 31 ngày kể cả hai đầu.</p>:null}
  {allowed?<PayrollDsaReadTable module={dailyPresentation.module} rows={safeRows.map(dailyPresentation.record)}
   loadState={!valid?"Khoảng ngày không hợp lệ.":servedScope!==scopeKey?"loading":state==="ready"?"ready":message||"Không thể tải dữ liệu."}
   onOpen={r=>setSelected(r.id)} selected={selected} page={Math.floor(offset/pageSize)+1} pageSize={pageSize} onPageSizeChange={n=>{setSelected(null);setOffset(0);setPageSize(n);}} total={safeTotal}
   onPageChange={page=>{setSelected(null);setOffset((page-1)*pageSize);}} filterContent={<div className="rules-panel" role="group" aria-label="Khoảng ngày">
    <label className="rule-row">Từ ngày<input className="rule-value-input" type="date" value={startDate} onChange={e=>{setOffset(0);setSelected(null);setStartDate(e.target.value);}} /></label>
    <label className="rule-row">Đến ngày<input className="rule-value-input" type="date" value={endDate} onChange={e=>{setOffset(0);setSelected(null);setEndDate(e.target.value);}} /></label>
    <button type="button" className="rule-clear" onClick={()=>{setSelected(null);setRefresh(n=>n+1);}}>Tải lại</button>
   </div>} onReset={()=>{setSelected(null);setOffset(0);setStartDate(offsetDay(vnToday(),-29));setEndDate(vnToday());setRefresh(n=>n+1);}}/>:null}
  {safeSelected?<BoQuickView module={dailyPresentation.module} record={dailyPresentation.record(safeSelected)}
   onClose={()=>setSelected(null)} onDetail={()=>router.push("/bo/payroll-daily/"+encodeURIComponent(safeSelected.staffMemberId)+"/"+encodeURIComponent(safeSelected.workDate)+"?centerId="+encodeURIComponent(centerId))}/>:null}
 </section>;
}
