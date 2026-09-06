"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoCenter, BoTimekeepingPage, BoTimekeepingSession } from "@/lib/bo-model";
import styles from "./timekeeping.module.css";

type Mode = "today" | "history";
type Load = { state:"loading" } | { state:"error"; message:string } | { state:"ready"; page:BoTimekeepingPage };

export function TimekeepingView(){
  const [centers,setCenters]=useState<BoCenter[]>([]), [centerId,setCenterId]=useState(""), [mode,setMode]=useState<Mode>("today");
  const [startDate,setStartDate]=useState(""), [endDate,setEndDate]=useState(""), [status,setStatus]=useState<""|"OPEN"|"CLOSED">("");
  const [staffId,setStaffId]=useState(""), [selectedId,setSelectedId]=useState(""), [load,setLoad]=useState<Load>({state:"loading"});
  const selectedCenter=centers.find(c=>c.id===centerId)??null;
  const today=selectedCenter?localDate(selectedCenter.timeZone):"";
  const page=load.state==="ready"?load.page:null;
  const staffOptions=useMemo(()=>Array.from(new Map((page?.data??[]).map(s=>[s.staff.id,s.staff])).values()).sort((a,b)=>a.displayLabel.localeCompare(b.displayLabel)),[page]);
  const selected=page?.data.find(s=>s.id===selectedId)??null;
  const timeZone=selectedCenter?.timeZone??"UTC";

  useEffect(()=>{let active=true;void boApi.scopeCatalog().then(scope=>{if(!active)return;const next=scope.centers.filter(c=>c.status==="active");setCenters(next);const first=next[0];if(first){setCenterId(first.id);const d=localDate(first.timeZone);setStartDate(d);setEndDate(d);}}).catch(error=>active&&setLoad({state:"error",message:message(error)}));return()=>{active=false};},[]);
  useEffect(()=>{if(!centerId||!selectedCenter)return;void refresh();/* eslint-disable-next-line react-hooks/exhaustive-deps */},[centerId,mode,startDate,endDate,status,staffId,selectedCenter?.timeZone]);

  async function refresh(cursor?:string){
    setLoad({state:"loading"});
    try{
      const params=mode==="today"?{centerId,workDate:today}:{centerId,startDate,endDate};
      const result=await boApi.timekeeping({...params,...(status?{status}:{}),...(staffId?{staffMemberId:staffId}:{}),limit:100,...(cursor?{cursor}:{})});
      setLoad({state:"ready",page:result});setSelectedId(current=>result.data.some(x=>x.id===current)?current:(result.data[0]?.id??""));
    }catch(error){setLoad({state:"error",message:message(error)});}
  }

  return <main className={styles.page}>
    <header className={styles.heading}><span>Back Office · Workforce</span><h1>Timekeeping</h1><p>Actual attendance từ canonical TimekeepingSession. Read-only trong F1.</p></header>
    <section className={styles.toolbar}>
      <div className={styles.tabs}><button className={mode==="today"?styles.activeTab:""} onClick={()=>setMode("today")}>Today</button><button className={mode==="history"?styles.activeTab:""} onClick={()=>setMode("history")}>History</button></div>
      <label>Center<select value={centerId} onChange={e=>{setCenterId(e.target.value);setStaffId("");}}>{centers.map(c=><option key={c.id} value={c.id}>{c.displayName}</option>)}</select></label>
      {mode==="history"?<><label>From<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label>To<input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label></>:<div className={styles.today}>{today}</div>}
      <label>Status<select value={status} onChange={e=>setStatus(e.target.value as typeof status)}><option value="">All</option><option>OPEN</option><option>CLOSED</option></select></label>
      <label>Staff<select value={staffId} onChange={e=>setStaffId(e.target.value)}><option value="">All</option>{staffOptions.map(s=><option key={s.id} value={s.id}>{s.displayLabel}</option>)}</select></label>
    </section>

    {page&&mode==="today"?<section className={styles.metrics}>
      <Metric label="Currently checked in" value={page.summary.openSessions}/><Metric label="Checked out today" value={page.summary.closedSessions}/><Metric label="No checkout yet" value={page.summary.openSessions}/><Metric label="Total sessions" value={page.summary.totalSessions}/>
    </section>:null}

    {load.state==="loading"?<State text="Đang tải TimekeepingSession từ Core…"/>:null}
    {load.state==="error"?<State text={load.message} error/>:null}
    {page?<div className={styles.workspace}>
      <section className={styles.listPanel}>
        <div className={styles.listHead}><div><strong>{mode==="today"?"Today":"History"}</strong><span>{page.summary.totalSessions} sessions</span></div><span>Recorded truth</span></div>
        <div className={styles.tableWrap}><table><thead><tr><th>Staff</th><th>Date</th><th>Check-in</th><th>Check-out</th><th>Duration</th><th>Assignment</th><th>Status</th></tr></thead><tbody>{page.data.map(row=><tr key={row.id} className={selectedId===row.id?styles.selectedRow:""} onClick={()=>setSelectedId(row.id)}><td><strong>{row.staff.displayLabel}</strong><small>{short(row.staff.id)}</small></td><td>{row.workDate}</td><td>{clock(row.checkInAt,timeZone)}</td><td>{row.checkOutAt?clock(row.checkOutAt,timeZone):"—"}</td><td>{duration(row.durationSeconds)}</td><td>{row.assignment?.shift?.displayLabel??(row.assignmentId?short(row.assignmentId):"Legacy")}</td><td><span className={row.status==="OPEN"?styles.openPill:styles.closedPill}>{row.status}</span></td></tr>)}</tbody></table></div>
        {page.nextCursor?<button className={styles.more} onClick={()=>void refresh(page.nextCursor!)}>Load next page</button>:null}
      </section>
      <aside className={styles.detail}>{selected?<Detail row={selected} timeZone={timeZone}/>:<div className={styles.empty}>Chọn một TimekeepingSession để xem chi tiết.</div>}</aside>
    </div>:null}
  </main>;
}

