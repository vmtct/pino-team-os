"use client";
/** PAP-1985 / PAP-1063 native Kỳ lương view. Core is the only money authority. */
import Link from "next/link";
import {PayrollIncomeDetail} from "./PayrollIncomeDetail";
import {useEffect,useState,useRef} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import {BoDataGrid,BoDataGridBadge,type BoDataGridColumn} from "@/app/bo/components/data-grid";
import {BoFullDetail} from "@/app/bo/components/BoFullDetail";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {PeriodProperties,CreatePeriod,periodFields,periodRecord} from "./PeriodProperties";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {periodApi,money,type PeriodStaffPage} from "@/lib/bo-payroll-period-api";
import {nativePeriodRow,nativePeriodHistory,type NativePeriodRow} from "@/lib/bo-payroll-native-period-model";
import {staffWithWorkEvidence,periodSummaries} from "@/lib/bo-payroll-read-model";
import {BoPill} from "@/app/bo/components/registration/BoValue";
import {payrollVerifiedName} from "@/lib/bo-payroll-safe-read-metadata";

const ROOT="/bo/payroll-periods";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const columns:BoDataGridColumn<NativePeriodRow>[]=periodFields.map(f=>({
 key:f.key,header:f.label,minWidth:f.w,
 render:r=>{const v=String(periodRecord(r)[f.key]??"—");return f.key==="status"?<BoDataGridBadge>{v}</BoDataGridBadge>:v;},
}));
const tableUrl=(center:string)=>ROOT+"?"+new URLSearchParams({centerId:center});
const detailUrl=(center:string,id:string)=>ROOT+"?"+new URLSearchParams({centerId:center,record:id});

