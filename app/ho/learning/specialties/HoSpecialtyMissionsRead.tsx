"use client";
import styles from "./HoSpecialtyMissionsRead.module.css";
import { useEffect, useState } from "react";
import { BoApiError } from "@/lib/bo-api-error";
import { loadSpecialtyS4Read, type SpecialtyS4Read } from "@/lib/ho-specialty-s4-read";

/** Scoped S4 business interior: uses shared TDD Full Detail host; no S5 writers. */
export function SpecialtyMissionsReadContent({data}:{data:SpecialtyS4Read}){
  return <section aria-label="Nhiệm vụ liên kết" className="detail-panel"><div className={styles.stack}>
    <h3 className="pds-property-heading">Nhiệm vụ liên kết · {data.distinctMissionCount}</h3>
    {!data.levels.length?<p role="status">Chuyên đề chưa có Cấp.</p>:
      data.levels.map(level=><section key={level.id} className={styles.list} aria-label={"Nhiệm vụ "+level.name}>
        <h4>{level.name} <span className="chip">{level.missions.length}</span></h4>
        {level.missions.length?<div role="list" className={styles.list} aria-label={"Danh sách nhiệm vụ "+level.name}>
          {level.missions.map(mission=><div role="listitem" className={styles.row} key={mission.id}>
            {mission.name&&mission.code?
              <><div className={styles.identity}><strong>{mission.code}</strong><span>{mission.name}</span></div>
                <span>{mission.status==="ACTIVE"?"Đang áp dụng":"Không áp dụng"}</span></>:
              <span role="status">Không thể xác minh thông tin Nhiệm vụ liên kết.</span>}
          </div>)}
        </div>:<p className="pds-state">Chưa liên kết nhiệm vụ.</p>}
      </section>)}
  </div></section>;
}
export function HoSpecialtyMissionsRead({specialtyId}:{specialtyId:string}){
  const [attempt,setAttempt]=useState(0);
  const [state,setState]=useState<{attempt:number;data?:SpecialtyS4Read;error?:unknown}|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    void loadSpecialtyS4Read(specialtyId,window.fetch.bind(window),controller.signal)
      .then(data=>{if(!controller.signal.aborted)setState({attempt,data});})
      .catch(error=>{if(!controller.signal.aborted)setState({attempt,error});});
    return ()=>controller.abort();
  },[specialtyId,attempt]);
  if(!state||state.attempt!==attempt)return <p role="status">Đang tải Nhiệm vụ liên kết từ Core…</p>;
  if(state.error)return <section role="alert">
    <p>{state.error instanceof BoApiError&&[401,403].includes(state.error.status)
      ?"Không có quyền xem Nhiệm vụ liên kết.":
      "Không thể xác minh Nhiệm vụ liên kết từ Core."}</p>
    <button type="button" className="secondary-btn" onClick={()=>setAttempt(n=>n+1)}>Thử lại</button>
  </section>;
  return state.data?<SpecialtyMissionsReadContent data={state.data}/>:null;
}
