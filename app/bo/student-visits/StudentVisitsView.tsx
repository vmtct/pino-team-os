"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BoDataGrid, BoDataGridCanonicalId, BoDataGridSidePeek, BoDataGridStatus, useBoDataGridUrlState, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import { boApi, BoApiError } from "@/lib/bo-api";
import { boStudentVisits, type BoStudentVisit, type BoStudentVisitDetail, type BoStudentVisitsPage } from "@/lib/bo-student-visits";
import { isoToLocalInput, localInputToIso } from "@/lib/bo-timekeeping-local-time";
import styles from "./student-visits.module.css";

type Center={id:string;displayName:string;timeZone:string};
type Load={kind:"loading"}|{kind:"error";message:string;status?:number}|{kind:"ready";page:BoStudentVisitsPage};
const PAGE_SIZES=[10,25,50,100] as const;

export function StudentVisitsView(){
  const {state,setPage,setPageSize,setFilter,setSearch,setSort}=useBoDataGridUrlState({defaultPageSize:25,allowedPageSizes:PAGE_SIZES});
  const setPageRef=useRef(setPage);setPageRef.current=setPage;
  const [centers,setCenters]=useState<Center[]>([]);
  const [load,setLoad]=useState<Load>({kind:"loading"});
  const [selectedId,setSelectedId]=useState("");
  const [detail,setDetail]=useState<BoStudentVisitDetail|null>(null);
  const [detailBusy,setDetailBusy]=useState(false);
  const [detailError,setDetailError]=useState("");
  const [refresh,setRefresh]=useState(0);
  const [notice,setNotice]=useState("");
  const dirtyGuard=useRef<()=>boolean>(()=>true);
  const centerId=state.filters.center??centers[0]?.id??"";
  const center=centers.find(item=>item.id===centerId)??null;
  const status=state.filters.status==="OPEN"||state.filters.status==="CLOSED"?state.filters.status:undefined;
  const sort=state.sortKey==="student"||state.sortKey==="checkOut"||state.sortKey==="status" ?state.sortKey:"checkIn";
  const fromDate=state.filters.from??"",toDate=state.filters.to??"";
  const startAt=fromDate&&center?localInputToIso(`${fromDate}T00:00`,center.timeZone):null;
  const nextDate=toDate?new Date(Date.parse(`${toDate}T00:00:00Z`)+86400000).toISOString().slice(0,10):"";
  const endBefore=nextDate&&center?localInputToIso(`${nextDate}T00:00`,center.timeZone):null;
  const invalidDates=Boolean((fromDate&&!startAt)||(toDate&&!endBefore)||(startAt&&endBefore&&startAt>=endBefore));
  const page=load.kind==="ready"?load.page:null;
  const columns=useMemo<BoDataGridColumn<BoStudentVisit>[]>(()=>[
    {key:"student",header:"Student",sticky:true,sortable:true,minWidth:220,render:row=><span><strong>{row.student.displayName}</strong><br/><BoDataGridCanonicalId value={row.studentProfileId} label="Copy Student ID"/></span>},
    {key:"center",header:"Center",minWidth:155,render:row=>row.center.displayName},
    {key:"checkIn",header:"Check-in",sortable:true,minWidth:170,render:row=>clock(row.checkedInAt,row.center.timeZone)},
    {key:"checkOut",header:"Check-out",sortable:true,minWidth:170,render:row=>row.checkedOutAt?clock(row.checkedOutAt,row.center.timeZone):"—"},
    {key:"duration",header:"Duration",minWidth:100,render:row=>duration(row.durationSeconds)},
    {key:"status",header:"State",sortable:true,minWidth:100,render:row=><BoDataGridStatus value={row.status} tone={row.status==="OPEN"?"warning":"success"}/>},
    {key:"source",header:"Source",minWidth:145,render:row=>row.sourceRegistrationId?"Registration":"Center Visit"},
    {key:"actor",header:"Recorded by",minWidth:145,render:row=>row.recordedByUserId??"Not recorded"},
  ],[]);
  useEffect(()=>{
    let live=true;
    void boApi.centers().then(rows=>{if(live)setCenters(rows.map(row=>({id:row.id,displayName:row.displayName,timeZone:row.timeZone})))})
      .catch(error=>{if(live)setLoad({kind:"error",message:errorMessage(error),status:error instanceof BoApiError?error.status:undefined});});
    return()=>{live=false;};
  },[]);
  useEffect(()=>{
    if(!centerId||invalidDates){if(!centerId)setLoad({kind:"error",message:"No authorized Center is available."});return;}
    let live=true;setLoad({kind:"loading"});
    void boStudentVisits.list({centerId,query:state.search||undefined,status,
      studentProfileId:state.filters.student||undefined,
      startAt:startAt||undefined,endBefore:endBefore||undefined,
      sort,order:state.sortDirection,limit:state.pageSize,offset:(state.page-1)*state.pageSize
    }).then(data=>{
      if(!live)return;
      if(state.page>1&&data.total<=(state.page-1)*state.pageSize){setPageRef.current(Math.max(1,Math.ceil(data.total/state.pageSize)));return;}
      setLoad({kind:"ready",page:data});
    }).catch(error=>{if(live)setLoad({kind:"error",message:errorMessage(error),status:error instanceof BoApiError?error.status:undefined});});
    return()=>{live=false;};
  },[centerId,state.search,state.filters.student,state.page,state.pageSize,status,sort,state.sortDirection,startAt,endBefore,invalidDates,refresh]);
  useEffect(()=>{
    if(!selectedId||!centerId){setDetail(null);return;}
    let live=true;setDetailBusy(true);setDetailError("");
    void boStudentVisits.detail(selectedId,centerId).then(row=>{if(live)setDetail(row)})
      .catch(error=>{if(live){setDetail(null);setDetailError(errorMessage(error));}})
      .finally(()=>{if(live)setDetailBusy(false)});
    return()=>{live=false;};
  },[selectedId,centerId,refresh]);
  function close(){
    if(!dirtyGuard.current())return;
    setSelectedId("");setDetail(null);setNotice("");
  }
  function open(row:BoStudentVisit){
    if(selectedId&&!dirtyGuard.current())return;
    setSelectedId(row.id);setDetail(null);setNotice("");
  }
  return <main className={styles.page}>
    <header><span className={styles.eyebrow}>Back Office · School</span><h1>Student Visits</h1><p>Physical Center presence ledger. Visit is not Session Attendance, Classroom Diary or a payment record.</p></header>
    {page?<section className={styles.metrics} aria-label="Center Visit totals">
      <Metric label="Visits in Center" value={page.summary.totalVisits}/>
      <Metric label="Currently inside" value={page.summary.openVisits}/>
      <Metric label="Closed Visits" value={page.summary.closedVisits}/>
      <div className={styles.metric}><span>Needs reconciliation</span><strong>Not available</strong><small>No approved anomaly threshold</small></div>
    </section>:null}
    {notice?<p className={styles.notice} role="status">{notice}</p>:null}
    {invalidDates?<p role="alert">Invalid Center-local date range. Choose a valid From / To period.</p>:null}
    <BoDataGrid rows={page?.data??[]} columns={columns} rowKey={row=>row.id} caption="Canonical Student Visit Ledger"
      state={invalidDates?"error":load.kind==="loading"?"loading":load.kind==="error"?(load.status===403?"permission":"error"):"ready"}
      stateMessage={invalidDates?"Invalid Center-local date range":load.kind==="error"?load.message:undefined}
      search={state.search} onSearchChange={setSearch} searchPlaceholder="Search Student or Visit ID…"
      sortKey={sort} sortDirection={state.sortDirection} onSortChange={(key,direction)=>setSort(key,direction)}
      resultLabel={page?`${page.total} matching Visits`:undefined}
      toolbarActions={<div className={styles.actions}>
        <label>Center<select aria-label="Filter visits by Center" value={centerId} onChange={event=>{if(!dirtyGuard.current())return;close();setFilter("center",event.target.value||null)}}>
          <option value="">Choose Center</option>{centers.map(row=><option key={row.id} value={row.id}>{row.displayName}</option>)}
        </select></label>
        <label>State<select aria-label="Filter Visit state" value={status??""} onChange={event=>setFilter("status",event.target.value||null)}>
          <option value="">All</option><option value="OPEN">OPEN</option><option value="CLOSED">CLOSED</option>
        </select></label>
        <label>From<input aria-label="Visit start date" type="date" value={fromDate} onChange={event=>setFilter("from",event.target.value||null)}/></label>
        <label>To<input aria-label="Visit end date" type="date" value={toDate} onChange={event=>setFilter("to",event.target.value||null)}/></label>
        <button type="button" disabled title="Manual BO check-in requires a verified Student–Center admission rule" aria-label="Manual check-in not ready">Manual check-in · NOT READY</button>
      </div>}
      onRefresh={()=>setRefresh(x=>x+1)} selectedRowKey={selectedId||null} onRowOpen={open}
      pagination={page?{page:state.page,pageSize:state.pageSize,total:page.total,pageSizeOptions:PAGE_SIZES,onPageChange:setPage,onPageSizeChange:setPageSize}:undefined}
      emptyTitle="No Student Visits" emptyMessage="There are no canonical Visit records for the selected authorized Center and filters."
    />
    {selectedId?<BoDataGridSidePeek title={detail?.student.displayName??"Student Visit"} eyebrow="School · Center presence" onClose={close}>
      {detailBusy?<p>Loading canonical Visit…</p>:detailError?<p role="alert">{detailError}<button type="button" onClick={()=>setRefresh(v=>v+1)}>Reload</button></p>:
      detail?<VisitDetail key={detail.id+`:${detail.version}`} visit={detail} onDirtyGuard={fn=>{dirtyGuard.current=fn}} onSaved={()=>{setNotice("Core saved the Visit; refetching the canonical row.");setRefresh(v=>v+1)}}/>:null}
    </BoDataGridSidePeek>:null}
  </main>;
}
function Metric({label,value}:{label:string;value:number}){return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>;}
function clock(value:string,zone:string){try{return new Intl.DateTimeFormat("en-GB",{timeZone:zone,dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}catch{return value;}}
function duration(seconds:number|null){if(seconds===null)return "—";return `${Math.floor(seconds/3600)}h ${Math.floor((seconds%3600)/60)}m`;}
function errorMessage(error:unknown){return error instanceof Error?error.message:"Visit read/write failed. Reload before retrying.";}

function VisitDetail({visit,onDirtyGuard,onSaved}:{visit:BoStudentVisitDetail;onDirtyGuard:(fn:()=>boolean)=>void;onSaved:()=>void}){
  const [action,setAction]=useState<"none"|"checkout"|"correct">("none");
  const [at,setAt]=useState(isoToLocalInput(visit.checkedOutAt??new Date().toISOString(),visit.center.timeZone));
  const [inAt,setInAt]=useState(isoToLocalInput(visit.checkedInAt,visit.center.timeZone));
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [confirmed,setConfirmed]=useState(false);
  const [message,setMessage]=useState("");
  const attempt=useRef<{signature:string;key:string}|null>(null);
  const dirty=action!=="none"&&(Boolean(reason)||confirmed||at!==isoToLocalInput(visit.checkedOutAt??new Date().toISOString(),visit.center.timeZone)||inAt!==isoToLocalInput(visit.checkedInAt,visit.center.timeZone));
  onDirtyGuard(()=>!dirty||window.confirm("Discard unsaved Visit changes?"));
  async function submit(){
    if(busy||!confirmed||reason.trim().length<8)return;
    const checkedOutAt=visit.status==="OPEN"&&action==="correct"?null:localInputToIso(at,visit.center.timeZone);
    const checkedInAt=action==="correct"?localInputToIso(inAt,visit.center.timeZone):visit.checkedInAt;
    if(!checkedInAt||(!checkedOutAt&&action!=="correct")||(checkedOutAt&&Date.parse(checkedOutAt)<=Date.parse(checkedInAt))){setMessage("Invalid Center-local time; check-out must be after check-in.");return;}
    const body=action==="checkout"
      ?{centerId:visit.centerId,expectedVersion:visit.version,checkedOutAt:checkedOutAt!,reason:reason.trim()}
      :{centerId:visit.centerId,expectedVersion:visit.version,checkedInAt,checkedOutAt,checkInReason:visit.checkInReason,checkoutReason:checkedOutAt?(visit.checkoutReason??reason.trim()):null,reason:reason.trim()};
    const signature=JSON.stringify({visitId:visit.id,action,body});
    if(attempt.current?.signature!==signature)attempt.current={signature,key:crypto.randomUUID()};
    setBusy(true);setMessage("");
    try{
      if(action==="checkout")await boStudentVisits.checkOut(visit.id,body as Parameters<typeof boStudentVisits.checkOut>[1],attempt.current.key);
      else await boStudentVisits.correct(visit.id,body as Parameters<typeof boStudentVisits.correct>[1],attempt.current.key);
      attempt.current=null;setAction("none");setReason("");setConfirmed(false);onSaved();
    }catch(error){setMessage(errorMessage(error)+(error instanceof BoApiError&&error.status===409?" Reload to reconcile the latest version.":""));}
    finally{setBusy(false);}
  }
  return <div className={styles.detail}>
    <p><BoDataGridCanonicalId value={visit.id} label="Copy Student Visit ID"/> <BoDataGridStatus value={visit.status} tone={visit.status==="OPEN"?"warning":"success"}/></p>
    <dl>
      <dt>Student</dt><dd>{visit.student.displayName}</dd><dt>Center</dt><dd>{visit.center.displayName} ({visit.center.timeZone})</dd>
      <dt>Check-in</dt><dd>{clock(visit.checkedInAt,visit.center.timeZone)}</dd><dt>Check-out</dt><dd>{visit.checkedOutAt?clock(visit.checkedOutAt,visit.center.timeZone):"Still OPEN"}</dd>
      <dt>Duration</dt><dd>{duration(visit.durationSeconds)}</dd><dt>Recorded by</dt><dd>{visit.recordedByUserId??"Unknown"}</dd>
      <dt>Registration</dt><dd>{visit.sourceRegistrationId??"No registration reference"}</dd><dt>Version</dt><dd>{visit.version}</dd>
      <dt>Correction reason</dt><dd>{visit.correctionReason??"No corrections"}</dd>
    </dl>
    <h3>Actions</h3><div className={styles.actionRow}>
      {visit.status==="OPEN"?<button type="button" onClick={()=>{setAction("checkout");setConfirmed(false);setReason("");setMessage("");}}>Check-out</button>:null}
      <button type="button" onClick={()=>{setAction("correct");setConfirmed(false);setReason("");setMessage("");}}>Correct Visit</button>
    </div>
    {action!=="none"?<form onSubmit={event=>{event.preventDefault();void submit();}} className={styles.form}>
      <h4>{action==="checkout"?"Confirm same-Visit check-out":"Audited correction"}</h4>
      {action==="correct"?<label>Check-in (Center local time)<input type="datetime-local" value={inAt} onChange={e=>setInAt(e.target.value)} required/></label>:null}
      {action==="checkout"||visit.status==="CLOSED"?<label>Check-out (Center local time)<input type="datetime-local" value={at} onChange={e=>setAt(e.target.value)} required/></label>:null}
      <label>Reason (at least 8 characters)<textarea value={reason} onChange={e=>setReason(e.target.value)} minLength={8} maxLength={500} required/></label>
      <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Confirm this authorized change to Visit {visit.version}</label>
      <div className={styles.actionRow}><button type="submit" disabled={!confirmed||reason.trim().length<8||busy}>{busy?"Saving…":"Save to Core"}</button>
      <button type="button" disabled={busy} onClick={()=>{if(!dirty||window.confirm("Discard changes?")){setAction("none");setReason("");setConfirmed(false);attempt.current=null;}}}>Cancel</button></div>
    </form>:null}
    {message?<p role="alert">{message} <button type="button" onClick={onSaved}>Reload Visit</button></p>:null}
    <h3>Audit timeline</h3>
    {visit.timeline.length?<ol>{visit.timeline.map(e=><li key={e.id}><strong>{e.action}</strong> · {clock(e.occurredAt,visit.center.timeZone)} · {e.actorUserId??"system"}<pre>{JSON.stringify(e.details)}</pre></li>)}</ol>:<p>No Visit audit entries found.</p>}
    {visit.timelineTruncated?<p>Showing latest 100 events; full history is paginated in Core.</p>:null}
  </div>;
}