function errorText(e:unknown){return e instanceof Error?e.message:"Không thể tải kỳ lương Core.";}
export default function BoNativePayrollPeriods(){
 const scope=useBoCenterSelection(),query=useSearchParams();
 const center=scope?.centers.find(c=>c.id===scope.selected);
 const allowed=Boolean(scope&&!scope.loading&&!scope.error&&center&&(!query.has("centerId")||(query.getAll("centerId").length===1&&query.get("centerId")===center.id)));
 const record=query.get("record");
 if(!allowed||!center)return scope?.loading?<p role="status">Đang xác thực cơ sở…</p>:<p role="alert">{scope?.error||"Chọn cơ sở được cấp quyền."}</p>;
 if(query.getAll("record").length>1||(query.has("record")&&(!record||!uuid.test(record))))return <p role="alert">Kỳ lương không hợp lệ.</p>;
 const incomeStaff=query.get("incomeStaff");
 if(query.has("incomeStaff")){
  if(!record||!incomeStaff||query.getAll("incomeStaff").length!==1||!uuid.test(incomeStaff))return <p role="alert">PTE không hợp lệ.</p>;
  const incomeDay=query.get("incomeDay");
  if(query.has("incomeDay")&&(query.getAll("incomeDay").length!==1||!incomeDay||!/^\d{4}-\d{2}-\d{2}$/.test(incomeDay)))return <p role="alert">Ngày công không hợp lệ.</p>;
  return <PayrollIncomeDetail dayDate={incomeDay} key={JSON.stringify([center.id,record,incomeStaff,incomeDay])} centerId={center.id} centerName={center.displayName} id={record} staffId={incomeStaff} tab={query.get("tab")}/>;
 }
 if(record)return <PeriodDetail key={JSON.stringify([center.id,record])} centerId={center.id} centerName={center.displayName} id={record} tab={query.get("tab")}/>;
 return <PeriodTable key={center.id} centerId={center.id} centerName={center.displayName}/>;
}
function PeriodTable({centerId,centerName}:{centerId:string;centerName:string}){
 const [offset,setOffset]=useState(0),[refresh,setRefresh]=useState(0);
 const [selected,setSelected]=useState<string|null>(null),[creating,setCreating]=useState(false);
 const retryRef=useRef<{payload:string;key:string}|null>(null);
 const keyForPayload=(payload:string)=>{
  if(retryRef.current?.payload!==payload)retryRef.current={payload,key:"pay-period-"+crypto.randomUUID()};
  return retryRef.current.key;
 };
 const refreshAfterWrite=()=>{retryRef.current=null;setCreating(false);setSelected(null);setRefresh(r=>r+1);};
 const [result,setResult]=useState<{key:string;rows:NativePeriodRow[];total:number;error:string;canCreate:boolean}|null>(null);
 const key=JSON.stringify([centerId,offset,refresh]);
 useEffect(()=>{
  let live=true;
  void periodApi.list(centerId,offset).then(async reply=>{
   const periods=reply.data.data;
   if(!Number.isSafeInteger(reply.data.total)||reply.data.total<offset+periods.length||
    periods.length>50||new Set(periods.map(p=>p.id)).size!==periods.length||
    periods.some(p=>p.centerId!==centerId||!uuid.test(p.id)))throw Error("PAYROLL_PERIOD_LIST_SCOPE_MISMATCH");
   const rows=await Promise.all(periods.map(async p=>nativePeriodRow(p,(await periodApi.staff(centerId,p.id)).data,centerId,centerName)));
   if(live)setResult({key,rows,total:reply.data.total,error:"",canCreate:reply.data.centerId===centerId&&reply.data.canCreate===true});
  }).catch(e=>{if(live)setResult({key,rows:[],total:0,error:errorText(e),canCreate:false});});
  return()=>{live=false;};
 },[centerId,centerName,offset,key]);
 const current=result?.key===key?result:null;
 const rows=current?.rows??[];
 const row=rows.find(r=>r.id===selected);
 return <section aria-label="Kỳ lương" data-pap-ticket="PAP-1985">
  <header className="page-heading"><div className="page-heading-left"><h1>Kỳ lương</h1></div><div className="heading-actions">{current?.canCreate?<button type="button" className="primary-btn" onClick={()=>{setSelected(null);setCreating(true);}}>Tạo mới</button>:null}</div></header>
  <BoDataGrid rows={rows} columns={columns} rowKey={r=>r.id} caption="Kỳ lương"
   state={!current?"loading":current.error?"error":"ready"} stateMessage={current?.error}
   onRefresh={()=>{setCreating(false);setSelected(null);setRefresh(r=>r+1);}}
   onRowOpen={r=>{setCreating(false);setSelected(r.id);}} selectedRowKey={selected} quickViewOpener
   pagination={{page:Math.floor(offset/50)+1,pageSize:50,total:current?.total??0,onPageChange:n=>{setSelected(null);setOffset((n-1)*50);}}}
   emptyTitle="Chưa có kỳ lương" emptyMessage="Core không trả về kỳ lương tại cơ sở này."/>
  {creating&&current?.canCreate?<CreatePeriod centerId={centerId} centerName={centerName} keyForPayload={keyForPayload} onClose={()=>setCreating(false)} onSaved={refreshAfterWrite}/>:null}
  {row&&!creating?<DrawerFrame title={row.name} path="Kỳ lương" onClose={()=>setSelected(null)}
   footer={<Link className="primary-btn" href={detailUrl(centerId,row.id)}>Full Detail</Link>}>
   <PeriodProperties key={row.id+":"+row.version} row={row} variant="drawer" onSaved={refreshAfterWrite}/>
  </DrawerFrame>:null}
 </section>;
}
function PeriodDetail({centerId,centerName,id,tab}:{centerId:string;centerName:string;id:string;tab:string|null}){
 const [data,setData]=useState<{row:NativePeriodRow;rollup:PeriodStaffPage;refresh:number}|null>(null);
 const [refresh,setRefresh]=useState(0);
 const [error,setError]=useState("");
 useEffect(()=>{
  let live=true;
  void Promise.all([periodApi.get(centerId,id),periodApi.staff(centerId,id)]).then(([p,r])=>{
   if(p.data.id!==id)throw Error("PAYROLL_PERIOD_RECORD_MISMATCH");
   const row=nativePeriodRow(p.data,r.data,centerId,centerName);
   if(live)setData({row,rollup:r.data,refresh});
  }).catch(e=>{if(live)setError(errorText(e));});
  return()=>{live=false;};
 },[centerId,centerName,id,refresh]);
 if(error)return <p role="alert">{error}</p>;
 if(!data||data.refresh!==refresh)return <p role="status">Đang tải kỳ lương…</p>;
 const {row,rollup}=data;
 return <BoFullDetail designVariant="business-v25" title={row.name} description={"Kỳ lương · "+centerName} currentUrl={detailUrl(centerId,id)} returnTo={tableUrl(centerId)} activeTab={tab}
  tabs={[
   {id:"overview",label:"Tổng quan",content:<PeriodProperties key={row.id+":"+row.version} row={row} variant="detail" onSaved={()=>setRefresh(r=>r+1)}/>},
   {id:"settlements",label:"Quyết Toán",content:<Settlements key={id} centerId={centerId} id={id} initial={rollup}/>},
   {id:"history",label:"Lịch sử",content:<PeriodHistory key={centerId+":"+id+":"+row.version} centerId={centerId} id={id}/>},
  ]}/>;
}
function settlementStatus(status:PeriodStaffPage["rows"][number]["status"]){
 switch(status){
  case "DRAFT":return {text:"Bản nháp",color:"gray"};
  case "PENDING":return {text:"Chờ duyệt",color:"orange"};
  case "FINALIZED":return {text:"Đã chốt",color:"blue"};
  case "PAID":return {text:"Đã thanh toán",color:"green"};
  case "ARCHIVED_UNAVAILABLE":return {text:"Không đủ dữ liệu",color:"gray"};
  default:return {text:"Không đủ dữ liệu",color:"gray"};
 }
}
function Settlements({centerId,id,initial}:{centerId:string;id:string;initial:PeriodStaffPage}){
 const router=useRouter();
 const [page,setPage]=useState(initial),[rows,setRows]=useState(initial.rows);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const visible=staffWithWorkEvidence(rows);
 const totals=periodSummaries(page.periodTotals);
 const fullCount=page.staffWithWorkEvidenceCount;
 async function more(){
  if(busy||page.nextOffset===null)return;
  setBusy(true);setError("");
  try{
   const next=(await periodApi.staff(centerId,id,page.nextOffset)).data;
   if(next.period.id!==id||next.period.startDate!==initial.period.startDate||
     next.period.endDate!==initial.period.endDate||next.period.status!==initial.period.status||
     next.totalsScope!=="FULL_PERIOD"||next.offset!==page.nextOffset||
     (next.nextOffset!==null&&next.nextOffset<=next.offset)||
     new Set([...rows,...next.rows].map(r=>r.staffMemberId)).size!==rows.length+next.rows.length)
    throw Error("PAYROLL_SETTLEMENT_PAGE_MISMATCH");
   setRows(old=>[...old,...next.rows]);setPage(next);
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 return <>
  <div className="pay-kpi-grid" role="group" aria-label="Tổng lương kỳ">
   <div className="pay-kpi"><span>Tổng Dự Kiến</span><strong data-pay-total-expected>{money(totals.expected)}</strong></div>
   <div className="pay-kpi"><span>Tổng Quyết Toán</span><strong data-pay-total-finalized>{money(totals.finalized)}</strong></div>
  </div>
  {page.periodTotals.hasPending||page.periodTotals.hasUnavailable?<p role="status">Tổng dự kiến chỉ gồm khoản đã đủ dữ liệu; còn khoản chưa xác định.</p>:null}
  <section aria-label="Quyết toán theo PTE">
  <div className="property-section pay-section-heading"><h3>Quyết toán theo PTE</h3>{typeof fullCount==="number"?<span>{fullCount} PTE có ghi nhận giờ công hoặc đã chốt</span>:null}</div>
  <BoDataGrid showToolbar={false} rows={visible} rowKey={r=>r.staffMemberId} caption="Quyết toán theo PTE"
   columns={[
    {key:"staff",header:"PTE",minWidth:190,render:r=><><strong>{payrollVerifiedName(r.staffName)}</strong><div className="id-code">{r.staffMemberId}</div></>},
    {key:"amount",header:"Thành tiền",minWidth:150,render:r=><strong className="payroll-ro-amount">{money(r.amountMinor)}</strong>},
    {key:"status",header:"Trạng thái",minWidth:140,render:r=><BoPill {...settlementStatus(r.status)}/>},
    {key:"income",header:"Thao tác",minWidth:130,align:"right",render:r=><div className="pay-settlement-actions"><button type="button" className="secondary-btn" onClick={()=>router.push(ROOT+"?"+new URLSearchParams({centerId,record:id,incomeStaff:r.staffMemberId}))}>Xem thu nhập</button></div>},
   ]}
   emptyTitle="Chưa có giờ công" emptyMessage="Không có bản ghi đủ điều kiện trong trang hiện tại."/>
  {page.nextOffset!==null?<button type="button" disabled={busy} onClick={()=>void more()}>Tải thêm PTE</button>:null}
  {error?<p role="alert">{error}</p>:null}
 </section></>;
}

function PeriodHistory({centerId,id}:{centerId:string;id:string}){
 const [offset,setOffset]=useState(0);
 const [result,setResult]=useState<{offset:number;rows:ReturnType<typeof nativePeriodHistory>;nextOffset:number|null;error:string}|null>(null);
 useEffect(()=>{
  let live=true;
  void periodApi.history(centerId,id,offset).then(({data})=>{
   const rows=nativePeriodHistory(data,centerId,id,offset);
   if(live)setResult({offset,rows,nextOffset:data.nextOffset,error:""});
  }).catch(e=>{if(live)setResult({offset,rows:[],nextOffset:null,error:errorText(e)});});
  return()=>{live=false;};
 },[centerId,id,offset]);
 const page=result?.offset===offset?result:null;
 if(!page)return <p role="status">Đang tải lịch sử…</p>;
 if(page.error)return <p role="alert">{page.error}</p>;
 return <section aria-label="Lịch sử kỳ lương">
  <BoDataGrid showToolbar={false} rows={page.rows} rowKey={r=>r.id} caption="Lịch sử kỳ lương" columns={[
   {key:"action",header:"Thao tác",render:r=>r.action},
   {key:"time",header:"Thời gian",render:r=>r.time},
   {key:"actor",header:"Người thao tác",render:r=>r.actor},
  ]} emptyTitle="Chưa có lịch sử" emptyMessage="Không có sự kiện được cấp quyền."/>
  {offset>0?<button type="button" onClick={()=>setOffset(Math.max(0,offset-50))}>Trang trước</button>:null}
  {page.nextOffset!==null?<button type="button" onClick={()=>setOffset(page.nextOffset!)}>Trang sau</button>:null}
 </section>;
}
