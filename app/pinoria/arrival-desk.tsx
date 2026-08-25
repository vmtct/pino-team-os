"use client";

import {useCallback,useEffect,useMemo,useState}from"react";
import {TosShell}from"@/app/components/tos-shell/TosShell";
import styles from"./pinoria.module.css";

type Visit={id:string;checkedInAt:string;version:number};
type Learner={studentProfileId:string;displayName:string;sessionIds:string[];hasRosterConflict:boolean;openVisit:Visit|null};
type Session={id:string;scheduledStartsLocal:string;scheduledEndsLocal:string;unresolvedRegistrations:Array<{registrationId:string}>};
type ArrivalProjection={centerId:string;localDate:string;sessions:Session[];learners:Learner[]};
type ApiEnvelope<T>={data?:T;error?:{message?:string;code?:string}};

const CENTER_STORAGE="pino.arrival.centerId";
const footer=[{id:"home",label:"Home",href:"/dashboard"},{id:"pinoria",label:"Pinoria",href:"/pinoria"}];

function todayInVietnam(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}

export function ArrivalDesk(){
  const[centerId,setCenterId]=useState("");
  const[draftCenterId,setDraftCenterId]=useState("");
  const[date,setDate]=useState(todayInVietnam);
  const[data,setData]=useState<ArrivalProjection|null>(null);
  const[loading,setLoading]=useState(false);
  const[actionId,setActionId]=useState<string|null>(null);
  const[error,setError]=useState<string|null>(null);

  useEffect(()=>{const query=new URLSearchParams(window.location.search).get("centerId")?.trim()??"";const saved=window.localStorage.getItem(CENTER_STORAGE)?.trim()??"";const value=query||saved;if(value){setCenterId(value);setDraftCenterId(value);if(query)window.localStorage.setItem(CENTER_STORAGE,query);}},[]);

  const load=useCallback(async()=>{
    if(!centerId)return;
    setLoading(true);setError(null);
    try{
      const response=await fetch(`/api/tos-learning/arrival-desk?centerId=${encodeURIComponent(centerId)}&localDate=${encodeURIComponent(date)}`,{cache:"no-store"});
      const json=await response.json() as ApiEnvelope<ArrivalProjection>;
      if(!response.ok||!json.data)throw new Error(json.error?.message??"Không tải được Arrival Desk");
      setData(json.data);
    }catch(cause){setError(cause instanceof Error?cause.message:"Không tải được Arrival Desk");}
    finally{setLoading(false);}
  },[centerId,date]);

  useEffect(()=>{void load();},[load]);

  const sessionMap=useMemo(()=>new Map((data?.sessions??[]).map(session=>[session.id,session])),[data]);
  const unresolved=useMemo(()=>(data?.sessions??[]).reduce((sum,session)=>sum+session.unresolvedRegistrations.length,0),[data]);

  function saveCenter(){const value=draftCenterId.trim();if(!value)return;window.localStorage.setItem(CENTER_STORAGE,value);setCenterId(value);}

  async function mutate(learner:Learner){
    if(!centerId||actionId)return;
    setActionId(learner.studentProfileId);setError(null);
    try{
      const checkedIn=!learner.openVisit;
      const url=checkedIn?`/api/tos-learning/students/${learner.studentProfileId}/visits/open`:`/api/tos-learning/visits/${learner.openVisit!.id}/check-out`;
      const body=checkedIn?{centerId,checkedInAt:new Date().toISOString(),reason:"PINO Arrival Desk"}:{checkedOutAt:new Date().toISOString(),reason:"Rời PINO House",expectedVersion:learner.openVisit!.version};
      const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
      const json=await response.json() as ApiEnvelope<unknown>;
      if(!response.ok)throw new Error(json.error?.message??(checkedIn?"Check-in thất bại":"Check-out thất bại"));
      await load();
    }catch(cause){setError(cause instanceof Error?cause.message:"Thao tác thất bại");}
    finally{setActionId(null);}
  }

  return <TosShell title="Arrival Desk" subtitle="Check-in · Check-out học viên tại PINO House" theme="pinoria" footerItems={footer} activeFooterId="pinoria">
    <div className={styles.page}>
      {!centerId?<section className={styles.setup}>
        <span className={styles.eyebrow}>ONE-TIME SETUP</span>
        <h2>Kết nối quầy lễ tân</h2>
        <p>Dán Center ID canonical một lần trên thiết bị này. PINO sẽ ghi nhớ cho các lần sau.</p>
        <input value={draftCenterId} onChange={event=>setDraftCenterId(event.target.value)} placeholder="Center ID" autoCapitalize="off" autoCorrect="off"/>
        <button onClick={saveCenter} disabled={!draftCenterId.trim()}>Kết nối</button>
      </section>:<>
        <section className={styles.toolbar}>
          <div><span className={styles.eyebrow}>LIVE HOUSE</span><strong>{data?.learners.filter(item=>item.openVisit).length??0} đang ở PINO</strong></div>
          <label>Ngày<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label>
          <button className={styles.refresh} onClick={()=>void load()} disabled={loading}>{loading?"Đang tải…":"Làm mới"}</button>
        </section>

        {error?<div className={styles.error}>{error}</div>:null}
        {unresolved>0?<div className={styles.notice}><strong>{unresolved} hồ sơ mới</strong><span>cần resolve learner trước khi dùng Arrival Desk.</span></div>:null}

        <section className={styles.list} aria-busy={loading}>
          {!loading&&data?.learners.length===0?<div className={styles.empty}><strong>Chưa có học viên dự kiến</strong><span>Roster của ngày {date} hiện đang trống.</span></div>:null}
          {data?.learners.map(learner=>{
            const times=learner.sessionIds.map(id=>sessionMap.get(id)).filter(Boolean).map(session=>session!.scheduledStartsLocal.slice(11,16));
            const present=!!learner.openVisit;
            return <article key={learner.studentProfileId} className={`${styles.card} ${present?styles.present:""}`}>
              <div className={styles.avatar}>{learner.displayName.trim().charAt(0).toLocaleUpperCase("vi")}</div>
              <div className={styles.identity}>
                <div className={styles.nameRow}><h3>{learner.displayName}</h3><span className={present?styles.inBadge:styles.waitBadge}>{present?"Đã đến":"Chưa đến"}</span></div>
                <div className={styles.meta}>{times.length?`Ca ${[...new Set(times)].join(" · ")}`:"Có lịch hôm nay"}{learner.hasRosterConflict?<span className={styles.conflict}> · Cần kiểm tra roster</span>:null}</div>
                {present&&learner.openVisit?<small>Check-in {new Date(learner.openVisit.checkedInAt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Ho_Chi_Minh"})}</small>:null}
              </div>
              <button className={present?styles.checkout:styles.checkin} disabled={actionId===learner.studentProfileId} onClick={()=>void mutate(learner)}>{actionId===learner.studentProfileId?"…":present?"Check-out":"Check-in"}</button>
            </article>;
          })}
        </section>

        <button className={styles.changeCenter} onClick={()=>{setCenterId("");setData(null);}}>Đổi Center</button>
      </>}
    </div>
  </TosShell>;
}
