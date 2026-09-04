"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoStudentPinoriaSummary, BoCompanionFeedUnavailableReason } from "@/lib/bo-model";
import styles from "./bo-learners.module.css";

type Load = { state:"loading" } | { state:"error"; message:string } | { state:"ready"; data:BoStudentPinoriaSummary };
type Companion = BoStudentPinoriaSummary["companions"][number];

export function StudentPinoriaPanel({ studentId }: { studentId:string }) {
  const [load,setLoad]=useState<Load>({state:"loading"});
  const [confirming,setConfirming]=useState<Companion|null>(null);
  const [busy,setBusy]=useState<string|null>(null);
  const [notice,setNotice]=useState("");
  const retryKeys=useRef(new Map<string,string>());

  const refresh=useCallback(async (active:()=>boolean=()=>true)=>{
    try { const data=await boApi.learnerPinoria(studentId); if(active())setLoad({state:"ready",data}); }
    catch(error){if(active())setLoad({state:"error",message:message(error)});}
  },[studentId]);
  useEffect(()=>{
    let active=true; setLoad({state:"loading"});setConfirming(null);setNotice("");
    void refresh(()=>active); return()=>{active=false;};
  },[refresh]);

  async function feed(companion:Companion){
    const target=`feed:${studentId}:${companion.companionId}`,key=retryKeys.current.get(target)??crypto.randomUUID();
    retryKeys.current.set(target,key);setBusy(companion.companionId);setNotice("");
    try{
      const result=await boApi.feedLearnerCompanion(studentId,companion.companionId,key);
      retryKeys.current.delete(target);setConfirming(null);
      setNotice(`${companion.species.displayName} đã nhận 1 Trái · ${result.stageFeedCount} lần nuôi ở cấp này.`);
      await refresh();
    }catch(error){setNotice(message(error));}
    finally{setBusy(null);}
  }

  return <section className={styles.sectionCard}>
    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Pinoria · canonical</span><h3>Hộ linh</h3></div><span className={styles.operatorBadge}>F4a · routine</span></div>
    {notice?<div className={styles.pinoriaNotice}>{notice}</div>:null}
    {load.state==="loading"?<div className={styles.emptyInline}>Đang tải Pinoria…</div>:null}
    {load.state==="error"?<div className={styles.emptyInline}>Không tải được Pinoria · {load.message}</div>:null}
    {load.state==="ready"?<PinoriaSummary data={load.data} busy={busy} onFeed={setConfirming}/>:null}
    {confirming&&load.state==="ready"?<FeedSheet companion={confirming} data={load.data} busy={busy===confirming.companionId} onClose={()=>{if(!busy)setConfirming(null);}} onConfirm={()=>void feed(confirming)}/>:null}
  </section>;
}

function PinoriaSummary({data,busy,onFeed}:{data:BoStudentPinoriaSummary;busy:string|null;onFeed:(companion:Companion)=>void}){
  return <>
    <div className={styles.pinoriaFacts}>
      <div><span>Trái Pinoria</span><strong>{data.fruitBalance}</strong><small>learner wallet</small></div>
      <div><span>Thủy Ấn</span><strong>{data.waterSigil?"Đã có":"Chưa có"}</strong><small>{data.waterSigil?shortDate(data.waterSigil.awardedAt):"competency credential"}</small></div>
      <div><span>Visit</span><strong>{data.operationContext.visitState==="OPEN"?"Đang check-in":data.operationContext.visitState==="AMBIGUOUS"?"Cần xử lý":"Chưa check-in"}</strong><small>{data.operationContext.openVisit?`từ ${shortTime(data.operationContext.openVisit.checkedInAt)}`:"Feed cần OPEN Visit"}</small></div>
    </div>
    {data.companions.length?<div className={styles.companionList}>{data.companions.map(companion=><CompanionCard key={companion.companionId} companion={companion} busy={busy===companion.companionId} onFeed={()=>onFeed(companion)}/>)}</div>:<div className={styles.emptyInline}>Học viên chưa có Hộ linh active.</div>}
    <p className={styles.pinoriaBoundary}>Feed đi qua canonical Pinoria command, permission, OPEN Visit, idempotency và audit. Fruit/Sigil correction chưa được mở ở BO.</p>
  </>;
}

