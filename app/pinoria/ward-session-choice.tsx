"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { WardSession, WardSessionCandidate } from "@/lib/pinoria-ward-session";
import { wardAssetUrl } from "@/lib/pinoria-ward-session";
import styles from "./pinoria.module.css";

export function WardSessionChoice({
  learnerName,
  session,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  learnerName: string;
  session: WardSession;
  busy: boolean;
  error: string;
  onConfirm: (candidate: WardSessionCandidate) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(session.selectedVariantId ?? session.candidates[0].id);
  useEffect(() => setSelectedId(session.selectedVariantId ?? session.candidates[0].id), [session]);
  const selected = session.candidates.find((candidate) => candidate.id === selectedId) ?? session.candidates[0];
  const done = session.status === "SELECTED";

  return <div className={styles.wardBackdrop} role="dialog" aria-modal="true" aria-label={`Ward choice for ${learnerName}`}>
    <section className={styles.wardModal}>
      <header className={styles.wardHeader}>
        <div><span className={styles.eyebrow}>PINORIA · WARD CHOICE</span><h2>{done ? "Ward đã được chọn ✦" : `Hôm nay ${learnerName} mặc gì?`}</h2></div>
        <button className={styles.wardClose} onClick={onClose} aria-label="Đóng">✕</button>
      </header>
      <p className={styles.wardLead}>{done ? "Lựa chọn này đã được áp dụng cho buổi hôm nay." : "Chọn một trong 3 món Pinoria dành riêng cho lần check-in này."}</p>
      <div className={styles.wardChoices}>
        {session.candidates.map((candidate, index) => <WardCandidateCard key={candidate.id} candidate={candidate} index={index} selected={candidate.id === selected.id} locked={done} onSelect={() => setSelectedId(candidate.id)} />)}
      </div>
      {error ? <div className={styles.wardError}>{error}</div> : null}
      <footer className={styles.wardActions}>
        <div><span>{selected.slot.replace("HEAD/HAIR", "HAIR")}</span><b>{selected.wearableName}</b></div>
        {done ? <button className={styles.wardConfirm} onClick={onClose}>Xong</button> : <button className={styles.wardConfirm} disabled={busy} onClick={() => onConfirm(selected)}>{busy ? "Đang áp dụng…" : "Xác nhận lựa chọn"}</button>}
      </footer>
    </section>
  </div>;
}

function WardCandidateCard({ candidate, index, selected, locked, onSelect }: { candidate: WardSessionCandidate; index: number; selected: boolean; locked: boolean; onSelect: () => void }) {
  const asset = wardAssetUrl(candidate.render.assetKey);
  const poster = wardAssetUrl(candidate.render.posterAssetKey);
  return <button type="button" className={`${styles.wardChoice} ${selected ? styles.wardChoiceSelected : ""}`} onClick={onSelect} disabled={locked && !selected} aria-pressed={selected}>
    <div className={styles.wardChoiceVisual}>
      <span className={styles.wardChoiceNumber}>0{index + 1}</span>
      {candidate.render.mode === "WEBM" && asset
        ? <video src={asset} poster={poster ?? undefined} autoPlay loop muted playsInline />
        : asset ? <Image src={asset} alt="" width={420} height={420} unoptimized draggable={false} /> : <span className={styles.wardFallback}>✦</span>}
      {selected ? <span className={styles.wardSelectedMark}>✓</span> : null}
    </div>
    <div className={styles.wardChoiceCopy}><small>{candidate.slot.replace("HEAD/HAIR", "HAIR")} · {candidate.rarity}</small><strong>{candidate.displayName}</strong><span>{candidate.wearableName}</span></div>
  </button>;
}
