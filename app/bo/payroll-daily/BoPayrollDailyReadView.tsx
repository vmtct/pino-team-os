"use client";
/** PAP-1954 · BO Salary Daily read-only TDD: Table → Drawer → Full Detail.
 * No FE wage calculation, override, Create, Paid or Phase W writes.
 */
import Link from "next/link";
import {useEffect,useState} from "react";
import {BoDataGrid,BoDataGridBadge,BoDataGridSidePeek,type BoDataGridColumn} from "@/app/bo/components/data-grid";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {dailyReadApi,DailyReadError} from "@/lib/bo-payroll-daily-api";
import {payrollDailyRow,displayDailyMoney,validDailyWindow,type BoPayrollDailyRow} from "@/lib/bo-payroll-daily-view-model";
import {BoProperties} from "@/app/bo/components/BoProperties";

const statuses:Record<BoPayrollDailyRow["status"],string>={
 READY:"Đã tính",NO_ATTENDANCE:"Chưa chấm công",NO_ASSIGNMENT:"Thiếu phân công",
 PENDING_CHECKOUT:"Chưa checkout",RATE_MISSING:"Thiếu Rate HO",
 RECONCILIATION_REQUIRED:"Cần đối soát",
};
export const dailyPropertyFields:[string,(row:BoPayrollDailyRow)=>string][]=[
 ["Ngày làm",r=>r.workDate],["Nhân viên",r=>r.staffDisplayName],["Mã nhân viên",r=>r.staffMemberId],
 ["Lớp/Ca",r=>r.assignmentRefs],["Check-in/out hiệu lực",r=>r.actualInOut],
 ["Check-in/out gốc",r=>r.recordedInOut],["Phút tính",r=>r.paidMinutes===null?"—":String(r.paidMinutes)],
 ["Rate HO",r=>displayDailyMoney(r.appliedRateMinor)],
 ["Lương chuẩn",r=>displayDailyMoney(r.standardMinor)],
 ["Lương ngày",r=>displayDailyMoney(r.effectiveMinor)],
 ["Trạng thái",r=>statuses[r.status]],["Điều chỉnh",r=>r.overrideStatus],
 ["Created Time",r=>r.createdAt],["Created By",r=>r.createdBy],
 ["Last Modified Time",r=>r.updatedAt],["Last Modified By",r=>r.updatedBy],
];
const columns:BoDataGridColumn<BoPayrollDailyRow>[]=[
 {key:"workDate",header:"Ngày làm",render:r=>r.workDate,minWidth:115},
 {key:"staffDisplayName",header:"Nhân viên",render:r=>r.staffDisplayName,minWidth:136},
 {key:"status",header:"Trạng thái",render:r=><BoDataGridBadge>{statuses[r.status]}</BoDataGridBadge>,minWidth:145},
 {key:"assignmentRefs",header:"Lớp/Ca",render:r=>r.assignmentRefs,minWidth:170},
 {key:"actualInOut",header:"Check-in/out",render:r=>r.actualInOut,minWidth:145},
 {key:"paidMinutes",header:"Phút tính",render:r=>r.paidMinutes??"—",minWidth:105},
 {key:"appliedRateMinor",header:"Rate HO",render:r=>displayDailyMoney(r.appliedRateMinor),minWidth:125},
 {key:"standardMinor",header:"Lương chuẩn",render:r=>displayDailyMoney(r.standardMinor),minWidth:135},
 {key:"effectiveMinor",header:"Lương ngày",render:r=>displayDailyMoney(r.effectiveMinor),minWidth:135},
 {key:"overrideStatus",header:"Điều chỉnh",render:r=>r.overrideStatus,minWidth:120},
 {key:"createdAt",header:"Created Time",render:r=>r.createdAt,minWidth:145},
 {key:"createdBy",header:"Created By",render:r=>r.createdBy,minWidth:135},
 {key:"updatedAt",header:"Last Modified Time",render:r=>r.updatedAt,minWidth:150},
 {key:"updatedBy",header:"Last Modified By",render:r=>r.updatedBy,minWidth:150},
];
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
 const [startDate,setStartDate]=useState(()=>offsetDay(vnToday(),-29));
 const [endDate,setEndDate]=useState(vnToday);
 const [rows,setRows]=useState<BoPayrollDailyRow[]>([]);
 const [total,setTotal]=useState(0),[offset,setOffset]=useState(0),[refresh,setRefresh]=useState(0);
 const [selected,setSelected]=useState<BoPayrollDailyRow|null>(null);
 const [state,setState]=useState<"loading"|"ready"|"error"|"permission">("loading");
 const [message,setMessage]=useState("");
 const valid=validDailyWindow(startDate,endDate);
 const scopeKey=[centerId,startDate,endDate,offset,refresh].join("|");
 const [servedScope,setServedScope]=useState("");
 useEffect(()=>{
  let live=true;
  if(!allowed||!valid)return;
  void dailyReadApi.list({centerId,startDate,endDate,limit:50,offset})
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
 },[allowed,centerId,startDate,endDate,offset,refresh,valid,scopeKey]);
 const safeRows=allowed&&servedScope===scopeKey?rows:[];
 const safeTotal=allowed&&servedScope===scopeKey?total:0;
 const safeSelected=allowed&&servedScope===scopeKey&&selected?.centerId===centerId?selected:null;
 return <section aria-label="Bảng lương ngày" data-pap-ticket="PAP-1954">
  <header><small>NHÂN SỰ / LƯƠNG</small>
   <h1>Bảng lương ngày</h1><p>Chỉ đọc theo cơ sở đang chọn · Core Payroll</p></header>
  {scope?.loading?<p role="status">Đang xác thực cơ sở…</p>:!allowed?
   <p role="alert">{scope?.error||"Chọn cơ sở được cấp quyền để xem lương."}</p>:
   <div role="group" aria-label="Khoảng ngày">
    <label>Từ ngày<input type="date" value={startDate} onChange={e=>{setOffset(0);setStartDate(e.target.value);}} /></label>
    <label>Đến ngày<input type="date" value={endDate} onChange={e=>{setOffset(0);setEndDate(e.target.value);}} /></label>
    <button type="button" onClick={()=>{setSelected(null);setRefresh(n=>n+1);}}>Tải lại</button>
   </div>}
  {allowed&&!valid?<p role="alert">Khoảng ngày không hợp lệ; tối đa 31 ngày kể cả hai đầu.</p>:null}
  {allowed&&valid?<BoDataGrid rows={safeRows} columns={columns} rowKey={r=>r.id}
   caption="Bảng lương ngày" state={servedScope===scopeKey?state:"loading"} stateMessage={message}
   onRowOpen={setSelected} quickViewOpener
   resultLabel={String(safeRows.length)+" / "+String(safeTotal)+" bản ghi"}
   pagination={{page:Math.floor(offset/50)+1,pageSize:50,total:safeTotal,
    onPageChange:page=>{setSelected(null);setOffset((page-1)*50);}}}
   emptyTitle="Chưa có ngày công" emptyMessage="Core không trả về bản ghi lương trong khoảng ngày này."/>:null}
  {safeSelected?<BoDataGridSidePeek title={safeSelected.workDate} eyebrow="Bảng lương ngày · Chỉ xem" onClose={()=>setSelected(null)}
   footer={<Link href={"/bo/payroll-daily/"+encodeURIComponent(safeSelected.staffMemberId)+"/"+
    encodeURIComponent(safeSelected.workDate)+"?centerId="+encodeURIComponent(centerId)}>Full Detail</Link>}>
   <BoProperties compact items={dailyPropertyFields.map(([name,render])=>({key:name,label:name,value:render(safeSelected)}))}/>
   <p>Audit “—” là dữ liệu chưa có trên bản ghi dẫn xuất; lịch sử override riêng biệt.</p>
  </BoDataGridSidePeek>:null}
 </section>;
}