function Metric({label,value}:{label:string;value:number}){return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>}
function Detail({row,timeZone}:{row:BoTimekeepingSession;timeZone:string}){return <><div className={styles.detailHead}><div><span>TimekeepingSession</span><h2>{row.staff.displayLabel}</h2><code>{row.id}</code></div><span className={row.status==="OPEN"?styles.openPill:styles.closedPill}>{row.status}</span></div><section><h3>Recorded</h3><Fact label="Center" value={row.centerId}/><Fact label="workDate" value={row.workDate}/><Fact label="Check-in" value={datetime(row.checkInAt,timeZone)}/><Fact label="Check-out" value={row.checkOutAt?datetime(row.checkOutAt,timeZone):"Not recorded"}/><Fact label="Duration" value={duration(row.durationSeconds)}/></section><section><h3>Assignment linkage</h3><Fact label="assignmentId" value={row.assignmentId??"Historical legacy: none"}/>{row.assignment?<><Fact label="Shift" value={row.assignment.shift?`${row.assignment.shift.displayLabel} · ${row.assignment.shift.startLocalTime}–${row.assignment.shift.endLocalTime}`:row.assignment.shiftTemplateId}/><Fact label="Assignment status" value={row.assignment.status}/>{row.assignment.replacesAssignmentId?<Fact label="Replaces" value={row.assignment.replacesAssignmentId}/>:null}{row.assignment.cancelledAt?<Fact label="Cancelled at" value={datetime(row.assignment.cancelledAt,timeZone)}/>:null}</>:null}</section><section><h3>Provenance / anomalies</h3>{row.anomalyFlags.length?row.anomalyFlags.map(flag=><span key={flag} className={styles.anomaly}>{flag}</span>):<p className={styles.muted}>No current canonical anomaly flags.</p>}</section><section className={styles.timeline}><h3>Timeline</h3><div><i/><span>Recorded check-in · {datetime(row.checkInAt,timeZone)}</span></div>{row.checkOutAt?<div><i/><span>Recorded check-out · {datetime(row.checkOutAt,timeZone)}</span></div>:<div><i/><span>Session remains OPEN</span></div>}</section><p className={styles.readOnlyNote}>F1 has no edit controls. Original attendance history is not rewritten here.</p></>}
function Fact({label,value}:{label:string;value:string}){return <div className={styles.fact}><span>{label}</span><strong>{value}</strong></div>}
function State({text,error=false}:{text:string;error?:boolean}){return <div className={`${styles.state} ${error?styles.error:""}`}>{text}</div>}
function localDate(timeZone:string){return new Intl.DateTimeFormat("en-CA",{timeZone}).format(new Date())}
function clock(value:string,timeZone:string){return new Intl.DateTimeFormat("vi-VN",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone}).format(new Date(value))}
function datetime(value:string,timeZone:string){return new Intl.DateTimeFormat("vi-VN",{dateStyle:"medium",timeStyle:"short",timeZone}).format(new Date(value))}
function duration(value:number|null){if(value===null)return"—";const h=Math.floor(value/3600),m=Math.floor((value%3600)/60);return h?`${h}h ${String(m).padStart(2,"0")}m`:`${m}m`}
function short(value:string){return value.slice(0,8)}
function message(error:unknown){if(error instanceof BoApiError)return `${error.message}${error.requestId?` · ${error.requestId}`:""}`;return error instanceof Error?error.message:"Không tải được timekeeping."}
