"use client";
/** PAP-1955 · BO Extra-time read-only PINO TDD. Never decides any request. */
import {useRouter} from "next/navigation";
import {useEffect,useState} from "react";
import {PayrollDsaReadTable,payrollPresentation} from "../payroll-periods/PayrollNativeTable";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {exceptionReadApi,ExceptionReadError,type ReviewStatus} from "@/lib/bo-payroll-exceptions-read";
import {toExceptionReadRow,validExceptionRange,minorVnd,type ExceptionReadRow} from "@/lib/bo-payroll-exceptions-model";
export const exceptionProperties:[string,(r:ExceptionReadRow)=>string][]=[
 ["Nhân viên",r=>r.staffLegalName],
 ["Người gửi",r=>r.submittedBy],
 ["Ngày làm",r=>r.workDate],
 ["Phân công",()=>"—"],["Giờ yêu cầu",r=>r.requestedWindow],
 ["Lý do yêu cầu",r=>r.requestReason],["Trạng thái",r=>r.statusLabel],
 ["Khoảng duyệt",r=>r.reviewedWindow],
 ["Số phút được duyệt",r=>r.reviewedMinutes===null?"—":String(r.reviewedMinutes)],
 ["Số tiền Core duyệt",r=>minorVnd(r.reviewedAmountMinor)],
 ["Người duyệt",r=>r.reviewerName],["Thời gian duyệt",r=>r.reviewedAt],
 ["Lý do quyết định",r=>r.decisionReason],
 ["Created Time",r=>r.createdAt],["Created By",r=>r.createdBy],
 ["Last Modified Time",r=>r.updatedAt],["Last Modified By",r=>r.updatedBy],
];
export const exceptionPresentation=payrollPresentation("Ngoại lệ & thêm giờ","Nhân viên",(r:ExceptionReadRow)=>r.staffLegalName,exceptionProperties);
const statuses:ReadonlyArray<{value:ReviewStatus|"ALL";label:string}>=[
 {value:"PENDING",label:"Chờ duyệt"},{value:"APPROVED",label:"Đã duyệt"},
 {value:"REJECTED",label:"Từ chối"},{value:"WITHDRAWN",label:"Đã rút"},
 {value:"ALL",label:"Tất cả"},
];
function vietnamToday():string {
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Ho_Chi_Minh",
  day:"2-digit",month:"2-digit",year:"numeric"}).formatToParts(new Date());
 const get=(key:string)=>parts.find(x=>x.type===key)?.value??"";
 return [get("year"),get("month"),get("day")].join("-");
}
function plusDay(date:string,days:number):string{
 return new Date(Date.parse(date+"T00:00:00Z")+days*86400000).toISOString().slice(0,10);
}
function errorMessage(e:unknown):string{
 if(e instanceof ExceptionReadError){
  if(e.status===401)return "Phiên BO đã hết hạn.";
  if(e.status===403)return "Không có quyền xem ngoại lệ tại cơ sở đang chọn.";
 }
 return e instanceof Error?e.message:"Core không trả về dữ liệu ngoại lệ.";
}
export default function BoPayrollExceptionsReadView(){
 const scope=useBoCenterSelection(),centerId=scope?.selected??"";
 const allowed=Boolean(scope&&!scope.loading&&!scope.error&&centerId&&scope.centers.some(c=>c.id===centerId));
 // PAP-1972: independent request lifetime for each selected/authorized Center.
 return <ExceptionScopeView key={JSON.stringify([centerId,allowed])}/>;
}
function ExceptionScopeView(){
 const router=useRouter();
 const scope=useBoCenterSelection(),centerId=scope?.selected??"";
 const allowed=Boolean(scope&&!scope.loading&&!scope.error&&centerId&&scope.centers.some(x=>x.id===centerId));
 const [from,setFrom]=useState(()=>plusDay(vietnamToday(),-30)),[to,setTo]=useState(vietnamToday);
 const [status,setStatus]=useState<ReviewStatus|"ALL">("PENDING");
 const [offset,setOffset]=useState(0),[pageSize,setPageSize]=useState(15),[refresh,setRefresh]=useState(0);
 const [rows,setRows]=useState<ExceptionReadRow[]>([]),[total,setTotal]=useState(0);
 const [selected,setSelected]=useState<string|null>(null);
 const [servedScope,setServedScope]=useState("");
 const [state,setState]=useState<"loading"|"ready"|"permission"|"error">("loading"),[message,setMessage]=useState("");
 const valid=validExceptionRange(from,to),key=[centerId,from,to,status,offset,pageSize,refresh].join("|");
 useEffect(()=>{
  let live=true;
  if(!allowed||!valid)return;
  void exceptionReadApi.list({centerId,startDate:from,endDate:to,
   ...(status==="ALL"?{}:{status}),offset,limit:pageSize}).then(reply=>{
    if(!live)return;
    const next=reply.data.data.map(x=>toExceptionReadRow(x,centerId));
    if(!Number.isSafeInteger(reply.data.total)||reply.data.total<next.length)
     throw Error("PAYROLL_EXCEPTION_PAGING_INVALID");
    setRows(next);setTotal(reply.data.total);setServedScope(key);setState("ready");setMessage("");
   }).catch(e=>{if(!live)return;setRows([]);setTotal(0);setServedScope(key);
    setState(e instanceof ExceptionReadError&&[401,403].includes(e.status)?"permission":"error");
    setMessage(errorMessage(e));
   });
  return()=>{live=false;};
 },[allowed,valid,centerId,from,to,status,offset,pageSize,refresh,key]);
 const safe=allowed&&valid&&servedScope===key;
 const safeRows=safe?rows:[],safeTotal=safe?total:0;
 const safeSelected=safeRows.find(row=>row.id===selected)??null;
 return <section aria-label="Ngoại lệ & thêm giờ" data-pap-ticket="PAP-1955">
  <div className="page-heading"><div className="page-heading-left"><h1>Ngoại lệ &amp; thêm giờ</h1></div></div>
  {scope?.loading?<p role="status">Đang xác thực cơ sở…</p>:!allowed?
   <p role="alert">{scope?.error||"Chọn cơ sở được cấp quyền để xem ngoại lệ."}</p>:
   null}
  {allowed&&!valid?<p role="alert">Chọn khoảng thời gian hợp lệ, tối đa 91 ngày gồm hai đầu.</p>:null}
  {allowed?<PayrollDsaReadTable module={exceptionPresentation.module} rows={safeRows.map(exceptionPresentation.record)}
   loadState={!valid?"Khoảng ngày không hợp lệ.":!safe?"loading":state==="ready"?"ready":message||"Không thể tải dữ liệu."}
   onOpen={r=>setSelected(r.id)} selected={selected} page={Math.floor(offset/pageSize)+1} pageSize={pageSize} onPageSizeChange={n=>{setSelected(null);setOffset(0);setPageSize(n);}} total={safeTotal}
   onPageChange={page=>{setSelected(null);setOffset((page-1)*pageSize);}} filterContent={<div className="rules-panel" role="group" aria-label="Lọc ngoại lệ">
    <label className="rule-row">Từ ngày<input className="rule-value-input" type="date" value={from} onChange={e=>{setOffset(0);setSelected(null);setFrom(e.target.value);}}/></label>
    <label className="rule-row">Đến ngày<input className="rule-value-input" type="date" value={to} onChange={e=>{setOffset(0);setSelected(null);setTo(e.target.value);}}/></label>
    <label className="rule-row">Trạng thái<select className="rule-value-input" value={status} onChange={e=>{setOffset(0);setSelected(null);setStatus(e.target.value as ReviewStatus|"ALL");}}>
     {statuses.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
    <button type="button" className="rule-clear" onClick={()=>{setSelected(null);setRefresh(n=>n+1);}}>Tải lại</button>
   </div>} onReset={()=>{setSelected(null);setOffset(0);setFrom(plusDay(vietnamToday(),-30));setTo(vietnamToday());setStatus("ALL");setRefresh(n=>n+1);}}/>:null}
  {safeSelected?<BoQuickView module={exceptionPresentation.module} record={exceptionPresentation.record(safeSelected)}
   onClose={()=>setSelected(null)} onDetail={()=>router.push("/bo/payroll-exceptions/"+encodeURIComponent(safeSelected.id)+"?centerId="+encodeURIComponent(centerId))}/>:null}
 </section>;
}
