"use client";

import { useEffect, useState } from "react";
import styles from "./progress-cards.module.css";

type Pull = {
  pullIndex: number;
  rarity: "COMMON" | "RARE" | "MYTHIC";
  source: string;
  featured: boolean;
  perfectMemory: boolean;
  resonanceBefore: number;
  resonanceAfter: number;
  setProgressBefore: number;
  setProgressAfter: number;
};
type HistoryEntry = {
  drawId: string;
  bannerId: string;
  bannerName: string;
  bearerName: string;
  pullCount: number;
  seedSpent: number;
  createdAt: string;
  pulls: Pull[];
};
type Props = {
  centerId: string;
  studentProfileId: string;
  banner: { id:string; displayName:string; storyHook?:string; bearer:{displayName:string}; signatureSet:{displayName:string}; guarantees:{mythicWithin:number;mythicSoftPityStartsAt:number;rareWithin:number;featuredMythicRate:number}; rulesVersion:string };
  energySeedBalance: number;
  pity: { nextMythicPityPosition:number; mythicSoftPityStartsAt:number; mythicGuaranteedWithin:number; nextRarePityPosition:number; rareGuaranteedWithin:number; featuredGuarantee:boolean };
  resonanceLevel: number;
  setProgress: { owned:number; total:number };
};
type Envelope<T> = { data?:T; error?:{message?:string} };

function pct(position:number, hard:number) {
  return `${Math.min(100, Math.max(0, ((position - 1) / Math.max(1, hard)) * 100))}%`;
}
function rarityLabel(value:Pull["rarity"]) {
  return value === "MYTHIC" ? "Mythic" : value === "RARE" ? "Rare" : "Common";
}
function resonanceLabel(level:number) { return level < 0 ? "Chưa cộng hưởng" : `C${level}`; }

export function WishProgressCard(props:Props) {
  const [history,setHistory]=useState<HistoryEntry[]>([]);
  const [historyError,setHistoryError]=useState("");
  useEffect(()=>{
    let active=true;
    const params=new URLSearchParams({centerId:props.centerId,studentProfileId:props.studentProfileId,limit:"8"});
    void fetch(`/api/tos-learning/pinoria/wish/history?${params}`,{cache:"no-store"})
      .then(async response=>({response,body:await response.json() as Envelope<HistoryEntry[]>}))
      .then(({response,body})=>{
        if(!response.ok||!body.data)throw new Error(body.error?.message??"Không tải được lịch sử Wish");
        if(active){setHistory(body.data);setHistoryError("");}
      })
      .catch(cause=>{if(active)setHistoryError(cause instanceof Error?cause.message:"Không tải được lịch sử Wish");});
    return()=>{active=false};
  },[props.centerId,props.studentProfileId,props.energySeedBalance,props.resonanceLevel,props.setProgress.owned]);

  const resonance=Math.max(-1,Math.min(6,props.resonanceLevel));
  const recent=history.filter(item=>item.bannerId===props.banner.id).slice(0,4);
  return <div className={styles.wishCard}>
    <div className={styles.heroRow}>
      <div><span className={styles.kicker}>WISH BANNER</span><strong>{props.banner.displayName}</strong><small>{props.banner.bearer.displayName} · {props.banner.signatureSet.displayName}</small></div>
      <b className={styles.seed}>✦ {props.energySeedBalance}</b>
    </div>
    <div className={styles.meters}>
      <div className={styles.meterBlock}>
        <div><span>Mythic pity</span><b>P{props.pity.nextMythicPityPosition}/{props.pity.mythicGuaranteedWithin}</b></div>
        <div className={styles.track}><i style={{width:pct(props.pity.nextMythicPityPosition,props.pity.mythicGuaranteedWithin)}} /></div>
        <small>Soft pity từ P{props.pity.mythicSoftPityStartsAt}</small>
      </div>
      <div className={styles.meterBlock}>
        <div><span>Rare pity</span><b>P{props.pity.nextRarePityPosition}/{props.pity.rareGuaranteedWithin}</b></div>
        <div className={styles.track}><i style={{width:pct(props.pity.nextRarePityPosition,props.pity.rareGuaranteedWithin)}} /></div>
        <small>{props.pity.featuredGuarantee?"Featured kế tiếp ✓":`Featured ${(props.banner.guarantees.featuredMythicRate*100).toFixed(0)}%`}</small>
      </div>
    </div>
    <div className={styles.collectionRow}>
      <div className={styles.resonance}><span>Resonance</span><div>{Array.from({length:7},(_,index)=><b key={index} className={resonance>=index?styles.on:""}>C{index}</b>)}</div></div>
      <div className={styles.setProgress}><span>Signature set</span><div>{Array.from({length:props.setProgress.total},(_,index)=><i key={index} className={index<props.setProgress.owned?styles.owned:""} />)}</div><b>{props.setProgress.owned}/{props.setProgress.total}</b></div>
    </div>
    <div className={styles.history}>
      <div className={styles.historyHead}><span>Wish history</span><small>{resonanceLabel(props.resonanceLevel)} · {props.banner.rulesVersion}</small></div>
      {historyError?<small className={styles.historyError}>{historyError}</small>:recent.length?recent.map(entry=><div className={styles.draw} key={entry.drawId}>
        <time>{new Date(entry.createdAt).toLocaleString("vi-VN",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</time>
        <div>{entry.pulls.map((pull,index)=><span key={`${entry.drawId}:${pull.pullIndex}`} className={styles[pull.rarity.toLowerCase()]}>{rarityLabel(pull.rarity)}{pull.featured?" · Featured":""}{pull.perfectMemory?" · Perfect Memory":""}{index<entry.pulls.length-1?"":""}</span>)}</div>
      </div>):<small>Chưa có lượt Wish trên banner này.</small>}
    </div>
  </div>;
}
