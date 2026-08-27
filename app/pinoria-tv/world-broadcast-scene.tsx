"use client";

import type { WorldBroadcastPayload } from "./shop-types";
import styles from "./world-broadcast.module.css";

export const WORLD_BROADCAST_MS = 9_400;

export const DEFAULT_WORLD_BROADCAST: WorldBroadcastPayload = {
  id: "prototype-terravia-gate",
  kind: "world-update",
  scope: "pinoria",
  eyebrow: "TERRAVIA · WORLD UPDATE",
  title: "Một cánh cửa mới đang mở",
  detail: "Terravia vừa chuyển mình. Những dấu hiệu đầu tiên của vùng đất tiếp theo đã xuất hiện trong Pinoria.",
  chapterLabel: "Hành trình Terravia",
  regionLabel: "Terravia",
  footer: "Thế giới thay đổi cho tất cả Piner · Không cần thao tác trên TV",
};

function kindLabel(kind: WorldBroadcastPayload["kind"]) {
  return ({
    "world-update": "WORLD UPDATE",
    campaign: "CAMPAIGN",
    discovery: "DISCOVERY",
    companion: "COMPANION",
    community: "HOUSE MOMENT",
    "lost-artifact": "THẦN KHÍ THẤT LẠC",
  } as const)[kind];
}

export function WorldBroadcastScene({
  broadcast = DEFAULT_WORLD_BROADCAST,
  replay = false,
}: {
  broadcast?: WorldBroadcastPayload;
  replay?: boolean;
}) {
  return (
    <section className={styles.scene} data-pinoria-world-broadcast data-kind={broadcast.kind}>
      <div className={styles.scrim} />
      <div className={styles.skyGlow} />
      <div className={styles.horizon} />
      <div className={styles.vignette} />

      <div className={styles.signal} aria-hidden="true">
        <div className={styles.signalRingA} />
        <div className={styles.signalRingB} />
        <div className={styles.signalRingC} />
        <div className={styles.sigil}>✦</div>
      </div>

      <div className={styles.copy}>
        <div className={styles.kickerRow}>
          <span>{replay ? "PHÁT LẠI" : kindLabel(broadcast.kind)}</span>
          <i />
          <span>{broadcast.scope === "house" ? "PINO HOUSE" : "PINORIA"}</span>
        </div>
        <p className={styles.eyebrow}>{broadcast.eyebrow}</p>
        <h1>{broadcast.title}</h1>
        <p className={styles.detail}>{broadcast.detail}</p>

        <div className={styles.metaRow}>
          {broadcast.regionLabel ? (
            <div>
              <small>VÙNG</small>
              <strong>{broadcast.regionLabel}</strong>
            </div>
          ) : null}
          {broadcast.chapterLabel ? (
            <div>
              <small>CHƯƠNG</small>
              <strong>{broadcast.chapterLabel}</strong>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.worldLine} aria-hidden="true">
        <span />
        <i />
        <b />
        <em />
      </div>

      <footer className={styles.footer}>{broadcast.footer ?? "Một thay đổi vừa được ghi nhận trong thế giới Pinoria."}</footer>
      <div className={styles.truthNote}>WORLD TRUTH COMMITTED · TV BROADCAST ONLY</div>
    </section>
  );
}
