"use client";

import { companionView } from "./companion-view";
import { PrototypeCharacter, PrototypeCompanion } from "./prototype-assets";
import type { CompanionProjectionSnapshot, EnergySeedReward } from "./shop-types";
import styles from "./energy-seed.module.css";

export const ENERGY_SEED_SCENE_MS = 10_000;

export type EnergySeedSubject = {
  id: string;
  name: string;
  companion?: string;
  companionState?: CompanionProjectionSnapshot;
};

export const DEFAULT_ENERGY_SEED_REWARD: EnergySeedReward = {
  id: "prototype-fruit-01",
  kind: "fruit",
  label: "Fruit ×1",
  detail: "Một nguồn năng lượng mới đã được ghi nhận.",
  region: "Thủy",
};

function rewardGlyph(reward: EnergySeedReward) {
  if (reward.kind === "pls") return "PLS";
  if (reward.kind === "fruit") return "✦";
  if (reward.kind === "mirror-ticket") return "◇";
  if (reward.kind === "wearable") return "◒";
  if (reward.kind === "companion-item") return "◉";
  return "✧";
}


const motes = [
  ["18%", "23%", "0ms"],
  ["31%", "16%", "280ms"],
  ["71%", "19%", "540ms"],
  ["82%", "34%", "120ms"],
  ["77%", "68%", "740ms"],
  ["61%", "79%", "360ms"],
  ["28%", "76%", "620ms"],
  ["15%", "57%", "900ms"],
] as const;

export function EnergySeedScene({
  subject,
  reward = DEFAULT_ENERGY_SEED_REWARD,
  replay = false,
}: {
  subject: EnergySeedSubject;
  reward?: EnergySeedReward;
  replay?: boolean;
}) {
  const companion = companionView(subject);

  return (
    <section className={styles.scene} data-pinoria-energy-seed>
      <div className={styles.scrim} />
      <div className={styles.aurora} />
      <div className={styles.vignette} />

      <div className={styles.titleBlock}>
        <span>{replay ? "PHÁT LẠI · NGHI THỨC" : "PINORIA · NGHI THỨC"}</span>
        <h1>Hạt Năng Lượng Pinoria</h1>
        <p>Dành cho {subject.name}{companion.active ? ` · ${companion.displayName}` : ""}</p>
      </div>

      <div className={styles.characterWrap}>
        <PrototypeCharacter
          subjectId={subject.id}
          motion="celebrate"
          size="100%"
          style={{ filter: "drop-shadow(0 24px 28px rgba(0,0,0,.34))" }}
        />
      </div>

      {companion.active ? <div className={styles.companionReaction} data-pinoria-energy-seed-companion={companion.displayName} aria-label={companion.displayName}>
        <div className={styles.companionHalo} />
        <div className={styles.companionOrb}><PrototypeCompanion displayName={companion.displayName} visualId={companion.visualId ?? undefined} size="100%" /></div>
        <strong>{companion.displayName}</strong>
      </div> : null}

      <div className={styles.seedStage}>
        <div className={styles.regionPulse} data-region={reward.region ?? "Pinoria"} />
        <div className={styles.ringOne} />
        <div className={styles.ringTwo} />
        <div className={styles.ringThree} />
        {motes.map(([left, top, delay], index) => (
          <i key={index} className={styles.mote} style={{ left, top, animationDelay: delay }} />
        ))}
        <div className={styles.seedGlow} />
        <div className={styles.seedShell}>
          <i className={styles.seedVeinA} />
          <i className={styles.seedVeinB} />
          <b>✦</b>
        </div>
        <div className={styles.seedFlare} />
      </div>

      <div className={styles.rewardPanel}>
        <span className={styles.rewardKicker}>PHẦN THƯỞNG ĐÃ ĐƯỢC GHI NHẬN</span>
        <div className={styles.rewardRow}>
          <div className={styles.rewardIcon}>{reward.imageUrl ? <img src={reward.imageUrl} alt="" /> : rewardGlyph(reward)}</div>
          <div>
            <strong>{reward.label}</strong>
            <p>{reward.detail ?? "Phần thưởng đã được chốt trước khi nghi thức bắt đầu."}</p>
          </div>
        </div>
        <small>Không reroll · Phát lại luôn hiển thị cùng kết quả</small>
      </div>

      <div className={styles.commitNote}>CORE COMMITTED · TV PRESENTATION ONLY</div>
    </section>
  );
}
