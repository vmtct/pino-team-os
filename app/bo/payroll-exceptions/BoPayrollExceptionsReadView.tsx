"use client";
/** PAP-1955 · BO Extra-time read-only PINO TDD. Never decides any request. */
import Link from "next/link";
import {useEffect,useState} from "react";
import {BoDataGrid,BoDataGridBadge,BoDataGridSidePeek,type BoDataGridColumn} from "@/app/bo/components/data-grid";
import {BoProperties} from "@/app/bo/components/BoProperties";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {exceptionReadApi,ExceptionReadError,type ReviewStatus} from "@/lib/bo-payroll-exceptions-read";
import {toExceptionReadRow,validExceptionRange,minorVnd,type ExceptionReadRow} from "@/lib/bo-payroll-exceptions-model";
export const exceptionProperties:[string,(r:ExceptionReadRow)=>string][]=[
 ["Mã yêu cầu",r=>r.id],["Nhân viên (CCCD)",r=>r.staffLegalName],
 ["Mã nhân viên",r=>r.staffMemberId],["Người gửi",r=>r.submittedBy],
 ["Cơ sở",r=>r.centerId],["Ngày làm",r=>r.workDate],
 ["Phân công",r=>r.assignmentId],["Giờ yêu cầu",r=>r.requestedWindow],
 ["Lý do yêu cầu",r=>r.requestReason],["Trạng thái",r=>r.statusLabel],
 ["Khoảng duyệt",r=>r.reviewedWindow],
 ["Số phút được duyệt",r=>r.reviewedMinutes===null?"—":String(r.reviewedMinutes)],
 ["Số tiền Core duyệt",r=>minorVnd(r.reviewedAmountMinor)],
 ["Người duyệt",r=>r.reviewerName],["Thời gian duyệt",r=>r.reviewedAt],
 ["Lý do quyết định",r=>r.decisionReason],
 ["Created Time",r=>r.createdAt],["Created By",r=>r.createdBy],
 ["Last Modified Time",r=>r.updatedAt],["Last Modified By",r=>r.updatedBy],
];
const columns:BoDataGridColumn<ExceptionReadRow>[]=[
 {key:"id",header:"Mã yêu cầu",render:r=>r.id,minWidth:155},
 {key:"staffLegalName",header:"Nhân viên",render:r=>r.staffLegalName,minWidth:135},
 {key:"submittedBy",header:"Người gửi",render:r=>r.submittedBy,minWidth:130},
 {key:"centerId",header:"Cơ sở",render:r=>r.centerId,minWidth:165},
 {key:"workDate",header:"Ngày làm",render:r=>r.workDate,minWidth:115},
 {key:"requestedWindow",header:"Giờ yêu cầu",render:r=>r.requestedWindow,minWidth:140},
 {key:"reviewedMinutes",header:"Phút duyệt",render:r=>r.reviewedMinutes??"—",minWidth:105},
 {key:"statusLabel",header:"Trạng thái",render:r=><BoDataGridBadge>{r.statusLabel}</BoDataGridBadge>,minWidth:120},
 {key:"requestReason",header:"Lý do",render:r=>r.requestReason,minWidth:160},
 {key:"reviewerName",header:"Người duyệt",render:r=>r.reviewerName,minWidth:130},
 {key:"reviewedAt",header:"Thời gian duyệt",render:r=>r.reviewedAt,minWidth:155},
 {key:"reviewedAmountMinor",header:"Tiền Core duyệt",render:r=>minorVnd(r.reviewedAmountMinor),minWidth:150},
 {key:"createdAt",header:"Created Time",render:r=>r.createdAt,minWidth:140},
 {key:"createdBy",header:"Created By",render:r=>r.createdBy,minWidth:140},
 {key:"updatedAt",header:"Last Modified Time",render:r=>r.updatedAt,minWidth:155},
 {key:"updatedBy",header:"Last Modified By",render:r=>r.updatedBy,minWidth:140},
];
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
 const scope=useBoCenterSelection(),centerId=scope?.selected??"";
 const allowed=Boolean(scope&&!scope.loading&&!scope.error&&centerId&&scope.centers.some(x=>x.id===centerId));
 const [from,setFrom]=useState(()=>plusDay(vietnamToday(),-30)),[to,setTo]=useState(vietnamToday);
 const [status,setStatus]=useState<ReviewStatus|"ALL">("PENDING");
 const [offset,setOffset]=useState(0),[refresh,setRefresh]=useState(0);
 const [rows,setRows]=useState<ExceptionReadRow[]>([]),[total,setTotal]=useState(0);
 const [selected,setSelected]=useState<string|null>(null);
 const [servedScope,setServedScope]=useState("");
 const [state,setState]=useState<"loading"|"ready"|"permission"|"error">("loading"),[message,setMessage]=useState("");
 const valid=validExceptionRange(from,to),key=[centerId,from,to,status,offset,refresh].join("|");
 useEffect(()=>{
  let live=true;
  if(!allowed||!valid)return;
  void exceptionReadApi.list({centerId,startDate:from,endDate:to,
   ...(status==="ALL"?{}:{status}),offset,limit:50}).then(reply=>{
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
 },[allowed,valid,centerId,from,to,status,offset,refresh,key]);
 const safe=allowed&&servedScope===key;
 const safeRows=safe?rows:[],safeTotal=safe?total:0;
 const safeSelected=safeRows.find(row=>row.id===selected)??null;
 return <section aria-label="Ngoại lệ & thêm giờ" data-pap-ticket="PAP-1955">
  <header><small>NHÂN SỰ / LƯƠNG</small>
   <h1>Ngoại lệ & thêm giờ</h1>
   <p>Danh sách đọc từ Core · Theo cơ sở đang chọn · Không phê duyệt tại màn này</p></header>
  {scope?.loading?<p role="status">Đang xác thực cơ sở…</p>:!allowed?
   <p role="alert">{scope?.error||"Chọn cơ sở được cấp quyền để xem ngoại lệ."}</p>:
   <div role="group" aria-label="Lọc ngoại lệ">
    <label>Từ ngày<input type="date" value={from} onChange={e=>{setOffset(0);setSelected(null);setFrom(e.target.value);}}/></label>
    <label>Đến ngày<input type="date" value={to} onChange={e=>{setOffset(0);setSelected(null);setTo(e.target.value);}}/></label>
    <label>Trạng thái<select value={status} onChange={e=>{setOffset(0);setSelected(null);setStatus(e.target.value as ReviewStatus|"ALL");}}>
     {statuses.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
    <button type="button" onClick={()=>{setSelected(null);setRefresh(n=>n+1);}}>Tải lại</button>
   </div>}
  {allowed&&!valid?<p role="alert">Chọn khoảng thời gian hợp lệ, tối đa 91 ngày gồm hai đầu.</p>:null}
  {allowed&&valid?<BoDataGrid rows={safeRows} columns={columns} rowKey={r=>r.id}
   caption="Ngoại lệ và thêm giờ" state={safe?state:"loading"} stateMessage={message}
   onRowOpen={row=>setSelected(row.id)} quickViewOpener resultLabel={String(safeRows.length)+" / "+String(safeTotal)+" yêu cầu"}
   pagination={{page:Math.floor(offset/50)+1,pageSize:50,total:safeTotal,
    onPageChange:p=>{setSelected(null);setOffset((p-1)*50);}}}
   emptyTitle="Chưa có yêu cầu" emptyMessage="Core không trả về yêu cầu trong bộ lọc."/>:null}
  {safeSelected?<BoDataGridSidePeek title={safeSelected.workDate} eyebrow="Ngoại lệ · Chỉ xem"
   onClose={()=>setSelected(null)}
   footer={<Link href={"/bo/payroll-exceptions/"+encodeURIComponent(safeSelected.id)+
    "?centerId="+encodeURIComponent(centerId)}>Full Detail</Link>}>
   <BoProperties compact items={exceptionProperties.map(([name,render])=>({
    key:name,label:name,value:render(safeSelected)}))}/>
  </BoDataGridSidePeek>:null}
 </section>;
}
