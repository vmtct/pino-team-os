"use client";
/** PAP-2031 / PNR-WISH — committed-result media is optional, never a second draw. */
import {useEffect,useState} from "react";
import styles from "./wish-reveal.module.css";
import {TosVNextButton,TosVNextCard} from "../tos-ds";
import {parseCommittedWishReveal,type CommittedWish,type WishRevealScope} from "@/lib/pls-wish-reveal-contract";
export type WishRevealLoader=(scope:WishRevealScope,signal:AbortSignal)=>Promise<unknown>;
export function TosWishReveal({receipt,centerId,learnerId,load,onDone}:{receipt:CommittedWish;centerId:string;learnerId:string;load?:WishRevealLoader;onDone:()=>void}){
 const [media,setMedia]=useState<string|null>(null),[finished,setFinished]=useState(!load);
 useEffect(()=>{if(!load)return;const c=new AbortController();const timeout=window.setTimeout(()=>{c.abort();setFinished(true);},8000);
 void Promise.resolve().then(()=>load({centerId,learnerId,eventId:receipt.eventId},c.signal)).then(raw=>{if(!c.signal.aborted){const url=parseCommittedWishReveal(raw,receipt);if(url)setMedia(url);else setFinished(true);}}).catch(()=>{if(!c.signal.aborted)setFinished(true);}).finally(()=>window.clearTimeout(timeout));
 return()=>{c.abort();window.clearTimeout(timeout);};
 },[load,receipt,centerId,learnerId]);
 return <TosVNextCard aria-label="Kết quả Wish">
 {!finished?<><p role="status">Wish đã được Core xác nhận.</p>{media&&<video src={media} autoPlay playsInline controls className={styles.revealVideo} onEnded={()=>setFinished(true)} onError={()=>setFinished(true)}/>}<TosVNextButton type="button" onClick={()=>setFinished(true)}>Bỏ qua hiệu ứng</TosVNextButton></>:<>
 <strong>Kết quả {receipt.count} Wish</strong><p>Số dư còn lại: {receipt.balanceAfter} PLS</p>
 <ol aria-label="Item nhận được">{receipt.outcomes.map(o=><li key={o.ordinal}><strong>{o.rarity}★</strong> · {o.itemId} · r{o.itemRevision} {o.duplicate?"· Trùng Item — không cấp thêm":"· Đã cấp Item"}</li>)}</ol>
 <TosVNextButton type="button" onClick={onDone}>Hoàn tất</TosVNextButton></>}
 </TosVNextCard>;
}
