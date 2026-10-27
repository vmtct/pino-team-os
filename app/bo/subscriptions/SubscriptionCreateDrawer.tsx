"use client";
import { useEffect, useRef, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoLearnerDirectoryItem, BoLearnerLifecycle, BoPathProgram, BoRunningClass } from "@/lib/bo-model";
import { useBoDialog } from "@/app/bo/components/registration/useBoDialog";
import { BillingWorkspace, type BillingReplayState } from "./BillingWorkspace";
import styles from "./subscription-create-drawer.module.css";

type Props = {
  initialStudentId?: string | null;
  paths: BoPathProgram[];
  classes: BoRunningClass[];
  replayState: BillingReplayState;
  setReplayState: React.Dispatch<React.SetStateAction<BillingReplayState>>;
  onChanged: () => void;
  onClose: () => void;
};
type LifecycleLoad={status:"idle"|"loading"}|{status:"ready";value:BoLearnerLifecycle}|{status:"error";message:string};
export function SubscriptionCreateDrawer({initialStudentId,paths,classes,replayState,setReplayState,onChanged,onClose}:Props) {
  const panel=useRef<HTMLElement>(null);
  const busy=Boolean(replayState.busy||replayState.pending);
  const safeClose=()=>{if(!busy)onClose();};
  useBoDialog(true,safeClose,panel);
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState<BoLearnerDirectoryItem|null>(null);
  const [results,setResults]=useState<BoLearnerDirectoryItem[]>([]);
  const [searchState,setSearchState]=useState<"idle"|"loading"|"ready"|"error">("idle");
  const [activeResult,setActiveResult]=useState(0);
  const [life,setLife]=useState<LifecycleLoad>(initialStudentId?{status:"loading"}:{status:"idle"});
  const requested=useRef(0);
  // Prefill when invoked from Student detail, but never infer a Student identity from the query string.
  useEffect(()=>{
    if(!initialStudentId)return;
    let active=true;
    void boApi.learnerLifecycle(initialStudentId).then(value=>{
      if(!active)return;
      setSelected(value.student);setQuery(value.student.displayName);setLife({status:"ready",value});
    }).catch(e=>{if(active)setLife({status:"error",message:e instanceof Error?e.message:"Không thể đọc học viên."})});
    return ()=>{active=false};
  },[initialStudentId]);
  useEffect(()=>{
    if(selected||query.trim().length<2)return;
    const seq=++requested.current;
    let active=true;
    const timer=setTimeout(()=>{
      setSearchState("loading");
      void boApi.learners(query.trim(),20).then(rows=>{
        if(active&&seq===requested.current){setResults(rows.filter(x=>x.status==="ACTIVE"));setSearchState("ready");setActiveResult(0);}
      }).catch(()=>{if(active&&seq===requested.current)setSearchState("error");});
    },220);
    return ()=>{active=false;clearTimeout(timer);};
  },[query,selected]);
  async function choose(row:BoLearnerDirectoryItem){
    if(busy)return;
    setSelected(row);setQuery(row.displayName);setResults([]);setLife({status:"loading"});
    try{
      const value=await boApi.learnerLifecycle(row.id);
      setLife({status:"ready",value});
    }catch(e){setLife({status:"error",message:e instanceof Error?e.message:"Không thể tải hồ sơ."});}
  }
  const options=selected?[]:results;
  return <><div className="drawer-scrim visible" aria-hidden="true" onClick={safeClose} />
    <aside ref={panel} id="subscription-create-drawer" className="drawer open" role="dialog" aria-modal="true" aria-labelledby="subscription-create-title">
      <div className="drawer-top">
        <div className="drawer-header-copy"><span className="drawer-path">Subscriptions · Đăng ký</span><h2 className="drawer-record-title" id="subscription-create-title">Tạo Subscription</h2></div>
        <button className="drawer-close" type="button" onClick={safeClose} disabled={busy} aria-label="Đóng">×</button>
      </div>
      <div className="drawer-content">
        <section className="property-section">
          <h3>Học viên</h3>
          <div className="property-row">
            <label htmlFor="subscription-create-student-search" className="property-label"><small>♙</small><span>Học viên</span></label>
            <div className={styles.picker}>
              <div className={styles.searchLine}>
                <input id="subscription-create-student-search" className="edit-input" role="combobox" aria-autocomplete="list" aria-controls="subscription-create-search-results" aria-expanded={options.length>0}
                  placeholder="Tìm tên hoặc mã học viên…" value={query} disabled={busy} autoComplete="off"
                  onChange={e=>{setQuery(e.target.value);setSelected(null);setResults([]);setSearchState("idle");setLife({status:"idle"});}}
                  onKeyDown={e=>{
                    if(e.key==="ArrowDown"&&options.length){e.preventDefault();setActiveResult(i=>(i+1)%options.length);}
                    if(e.key==="ArrowUp"&&options.length){e.preventDefault();setActiveResult(i=>(i+options.length-1)%options.length);}
                    if(e.key==="Enter"&&options.length){e.preventDefault();void choose(options[activeResult]);}
                    if(e.key==="Escape"&&!busy&&options.length){setResults([]);e.stopPropagation();}
                  }} />
                {selected&&!busy?<button type="button" className={styles.clear} aria-label="Đổi học viên" onClick={()=>{setSelected(null);setQuery("");setLife({status:"idle"});}}>×</button>:null}
              </div>
              {!selected&&query.trim().length>=2?<div id="subscription-create-search-results" className={styles.results} role="listbox" aria-label="Kết quả tìm học viên">
                {options.map((row,index)=><button key={row.id} type="button" role="option" aria-selected={index===activeResult} className={index===activeResult?styles.activeResult:styles.result} onClick={()=>void choose(row)}>
                  <strong>{row.displayName}</strong><small>{row.id}</small></button>)}
                {searchState==="loading"?<span className={styles.empty}>Đang tìm học viên…</span>:searchState==="ready"&&!options.length?<span className={styles.empty}>Không tìm thấy học viên.</span>:searchState==="error"?<span className={styles.empty} role="alert">Không tải được kết quả. Thử nhập lại.</span>:null}
              </div>:null}
            </div>
          </div>
        </section>
        {life.status==="loading"?<p className={styles.empty} role="status">Đang tải Parent và Subscription của học viên…</p>:null}
        {life.status==="error"?<p className={styles.error} role="alert">{life.message}</p>:null}
        {life.status==="ready"?<BillingWorkspace key={life.value.student.id} lifecycle={life.value} paths={paths} classes={classes} createOnly
          replayState={replayState} setReplayState={setReplayState}
          onChanged={async()=>{
            onChanged();
            try{const latest=await boApi.learnerLifecycle(life.value.student.id);setLife({status:"ready",value:latest});}catch{/* preserve verified sale and show local result */}
          }} />:null}
      </div>
      <div className="drawer-footer"><div className="lab-bottom">
        <button type="button" className="secondary-btn" disabled={busy} onClick={safeClose}>Đóng</button>
        <span className={styles.footerHint}>Sale/Bill do Core xác nhận; không tạo Payment.</span>
      </div></div>
    </aside></>;
}
