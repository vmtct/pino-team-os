"use client";
import { useState } from "react";
import type { DressingItem } from "@/lib/pinoria-tv-dressing-read";
import styles from "./dressing-avatar-scene.module.css";
import { HOUSE_ASSETS } from "./ambient-house-runtime";
import "../components/tos-ds/tokens.css";

/** PAP-2041 approved display-only scene. Failed images are omitted, never substituted. */
export function DressingAvatarScene({name,items}:{name:string;items:readonly DressingItem[]}) {
  const [failed,setFailed]=useState<ReadonlySet<string>>(()=>new Set());
  const visible=items.filter(item=>!failed.has(item.itemId));
  return <section data-tos-system="" data-dressing-avatar="" className={styles.scene} aria-label="Dressing Avatar">
    <div className={styles.houseBackdrop} aria-hidden="true">
      {[HOUSE_ASSETS.back,HOUSE_ASSETS.mid,HOUSE_ASSETS.front].map(src=><img key={src} src={src} alt="" draggable={false}/>)}
    </div>
    <div className={styles.frame} data-empty={visible.length===0}>
      <header className={styles.copy}>
      <span className={styles.eyebrow}>DRESSING AVATAR</span>
      <h1>Nay {name} mặc gì đi học?</h1>
      <p>{visible.length?"Những vật phẩm Avatar con chưa sở hữu.":"Hôm nay không có vật phẩm mới rồi!"}</p>
      </header>
      {visible.length>0?<div className={styles.items} data-item-count={visible.length}>
        {visible.map(item=><div key={item.itemId} data-dressing-item-id={item.itemId} className={styles.card}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={"data:"+item.image.mimeType+";base64,"+item.image.bytesBase64} alt="" onError={()=>setFailed(previous=>new Set([...previous,item.itemId]))} />
          <strong>{item.displayName}</strong>
        </div>)}
      </div>:null}
    </div>
  </section>;
}
