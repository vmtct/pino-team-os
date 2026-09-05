import Image from "next/image";
import type { WardSession, WardSessionCandidate } from "@/lib/pinoria-ward-session";
import { wardAssetUrl, wardRenderTransformStyle } from "@/lib/pinoria-ward-session";
import styles from "./reception-tv.module.css";

export function WardSessionTv({ learnerName, session }: { learnerName: string; session: WardSession }) {
  return <aside className={styles.wardSessionTv} data-ward-session={session.status.toLowerCase()}>
    <header><div><span>WARD CHOICE · {session.policyVersion}</span><strong>{learnerName}</strong></div><b>{session.status === "SELECTED" ? "ĐÃ CHỌN ✦" : "ĐANG CHỌN…"}</b></header>
    <div className={styles.wardSessionTvChoices}>{session.candidates.map((candidate, index) => <WardTvCandidate key={candidate.id} candidate={candidate} index={index} selected={candidate.id === session.selectedVariantId} />)}</div>
  </aside>;
}

function WardTvCandidate({ candidate, index, selected }: { candidate: WardSessionCandidate; index: number; selected: boolean }) {
  const asset = wardAssetUrl(candidate.render.assetKey);
  const poster = wardAssetUrl(candidate.render.posterAssetKey);
  const renderStyle = candidate.render.mode === "LAYER" ? wardRenderTransformStyle(candidate.render.metadata) : undefined;
  return <div className={`${styles.wardSessionTvCard} ${selected ? styles.wardSessionTvSelected : ""}`}>
    <div>{candidate.render.mode === "WEBM" && asset ? <video src={asset} poster={poster ?? undefined} autoPlay loop muted playsInline /> : asset ? <Image src={asset} alt="" width={320} height={320} unoptimized style={renderStyle} /> : <span>✦</span>}{selected ? <i>✓</i> : <em>0{index + 1}</em>}</div>
    <small>{candidate.slot.replace("HEAD/HAIR", "HAIR")}</small><strong>{candidate.displayName}</strong>
  </div>;
}
