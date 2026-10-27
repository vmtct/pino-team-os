"use client";
import {useEffect,useRef,useState} from "react";
import {boApi} from "@/lib/bo-api";
import {periodApi,money,type PayPeriod,type PeriodStaff,type PeriodStaffPage,PayrollPeriodApiError} from "@/lib/bo-payroll-period-api";
import {periodDisplayName,periodSummaries,staffWithWorkEvidence} from "@/lib/bo-payroll-read-model";
import styles from "./payroll-periods.module.css";

type Center={id:string;displayName:string;status:string};
type Stage="loading"|"ready"|"error";
const showDate=(v:string)=>v.split("-").reverse().join("/");
function status(s:PeriodStaff["status"]){return ({DRAFT:"Bản nháp",PENDING:"Cần xử lý",FINALIZED:"Đã chốt",PAID:"Đã chốt",ARCHIVED_UNAVAILABLE:"Không đủ dữ liệu"})[s];}
function err(e:unknown){return e instanceof PayrollPeriodApiError?e.status===403?"Bạn không được cấp quyền xem lương tại cơ sở này.":e.status===401?"Phiên đăng nhập đã hết hạn.":e.message:e instanceof Error?e.message:"Không thể tải dữ liệu lương.";}
function metrics(data:PeriodStaffPage|null){return data?periodSummaries(data.periodTotals):null;}
export default function PayrollPeriodsView(){
 const [centers,setCenters]=useState<Center[]>([]),[centerId,setCenterId]=useState("");
 const [periods,setPeriods]=useState<PayPeriod[]>([]),[rollups,setRollups]=useState<Record<string,PeriodStaffPage>>({});
 const [periodOffset,setPeriodOffset]=useState<number|null>(null),[selected,setSelected]=useState<PayPeriod|null>(null);
 const [drawer,setDrawer]=useState<PayPeriod|null>(null),[tab,setTab]=useState<"Detail"|"Quyết Toán"|"Lịch Sử">("Detail");
 const [page,setPage]=useState<PeriodStaffPage|null>(null),[staffRows,setStaffRows]=useState<PeriodStaff[]>([]);
 const [staffNames,setStaffNames]=useState<Record<string,string>>({});
 const [staffOffset,setStaffOffset]=useState<number|null>(null),[loading,setLoading]=useState<Stage>("loading"),[detailLoad,setDetailLoad]=useState<Stage>("ready");
 const [error,setError]=useState(""),[detailError,setDetailError]=useState("");
 const [query,setQuery]=useState(""),[reload,setReload]=useState(0),generation=useRef(0);
 const center=centers.find(c=>c.id===centerId);
 useEffect(()=>{let live=true;void Promise.all([boApi.centers(),boApi.staffRecords().catch(()=>[])]).then(([all,staff])=>{
  if(!live)return;const active=all.filter(x=>x.status==="active");setCenters(active);setCenterId(v=>v||active[0]?.id||"");
  setStaffNames(Object.fromEntries(staff.map(x=>[x.id,x.displayLabel])));if(!active.length)setLoading("ready");
 }).catch(e=>{if(live){setLoading("error");setError(err(e));}});return()=>{live=false;};},[]);
 useEffect(()=>{const gen=++generation.current;setPeriods([]);setRollups({});setSelected(null);setDrawer(null);setPage(null);setStaffRows([]);setPeriodOffset(null);setError("");
  if(!centerId)return;setLoading("loading");
  void periodApi.list(centerId).then(async r=>{if(gen!==generation.current)return;
   const list=r.data.data;setPeriods(list);setPeriodOffset(r.data.nextOffset);setLoading("ready");
   // Read-only GETs, throttled to 3 requests at a time. Money remains Core-owned.
   for(let i=0;i<list.length;i+=3){if(gen!==generation.current)return;const results=await Promise.allSettled(list.slice(i,i+3).map(p=>periodApi.staff(centerId,p.id)));
    if(gen!==generation.current)return;const failure=results.find(x=>x.status==="rejected");if(failure&&failure.status==="rejected")setError(err(failure.reason));setRollups(old=>({...old,...Object.fromEntries(results.flatMap((out,j)=>out.status==="fulfilled"?[[list[i+j]!.id,out.value.data]]:[]))}));}
  }).catch(e=>{if(gen===generation.current){setLoading("error");setError(err(e));}});
  return()=>{generation.current++;};
 },[centerId,reload]);
 useEffect(()=>{if(!selected||!centerId)return;let live=true;setDetailLoad("loading");setDetailError("");setPage(null);setStaffRows([]);
  void Promise.all([periodApi.get(centerId,selected.id),periodApi.staff(centerId,selected.id)])
   .then(([period,rollup])=>{if(!live)return;setSelected(period.data);setPage(rollup.data);setStaffRows(rollup.data.rows);setStaffOffset(rollup.data.nextOffset);setRollups(v=>({...v,[selected.id]:rollup.data}));setDetailLoad("ready");})
   .catch(e=>{if(live){setDetailError(err(e));setDetailLoad("error");}});
  return()=>{live=false;};
 // Period id and center id are stable; don't fetch recursively when server returns a fresh Period object.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[selected?.id,centerId,reload]);
 function go(period:PayPeriod){setSelected(period);setDrawer(null);setTab("Detail");}
 async function loadMoreStaff(){if(!selected||staffOffset===null)return;const offset=staffOffset;try{const p=await periodApi.staff(centerId,selected.id,offset);setStaffRows(s=>[...s,...p.data.rows]);setStaffOffset(p.data.nextOffset);}catch(e){setDetailError(err(e));}}
 async function loadMorePeriods(){if(periodOffset===null)return;try{const r=await periodApi.list(centerId,periodOffset);setPeriods(p=>[...p,...r.data.data]);setPeriodOffset(r.data.nextOffset);}catch(e){setError(err(e));}}
 const visible=periods.filter(p=>[periodDisplayName(p.startDate,center?.displayName||""),p.id,p.startDate,p.endDate].some(x=>x.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))));
 const summary=metrics(page);
 return <div id="app" data-bo-runtime="react" data-bo-module="payroll-periods"><main className={styles.page}>
  {!selected?<><div className="page-heading"><div className="page-heading-left"><h1>Kỳ lương</h1></div><div className="heading-actions"><label className={styles.center}>Cơ sở <select aria-label="Cơ sở" value={centerId} onChange={e=>setCenterId(e.target.value)}>{centers.map(c=><option key={c.id} value={c.id}>{c.displayName}</option>)}</select></label><button type="button" className="secondary-btn" onClick={()=>setReload(v=>v+1)}>Làm mới</button></div></div>
   <div className="grid-card"><div className="view-tabs"><div className="tabs-left"><span className="view-tab active">Tất cả</span></div><div className="tabs-right"><span className="table-meta">{visible.length} bản ghi</span></div></div>
    <div className="toolbar"><label className="search-field"><span>⌕</span><input aria-label="Tìm kỳ lương" placeholder="Tìm kỳ lương..." value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
    {error?<div role="alert" className={styles.error}>{error}</div>:null}
    <div className="table-scroll"><table className={styles.table}><caption>Kỳ lương</caption><thead><tr><th>↗</th><th>Kỳ lương</th><th>ID</th><th>Khoảng ngày</th><th>PTE có công</th><th>Tổng Dự Kiến</th><th>Tổng Quyết Toán</th><th>Trạng thái</th></tr></thead><tbody>
     {visible.map(p=>{const sum=metrics(rollups[p.id]);return <tr key={p.id}><td><button className="row-open" aria-label={"Quick View "+p.id} onClick={()=>setDrawer(p)}>↗</button></td><td><button type="button" className={styles.rowLink} onClick={()=>go(p)}>{periodDisplayName(p.startDate,center?.displayName||"")}</button></td><td>{p.id}</td><td>{showDate(p.startDate)} – {showDate(p.endDate)}</td><td>{rollups[p.id]?.nextOffset===null?staffWithWorkEvidence(rollups[p.id].rows).length:"—"}</td><td>{sum?money(sum.expected):"—"}</td><td>{sum?money(sum.finalized):"—"}</td><td>{p.status==="ARCHIVED"?"Lưu trữ":"Đang mở"}</td></tr>;})}
     {loading==="loading"?<tr><td colSpan={8} role="status">Đang tải kỳ lương…</td></tr>:loading==="ready"&&!visible.length?<tr><td colSpan={8}>Chưa có kỳ lương trong phạm vi được cấp quyền.</td></tr>:null}
    </tbody></table></div>{periodOffset!==null?<button className="secondary-btn" type="button" onClick={()=>void loadMorePeriods()}>Tải thêm</button>:null}
   </div></>:<><div className="detail-cover"><div className="detail-hero"><div className="detail-hero-primary"><button className="detail-hero-back" type="button" aria-label="Quay về bảng" onClick={()=>{setSelected(null);setPage(null);}}>←</button><div className="detail-hero-copy"><h1>{periodDisplayName(selected.startDate,center?.displayName||"")}</h1><p>{showDate(selected.startDate)} – {showDate(selected.endDate)} · {center?.displayName||""}</p></div></div></div></div>
    <div className="detail-tabs" role="tablist" aria-label="Kỳ lương">{(["Detail","Quyết Toán","Lịch Sử"] as const).map(t=><button key={t} className={"detail-tab "+(tab===t?"selected":"")} role="tab" aria-selected={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</div>
    <div className={styles.detailBody}><div className="detail-panel v24-main-panel">
     {detailError?<div role="alert" className={styles.error}>{detailError}</div>:null}
     {tab==="Detail"?<><section className="property-section"><h3>Chi tiết</h3>{([["Period ID",selected.id],["Tên kỳ",periodDisplayName(selected.startDate,center?.displayName||"")],["Từ ngày",showDate(selected.startDate)],["Đến ngày",showDate(selected.endDate)],["Trạng thái",selected.status==="ACTIVE"?"Đang mở":"Lưu trữ"],["Center",center?.displayName||"—"]] as const).map(([k,v])=><div className="property-row" key={k}><div className="property-label"><span>{k}</span></div><div className="property-control pay-property">{v}</div></div>)}</section>
      <Kpis summary={summary}/><section className="property-section"><h3>PTE đã tính được lương</h3>{staffWithWorkEvidence(staffRows).filter(x=>x.amountMinor!==null).length?<div className={styles.compactList}>{staffWithWorkEvidence(staffRows).filter(x=>x.amountMinor!==null).map(s=><div key={s.staffMemberId} className={styles.compactRow}><span>{staffNames[s.staffMemberId]??s.staffMemberId}</span><strong>{money(s.amountMinor)}</strong></div>)}</div>:<div className={styles.empty}>Chưa có lương để hiển thị.</div>}</section>
     </>:tab==="Quyết Toán"?<><Kpis summary={summary}/><section className="property-section"><h3>Quyết toán theo PTE</h3>{staffWithWorkEvidence(staffRows).length?<div className="table-scroll"><div className={styles.settlementTable} role="table" aria-label="Quyết toán theo PTE"><div role="row" className={styles.settlementHead}><span role="columnheader">PTE</span><span role="columnheader">Thành tiền</span><span role="columnheader">Trạng thái</span><span role="columnheader">Thao tác</span></div>{staffWithWorkEvidence(staffRows).map(s=><div role="row" key={s.staffMemberId} className={styles.settlementRow}><span role="cell">{staffNames[s.staffMemberId]??s.staffMemberId}<small>{s.staffMemberId}</small></span><strong role="cell" className={styles.amount}>{money(s.amountMinor)}</strong><span role="cell">{status(s.status)}</span><span role="cell">—</span></div>)}</div></div>:<div className={styles.empty}>Chưa có giờ công trong kỳ.</div>}</section>
      {staffOffset!==null?<button type="button" className="secondary-btn" onClick={()=>void loadMoreStaff()}>Tải thêm PTE</button>:null}
     </>:<div className={styles.empty}>Chưa có dữ liệu lịch sử được cấp quyền.</div>}
     {detailLoad==="loading"?<p role="status">Đang tải dữ liệu quyết toán…</p>:null}
    </div></div></>}
   {drawer?<div className={styles.backdrop} onClick={()=>setDrawer(null)}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-label="Quick View Kỳ lương" onClick={e=>e.stopPropagation()}><header><h2>{periodDisplayName(drawer.startDate,center?.displayName||"")}</h2><button aria-label="Đóng Quick View" className="secondary-btn" onClick={()=>setDrawer(null)}>×</button></header><div className="property-section">{([["ID",drawer.id],["Từ ngày",showDate(drawer.startDate)],["Đến ngày",showDate(drawer.endDate)],["Center",center?.displayName||"—"],["Tổng Dự Kiến",rollups[drawer.id]?money(metrics(rollups[drawer.id])!.expected):"—"],["Tổng Quyết Toán",rollups[drawer.id]?money(metrics(rollups[drawer.id])!.finalized):"—"]] as const).map(([key,v])=><div className="property-row" key={key}><span className="property-label">{key}</span><span className="property-control">{v}</span></div>)}</div><button className="primary-btn" onClick={()=>go(drawer)}>Full Detail</button></aside></div>:null}
  </main></div>;
}
function Kpis({summary}:{summary:{expected:number;finalized:number}|null}){return <div className={styles.kpis} aria-label="Tổng hợp kỳ lương"><div className={styles.kpi}><span>Tổng Dự Kiến</span><strong data-pay-total-expected>{summary?money(summary.expected):"—"}</strong></div><div className={styles.kpi}><span>Tổng Quyết Toán</span><strong data-pay-total-finalized>{summary?money(summary.finalized):"—"}</strong></div></div>;}
