"use client";

import type { PinoriaReadinessState } from "@/lib/pinoria-readiness-api";
import styles from "./progress-cards.module.css";

type Props={
  name:string;
  assetKey:string;
  sigilAssetKey:string|null;
  progress:{materializationLevel:number;state:"GROWING"|"READY_FOR_RITUAL";stageFeedCount:number;readinessRuleKey:"FEED_2"|"FEED_5_AND_WATER_SIGIL"|null;version:number}|null;
  readiness:PinoriaReadinessState|null;
};
function target(level:number){
  if(level===1)return{feeds:2,sigil:false,label:"2 lần nuôi"};
  if(level===2)return{feeds:5,sigil:true,label:"5 lần nuôi + Thủy Ấn"};
  return{feeds:0,sigil:false,label:"Đã đạt cấp hiện hỗ trợ"};
}
export function CompanionProgressCard({name,progress,readiness}:Props){
  const level=progress?.materializationLevel??1;
  const goal=target(level);
  const feedCount=progress?.stageFeedCount??0;
  const feedPct=goal.feeds?`${Math.min(100,(feedCount/goal.feeds)*100)}%`:"100%";
  const ready=progress?.state==="READY_FOR_RITUAL";
  return <div className={styles.companionCard}>
    <div className={styles.heroRow}>
      <div><span className={styles.kicker}>COMPANION</span><strong>{name} · Lv{level}</strong><small>{ready?"Sẵn sàng Nghi thức":"Đang trưởng thành"}</small></div>
      <b className={ready?styles.ready:styles.growing}>{ready?"RITUAL READY":"GROWING"}</b>
    </div>
    <div className={styles.companionStats}>
      <span>🍎 <b>{readiness?.fruitBalance??0}</b> Quả</span>
      <span>💧 <b>{readiness?.waterSigil?"Có":"Chưa có"}</b> Thủy Ấn</span>
      <span>✦ <b>{feedCount}/{goal.feeds||"—"}</b> lần nuôi</span>
    </div>
    <div className={styles.companionGoal}>
      <div><span>Tiến độ cấp kế</span><b>{goal.label}</b></div>
      <div className={styles.track}><i style={{width:feedPct}} /></div>
      {goal.sigil?<small>{readiness?.waterSigil?"Thủy Ấn đã đạt ✓":"Còn thiếu Thủy Ấn"}</small>:<small>{ready?"Đủ điều kiện tiến hóa":"Nuôi Mori bằng Quả nhận từ evidence học tập"}</small>}
    </div>
    <div className={styles.levelPath} aria-label="Companion materialization path">
      {[1,2,3].map(item=><span key={item} className={item<=level?styles.levelOn:""}>Lv{item}</span>)}
    </div>
  </div>;
}
