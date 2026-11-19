"use client";
/** PAP-1985 / PAP-1063 native Kỳ lương view. Core is the only money authority. */
import Link from "next/link";
import {PayrollIncomeDetail} from "./PayrollIncomeDetail";
import {SettlementIncomeDrawer} from "./SettlementIncomeDrawer";
import {canSubmitPayrollAdjustmentScope,submitPayrollAdjustment} from "@/lib/bo-payroll-adjustment-client";
import {SettlementExceptionDetail} from "./SettlementExceptionDetail";
import {useEffect,useState,useRef} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import {PayrollNativeTable} from "./PayrollNativeTable";
import {BoFullDetail} from "@/app/bo/components/BoFullDetail";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {PeriodProperties,CreatePeriod,periodFields,periodRecord} from "./PeriodProperties";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {periodApi,money,type PeriodStaffPage} from "@/lib/bo-payroll-period-api";
import {nativePeriodRow,nativePeriodHistory,type NativePeriodRow} from "@/lib/bo-payroll-native-period-model";
import {staffWithWorkEvidence,periodSummaries} from "@/lib/bo-payroll-read-model";

import {payrollVerifiedName} from "@/lib/bo-payroll-safe-read-metadata";

const ROOT="/bo/payroll-periods";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const periodModule={label:"Kỳ lương",group:"Workforce",fields:periodFields};
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
 const incomeException=query.get("incomeException");
 if(query.has("incomeException")&&(!record||!incomeStaff||!uuid.test(incomeStaff)||query.getAll("incomeStaff").length!==1||!incomeException||!uuid.test(incomeException)||query.getAll("incomeException").length!==1||query.has("incomeDay")||query.has("incomeDrawer")||query.has("fromSettlement")))return <p role="alert">Ngoại lệ không hợp lệ.</p>;
 const incomeDrawer=query.get("incomeDrawer");
 if(query.has("incomeDrawer")&&(!record||!incomeDrawer||!uuid.test(incomeDrawer)||query.getAll("incomeDrawer").length!==1||query.has("incomeStaff")||query.get("tab")!=="settlements"))return <p role="alert">PTE không hợp lệ.</p>;
 if(query.has("incomeStaff")){
  if(!record||!incomeStaff||query.getAll("incomeStaff").length!==1||!uuid.test(incomeStaff))return <p role="alert">PTE không hợp lệ.</p>;
  if(incomeException)return <SettlementExceptionDetail key={JSON.stringify([center.id,record,incomeStaff,incomeException])} centerId={center.id} periodId={record} staffId={incomeStaff} requestId={incomeException} tab={query.get("tab")}/>;
  const incomeDay=query.get("incomeDay");
  if(query.has("incomeDay")&&(query.getAll("incomeDay").length!==1||!incomeDay||!/^\d{4}-\d{2}-\d{2}$/.test(incomeDay)))return <p role="alert">Ngày công không hợp lệ.</p>;
  return <PayrollIncomeDetail dayDate={incomeDay} key={JSON.stringify([center.id,record,incomeStaff,incomeDay])} centerId={center.id} centerName={center.displayName} id={record} staffId={incomeStaff} tab={query.get("tab")} fromSettlement={query.getAll("fromSettlement").length===1&&query.get("fromSettlement")==="1"}/>;
 }
 if(record)return <PeriodDetail key={JSON.stringify([center.id,record])} centerId={center.id} centerName={center.displayName} id={record} tab={query.get("tab")} incomeDrawer={incomeDrawer}/>;
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
  <header className="page-heading"><div className="page-heading-left"><h1>Kỳ lương</h1></div><div className="heading-actions"><button type="button" className="secondary-btn" onClick={()=>{setCreating(false);setSelected(null);setRefresh(r=>r+1);}}>Tải lại</button>{current?.canCreate?<button type="button" className="primary-btn" onClick={()=>{setSelected(null);setCreating(true);}}>Tạo mới</button>:null}</div></header>
  <PayrollNativeTable module={periodModule} rows={rows.map(periodRecord)} loadState={!current?"loading":current.error||"ready"}
   onOpen={r=>{setCreating(false);setSelected(r.id);}} selected={selected}
   page={Math.floor(offset/50)+1} total={current?.total??0}
   onPageChange={n=>{setSelected(null);setOffset((n-1)*50);}}/>
  {creating&&current?.canCreate?<CreatePeriod centerId={centerId} centerName={centerName} keyForPayload={keyForPayload} onClose={()=>setCreating(false)} onSaved={refreshAfterWrite}/>:null}
  {row&&!creating?<DrawerFrame title={row.name} path="Kỳ lương" onClose={()=>setSelected(null)}
   footer={<Link className="primary-btn" href={detailUrl(centerId,row.id)}>Full Detail</Link>}>
   <PeriodProperties key={row.id+":"+row.version} row={row} variant="drawer" onSaved={refreshAfterWrite}/>
  </DrawerFrame>:null}
 </section>;
}
function PeriodDetail({centerId,centerName,id,tab,incomeDrawer}:{centerId:string;centerName:string;id:string;tab:string|null;incomeDrawer:string|null}){
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
   {id:"settlements",label:"Quyết Toán",content:<Settlements key={id+":"+refresh} centerId={centerId} id={id} initial={rollup} incomeDrawer={incomeDrawer} onFinalized={()=>setRefresh(r=>r+1)}/>},
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
function Settlements({centerId,id,initial,incomeDrawer,onFinalized}:{centerId:string;id:string;initial:PeriodStaffPage;incomeDrawer:string|null;onFinalized:()=>void}){
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
  <PayrollNativeTable module={{label:"Quyết toán theo PTE",group:"Workforce",fields:[
    {key:"name",label:"PTE",type:"text",icon:"Aa",w:220,readonly:true},
    {key:"amount",label:"Thành tiền",type:"text",icon:"#",w:150,readonly:true},
    {key:"status",label:"Trạng thái",type:"select",icon:"◉",w:140,readonly:true}
   ]}} rows={visible.map(r=>({id:r.staffMemberId,name:payrollVerifiedName(r.staffName),amount:money(r.amountMinor),status:settlementStatus(r.status).text}))}
   loadState="ready" selected={incomeDrawer} onOpen={r=>router.push(detailUrl(centerId,id)+"&tab=settlements&incomeDrawer="+encodeURIComponent(r.id))}/>
  {page.nextOffset!==null?<button type="button" disabled={busy} onClick={()=>void more()}>Tải thêm PTE</button>:null}
  {error?<p role="alert">{error}</p>:null}
  {incomeDrawer?<SettlementIncomeDrawer key={JSON.stringify([centerId,id,initial.period.startDate,initial.period.endDate,initial.period.status,incomeDrawer])} centerId={centerId} period={initial.period} staffId={incomeDrawer} submitAdjustment={canSubmitPayrollAdjustmentScope(centerId,id,incomeDrawer)?submitPayrollAdjustment:undefined} onAdjusted={onFinalized} onClose={()=>router.replace(detailUrl(centerId,id)+"&tab=settlements")} onFinalized={()=>{router.replace(detailUrl(centerId,id)+"&tab=settlements");onFinalized();}}/>:null}
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
  <PayrollNativeTable module={{label:"Lịch sử kỳ lương",group:"Workforce",fields:[
   {key:"name",label:"Thao tác",type:"text",icon:"Aa",w:220,readonly:true},
   {key:"time",label:"Thời gian",type:"text",icon:"◷",w:160,readonly:true},
   {key:"actor",label:"Người thao tác",type:"text",icon:"Aa",w:180,readonly:true}
  ]}} rows={page.rows.map(r=>({id:r.id,name:r.action,time:r.time,actor:r.actor}))} loadState="ready"/>
  {offset>0?<button type="button" onClick={()=>setOffset(Math.max(0,offset-50))}>Trang trước</button>:null}
  {page.nextOffset!==null?<button type="button" onClick={()=>setOffset(page.nextOffset!)}>Trang sau</button>:null}
 </section>;
}
