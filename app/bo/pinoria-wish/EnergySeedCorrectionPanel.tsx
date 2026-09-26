"use client";
import {useEffect,useMemo,useState} from "react";
import bo from "../bo.module.css";
import styles from "./pinoria-wish.module.css";

type Learner={studentProfileId:string;displayName:string;status:string;energySeedBalance:number;latestAttendanceEarnAt:string;uncorrectedAttendanceEarns:number};
type EventRow={id:string;eventType:"LEDGER"|"FOUNDER_CORRECTION";delta:number;reason:string;referenceType:string;referenceId:string;balanceAfter:number;createdAt:string;correctionReason:string|null;correctionEventId:string|null;correctionEligible:boolean};
type History={studentProfileId:string;displayName:string;studentStatus:string;energySeedBalance:number;events:EventRow[]};
type Envelope<T>={data?:T;error?:{message?:string}};

async function request<T>(path:string,init?:RequestInit){
  const response=await fetch(`/api/founder/${path}`,{cache:"no-store",...init});
  const json=await response.json() as Envelope<T>;
  if(!response.ok||!json.data)throw new Error(json.error?.message??"Resource correction operation failed");
  return json.data;
}

export function EnergySeedCorrectionPanel(){
  const[learners,setLearners]=useState<Learner[]>([]),[selectedId,setSelectedId]=useState(""),[history,setHistory]=useState<History|null>(null);
  const[query,setQuery]=useState(""),[reason,setReason]=useState("Production Golden Journey cleanup"),[busy,setBusy]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState("");
  const filtered=useMemo(()=>learners.filter(row=>`${row.displayName} ${row.studentProfileId}`.toLowerCase().includes(query.toLowerCase())),[learners,query]);
  async function loadLearners(){
    const data=await request<{learners:Learner[]}>("pinoria/wish/resources/energy-seeds/learners");
    setLearners(data.learners);
    if(selectedId&&!data.learners.some(row=>row.studentProfileId===selectedId)){setSelectedId("");setHistory(null);}
  }
  async function openLearner(id:string){
    setSelectedId(id);setHistory(null);setError("");setMessage("");
    try{setHistory(await request<History>(`pinoria/wish/resources/energy-seeds/learners/${id}`));}
    catch(cause){setError(cause instanceof Error?cause.message:"Không tải được lịch sử Energy Seed");}
  }
  useEffect(()=>{void loadLearners().catch(cause=>setError(cause instanceof Error?cause.message:"Không tải được learner"));},[]);
  async function correct(event:EventRow){
    if(!history||!reason.trim()||!event.correctionEligible)return;
    if(!window.confirm(`Neutralize ${event.delta} Energy Seed từ Attendance ${event.referenceId.slice(0,8)}? Attendance history sẽ được giữ nguyên.`))return;
    setBusy(event.id);setError("");setMessage("");
    try{
      await request(`pinoria/wish/resources/energy-seeds/learners/${history.studentProfileId}/corrections`,{
        method:"POST",
        headers:{"content-type":"application/json","idempotency-key":`jcs06-energy-seed:${event.id}`},
        body:JSON.stringify({earnLedgerId:event.id,correctionReason:reason.trim()}),
      });
      setMessage("Correction đã commit. Earn và correcting event đều được giữ trong history.");
      await Promise.all([openLearner(history.studentProfileId),loadLearners()]);
    }catch(cause){setError(cause instanceof Error?cause.message:"Correction thất bại");}
    finally{setBusy("");}
  }
  return <section className={bo.panel} data-jcs06-resource-correction>
    <div className={bo.panelHeading}>
      <div><h2>Golden Journey · Energy Seed correction</h2><p>Founder-only, append-only correction. Attendance và original earn không bị rewrite.</p></div>
      <button className={bo.secondaryButton} onClick={()=>void loadLearners()}>Refresh</button>
    </div>
    {error?<div className={`${bo.card} ${bo.denied}`}><strong>Lỗi</strong><span>{error}</span></div>:null}
    {message?<div className={bo.successCard}><span>JCS-06</span><strong>{message}</strong></div>:null}
    <div className={styles.resourceGrid}>
      <div className={styles.resourceLearners}>
        <label className={bo.field}>Tìm learner<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Tên hoặc Student Profile ID"/></label>
        <div className={styles.resourceList}>
          {filtered.length===0?<div className={bo.empty}>Không có Attendance earn cần hiển thị.</div>:filtered.map(row=><button key={row.studentProfileId} className={`${styles.resourceLearner}${selectedId===row.studentProfileId?` ${styles.resourceLearnerActive}`:""}`} onClick={()=>void openLearner(row.studentProfileId)}>
            <span><b>{row.displayName}</b><small>{row.studentProfileId.slice(0,8)} · {row.status}</small></span>
            <span><strong>{row.energySeedBalance} Seed</strong><small>{row.uncorrectedAttendanceEarns} earn chưa correction</small></span>
          </button>)}
        </div>
      </div>
      <div className={styles.resourceDetail}>
        {!history?<div className={bo.empty}>Chọn learner để inspect audited resource history.</div>:<>
          <div className={styles.resourceSummary}><div><span>Learner</span><strong>{history.displayName}</strong></div><div><span>Energy Seed</span><strong>{history.energySeedBalance}</strong></div><div><span>Events</span><strong>{history.events.length}</strong></div></div>
          <label className={bo.field}>Correction reason<textarea value={reason} onChange={event=>setReason(event.target.value)} maxLength={500}/></label>
          <div className={styles.resourceEvents}>
            {history.events.map(event=><article key={`${event.eventType}:${event.id}`} className={styles.resourceEvent}>
              <div><span className={bo.statusPill}>{event.eventType==="FOUNDER_CORRECTION"?"CORRECTION":event.reason}</span><strong>{event.delta>0?"+":""}{event.delta} Seed</strong><small>{new Date(event.createdAt).toLocaleString("vi-VN")} · balance {event.balanceAfter}</small></div>
              <div><small>{event.referenceType} · {event.referenceId}</small>{event.correctionReason?<p>{event.correctionReason}</p>:null}</div>
              {event.correctionEligible?<button className={bo.primaryButton} disabled={!!busy||!reason.trim()||history.energySeedBalance<event.delta} onClick={()=>void correct(event)}>{busy===event.id?"Đang correction…":"Neutralize earn"}</button>:event.correctionEventId?<span className={styles.correctedLabel}>Corrected · {event.correctionEventId.slice(0,8)}</span>:null}
            </article>)}
          </div>
        </>}
      </div>
    </div>
  </section>;
}