function CompanionCard({companion,busy,onFeed}:{companion:Companion;busy:boolean;onFeed:()=>void}){
  const target=companion.materializationLevel===1?2:companion.materializationLevel===2?5:null;
  const ready=companion.state==="READY_FOR_RITUAL",progress=target?Math.min(100,Math.round(companion.stageFeedCount/target*100)):0;
  return <article className={styles.companionCard}>
    <div className={styles.companionHead}><span className={styles.companionGlyph}>✦</span><div><strong>{companion.species.displayName}</strong><span>Cấp {companion.materializationLevel} · {ready?"Sẵn sàng Nghi thức":"Đang trưởng thành"}</span></div><b>{ready?"READY":`${companion.stageFeedCount}/${target??"—"}`}</b></div>
    <div className={styles.progressTrack}><span style={{width:`${progress}%`}} /></div>
    <div className={styles.companionMeta}><span>{readinessLabel(companion.readinessRuleKey)}</span><small>Nhận {shortDate(companion.acquiredAt)}</small></div>
    <div className={styles.companionActions}>
      <button type="button" className={styles.primaryButton} disabled={!companion.actions.feed.available||busy} onClick={onFeed}>{busy?"Đang xử lý…":"Cho ăn 1 Trái"}</button>
      {!companion.actions.feed.available?<small>{feedReason(companion.actions.feed.reason)}</small>:<small>Tiêu 1 Trái Pinoria · có audit</small>}
    </div>
  </article>;
}

function FeedSheet({companion,data,busy,onClose,onConfirm}:{companion:Companion;data:BoStudentPinoriaSummary;busy:boolean;onClose:()=>void;onConfirm:()=>void}){
  return <div className={styles.sheetScrim} role="presentation" onMouseDown={event=>{if(event.currentTarget===event.target)onClose();}}><div className={`${styles.sheet} ${styles.pinoriaSheet}`} role="dialog" aria-modal="true" aria-label="Xác nhận cho Hộ linh ăn">
    <header><div><span className={styles.eyebrow}>F4a · Companion routine action</span><h3>Cho {companion.species.displayName} ăn?</h3><p>Command chỉ chạy khi learner vẫn có OPEN Visit và canonical state còn hợp lệ.</p></div><button type="button" onClick={onClose} disabled={busy}>×</button></header>
    <div className={styles.pinoriaCommandPreview}>
      <div><span>Trái Pinoria</span><strong>{data.fruitBalance} → {Math.max(0,data.fruitBalance-1)}</strong></div>
      <div><span>Lần nuôi cấp này</span><strong>{companion.stageFeedCount} → {companion.stageFeedCount+1}</strong></div>
      <div><span>Visit</span><strong>{data.operationContext.openVisit?"OPEN":"—"}</strong></div>
    </div>
    <div className={styles.sheetNote}><strong>Canonical command</strong><span>Core sẽ kiểm tra lại ownership, balance, progression và Visit ngay lúc confirm; UI preview không phải authority.</span></div>
    <footer><button type="button" className={styles.secondaryButton} disabled={busy} onClick={onClose}>Huỷ</button><button type="button" className={styles.primaryButton} disabled={busy} onClick={onConfirm}>{busy?"Đang ghi nhận…":"Xác nhận cho ăn"}</button></footer>
  </div></div>;
}

function feedReason(reason:BoCompanionFeedUnavailableReason){
  if(reason==="NO_OPEN_VISIT")return "Chỉ cho ăn khi học viên đang check-in.";
  if(reason==="MULTIPLE_OPEN_VISITS")return "Có nhiều OPEN Visit — xử lý attendance trước.";
  if(reason==="NO_FRUIT")return "Không đủ Trái Pinoria.";
  if(reason==="RITUAL_READY")return "Đã đủ lần nuôi — chờ Nghi thức.";
  if(reason==="FEED_LIMIT_REACHED")return "Đã đạt giới hạn nuôi của cấp này.";
  if(reason==="LEVEL_UNDEFINED")return "Cấp tiếp theo chưa có rule canonical.";
  if(reason==="NOT_AUTHORIZED")return "Tài khoản hiện tại không có quyền cho Hộ linh ăn.";
  return "Action hiện không khả dụng.";
}
function readinessLabel(key:string|null){if(key==="FEED_2")return "Mốc 2 lần nuôi";if(key==="FEED_5_AND_WATER_SIGIL")return "Mốc 5 lần nuôi + Thủy Ấn";return "Mốc kế tiếp chưa định nghĩa";}
function shortDate(value:string){return new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"medium"}).format(new Date(value));}
function shortTime(value:string){return new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
function message(error:unknown){return error instanceof Error?error.message:"Không thực hiện được action Pinoria";}
