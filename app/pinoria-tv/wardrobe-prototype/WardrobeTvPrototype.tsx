"use client";
/* eslint-disable @next/next/no-img-element -- prototype composes current Pinoria layer assets */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayeredCharacter, type PinoriaCharacterConfig } from "../layered-character";
import styles from "./wardrobe-tv-prototype.module.css";

type SessionChoice = {
  learnerId: string;
  learnerName: string;
  visitId: string;
  candidateIds: string[];
  selected: number | null;
};
type Candidate = { id: string; name: string; slot: string; asset: string };

const STORAGE = "pino.prototype.pnr-ward.session-choice.v1";
const ASSET = "https://pino-asset-publisher.minhtri-van42.workers.dev/assets/pinoria/assets";
const candidates: Candidate[] = [
  { id: "birthday-hat", name: "Nón Sinh Nhật", slot: "Nón", asset: `${ASSET}/birthday-hat/v001/standalone.png` },
  { id: "face-smile", name: "Gương mặt Mỉm Cười", slot: "Mặt · kính", asset: `${ASSET}/face-01/v001/standalone.png` },
  { id: "face-playful", name: "Gương mặt Tinh Nghịch", slot: "Mặt · kính", asset: `${ASSET}/face-02/v001/standalone.png` },
];
const baseConfig: PinoriaCharacterConfig = {
  back: `${ASSET}/hologram-wings/v001/layer.png`,
  outfit: `${ASSET}/painting-outfit-01/v001/layer.png`,
  hair: `${ASSET}/hair-long-brown-wavy-headband/v001/layer.png`,
  face: `${ASSET}/face-01/v001/layer.png`,
  headwear: "",
  eyewear: `${ASSET}/star-glasses/v001/layer.png`,
};

function candidate(id: string) {
  return candidates.find((item) => item.id === id)!;
}
function configAfterSelection(selected: number | null, ids: string[]) {
  if (selected === null) return baseConfig;
  const item = candidate(ids[selected - 1]);
  if (item.id === "birthday-hat") return { ...baseConfig, headwear: `${ASSET}/birthday-hat/v001/layer.png` };
  if (item.id === "face-smile") return { ...baseConfig, face: `${ASSET}/face-01/v001/layer.png`, eyewear: "" };
  if (item.id === "face-playful") return { ...baseConfig, face: `${ASSET}/face-02/v001/layer.png`, eyewear: "" };
  return baseConfig;
}

export function WardrobeTvPrototype() {
  const params = useSearchParams();
  const learnerId = params.get("learnerId") || "lrn_bo";
  const learnerName = params.get("learnerName") || "Bơ";
  const visitId = params.get("visitId") || "visit_bo_001";
  const [session, setSession] = useState<SessionChoice>(() => ({
    learnerId, learnerName, visitId,
    candidateIds: candidates.map((item) => item.id),
    selected: null,
  }));
  const ordered = useMemo(() => session.candidateIds.map(candidate), [session.candidateIds]);
  const selectedItem = session.selected === null ? null : ordered[session.selected - 1];

  useEffect(() => {
    function read() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE) || "{}") as Record<string, SessionChoice>;
        const current = saved[visitId];
        if (current) setSession(current);
        else {
          const next: SessionChoice = {
            learnerId, learnerName, visitId,
            candidateIds: candidates.map((item) => item.id),
            selected: null,
          };
          localStorage.setItem(STORAGE, JSON.stringify({ ...saved, [visitId]: next }));
          setSession(next);
        }
      } catch {}
    }
    read();
    const timer = window.setInterval(read, 350);
    window.addEventListener("storage", read);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", read);
    };
  }, [learnerId, learnerName, visitId]);

  const character = configAfterSelection(session.selected, session.candidateIds);
  return <main className={`${styles.stage} ${selectedItem ? styles.resolved : ""}`}>
    <div className={styles.aurora} aria-hidden="true" />
    <div className={styles.stars} aria-hidden="true" />

    <header className={styles.topbar}>
      <div className={styles.brand}>
        <span>PINORIA HOUSE</span>
        <strong>TỦ ĐỒ</strong>
      </div>
      <div className={styles.ready}><i /> Sẵn sàng</div>
    </header>

    <section className={styles.scene}>
      <div className={styles.avatarColumn}>
        <div className={styles.greeting}>
          <span>{selectedItem ? "ĐÃ CHỌN XONG" : "PHIÊN CHECK-IN"}</span>
          <h1>{selectedItem ? `Số ${session.selected} là của ${learnerName} ✦` : `${learnerName}, chọn món con thích`}</h1>
          <p>{selectedItem ? "Tủ đồ đã cập nhật. Nhân vật của con đã sẵn sàng!" : "Nhớ số 1, 2 hoặc 3 rồi báo cho staff nhé."}</p>
        </div>
        <div className={styles.avatarStage}>
          <div className={styles.orbitOne} />
          <div className={styles.orbitTwo} />
          <div className={styles.pedestal} />
          <LayeredCharacter config={character} className={styles.character} />
          {selectedItem ? <div className={styles.sparkBurst} aria-hidden="true">✦ ✧ ✦</div> : null}
        </div>
      </div>

      <div className={styles.choiceColumn}>
        <div className={styles.choiceIntro}>
          <span>BA MÓN DÀNH CHO CON HÔM NAY</span>
          <strong>{selectedItem ? `Con đã chọn món số ${session.selected}` : "Con thích món nào?"}</strong>
        </div>

        <div className={styles.cards}>
          {ordered.map((item, index) => {
            const number = index + 1;
            const chosen = session.selected === number;
            return <article
              key={item.id}
              className={`${styles.card} ${chosen ? styles.chosen : ""} ${selectedItem && !chosen ? styles.dimmed : ""}`}
            >
              <div className={styles.number}><small>SỐ</small><b>{number}</b></div>
              <div className={styles.itemImage}><img src={item.asset} alt="" /></div>
              <div className={styles.itemCopy}>
                <strong>{item.name}</strong>
                <small>{item.slot}</small>
              </div>
              {chosen ? <b className={styles.pickBadge}>ĐÃ CHỌN</b> : null}
            </article>;
          })}
        </div>

        <div className={styles.reminder}>
          <span className={styles.reminderNumbers}>1 · 2 · 3</span>
          <span>{selectedItem ? "Lựa chọn đã được staff xác nhận" : "Chỉ cần nhớ số — staff sẽ giúp con đổi món"}</span>
        </div>
      </div>
    </section>

    <footer className={styles.footer}>
      <span>PINORIA · WARDROBE</span>
      <span>{selectedItem ? "Đã cập nhật nhân vật" : "Đang chờ staff xác nhận"}</span>
    </footer>
  </main>;
}
