"use client";
/** PAP-1985 / PAP-1063 native Kỳ lương view. Core is the only money authority. */
import Link from "next/link";
import {useEffect,useState,useRef} from "react";
import {useSearchParams} from "next/navigation";
import {BoDataGrid,BoDataGridBadge,type BoDataGridColumn} from "@/app/bo/components/data-grid";
import {BoFullDetail} from "@/app/bo/components/BoFullDetail";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {PeriodProperties,CreatePeriod} from "./PeriodProperties";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {periodApi,money,type PeriodStaffPage} from "@/lib/bo-payroll-period-api";
import {nativePeriodRow,nativePeriodStatus,type NativePeriodRow} from "@/lib/bo-payroll-native-period-model";
import {staffWithWorkEvidence} from "@/lib/bo-payroll-read-model";

const ROOT="/bo/payroll-periods";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const status=nativePeriodStatus;
const fields:{key:string;label:string;value:(r:NativePeriodRow)=>string}[]=[
 {key:"name",label:"Tên kỳ",value:r=>r.name},
 {key:"startDate",label:"Bắt đầu",value:r=>r.startDate},
 {key:"endDate",label:"Kết thúc",value:r=>r.endDate},
 {key:"status",label:"Trạng thái",value:status},
 {key:"staffCount",label:"PTE có công",value:r=>r.staffCount===null?"—":String(r.staffCount)},
 {key:"expected",label:"Tổng Dự Kiến",value:r=>money(r.expected)},
 {key:"finalized",label:"Tổng Quyết Toán",value:r=>money(r.finalized)},
 {key:"createdAt",label:"Created Time",value:r=>r.createdTime},
 {key:"createdBy",label:"Created By",value:r=>r.createdActor},
 {key:"updatedAt",label:"Last Modified Time",value:r=>r.modifiedTime},
 {key:"updatedBy",label:"Last Modified By",value:r=>r.modifiedActor},
];
const columns:BoDataGridColumn<NativePeriodRow>[]=fields.map(f=>({
 key:f.key,header:f.label,minWidth:f.key==="name"?220:145,
 render:r=>f.key==="status"?<BoDataGridBadge>{f.value(r)}</BoDataGridBadge>:f.value(r),
}));
const tableUrl=(center:string)=>ROOT+"?"+new URLSearchParams({centerId:center});
const detailUrl=(center:string,id:string)=>ROOT+"?"+new URLSearchParams({centerId:center,record:id});

function errorText(e:unknown){return e instanceof Error?e.message:"Không thể tải kỳ lương Core.";}
export default function BoNativePayrollPeriods(){
 const scope=useBoCenterSelection(),query=useSearchParams();
 const center=scope?.centers.find(c=>c.id===scope.selected);
 const allowed=Boolean(scope&&!scope.loading&&!scope.error&&center);
 const record=query.get("record");
 if(!allowed||!center)return scope?.loading?<p role="status">Đang xác thực cơ sở…</p>:<p role="alert">{scope?.error||"Chọn cơ sở được cấp quyền."}</p>;
 if(record&&!uuid.test(record))return <p role="alert">Kỳ lương không hợp lệ.</p>;
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
  <header><h1>Kỳ lương</h1></header>
  <BoDataGrid rows={rows} columns={columns} rowKey={r=>r.id} caption="Kỳ lương"
   state={!current?"loading":current.error?"error":"ready"} stateMessage={current?.error}
   onRefresh={()=>{setCreating(false);setSelected(null);setRefresh(r=>r+1);}}
   toolbarActions={current?.canCreate?<button type="button" className="primary-btn" onClick={()=>{setSelected(null);setCreating(true);}}>Tạo mới</button>:null}
   onRowOpen={r=>{setCreating(false);setSelected(r.id);}} quickViewOpener
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
 return <BoFullDetail title={row.name} currentUrl={detailUrl(centerId,id)} returnTo={tableUrl(centerId)} activeTab={tab}
  tabs={[
   {id:"overview",label:"Tổng quan",content:<PeriodProperties key={row.id+":"+row.version} row={row} variant="detail" onSaved={()=>setRefresh(r=>r+1)}/>},
   {id:"settlements",label:"Quyết Toán",content:<Settlements key={id} centerId={centerId} id={id} initial={rollup}/>},
   {id:"history",label:"Lịch sử",content:<p>Chưa có nguồn lịch sử kỳ lương được cấp quyền.</p>},
  ]}/>;
}
function Settlements({centerId,id,initial}:{centerId:string;id:string;initial:PeriodStaffPage}){
 const [page,setPage]=useState(initial),[rows,setRows]=useState(initial.rows);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const visible=staffWithWorkEvidence(rows);
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
 return <section aria-label="Quyết toán theo PTE">
  <BoDataGrid rows={visible} rowKey={r=>r.staffMemberId} caption="Quyết toán theo PTE"
   columns={[{key:"staff",header:"PTE",render:r=>r.staffMemberId},{key:"amount",header:"Thành tiền",render:r=>money(r.amountMinor)},{key:"status",header:"Trạng thái",render:r=>r.status}]}
   emptyTitle="Chưa có giờ công" emptyMessage="Không có bản ghi đủ điều kiện trong trang hiện tại."/>
  {page.nextOffset!==null?<button type="button" disabled={busy} onClick={()=>void more()}>Tải thêm PTE</button>:null}
  {error?<p role="alert">{error}</p>:null}
 </section>;
}
