import type { WorldStateTransitionPayload } from "./shop-types";
import styles from "./world-state-transition.module.css";

export const WORLD_STATE_TRANSITION_MS = 10_200;

export const DEFAULT_WORLD_STATE_TRANSITION: WorldStateTransitionPayload = {
  id: "prototype-terravia-chapter-ii",
  title: "Terravia đang chuyển mình",
  detail: "Ánh sáng, nhịp thở và dấu hiệu trong House đang đổi theo chương mới của thế giới Pinoria.",
  from: {
    id: "terravia-chapter-i",
    revision: 1,
    regionLabel: "Terravia",
    chapterLabel: "Chương I",
    seasonLabel: "Mùa Thu",
    ambientTheme: "terravia",
    updatedAt: 0,
  },
  to: {
    id: "terravia-chapter-ii",
    revision: 2,
    regionLabel: "Terravia",
    chapterLabel: "Chương II",
    seasonLabel: "Giao mùa",
    ambientTheme: "ember",
    updatedAt: 0,
  },
  footer: "Thay đổi này tiếp tục tồn tại trong House Ambient sau khi nghi thức kết thúc.",
};

const themeGlyph = {
  neutral: "○",
  verdant: "❧",
  tide: "≈",
  terravia: "◇",
  ember: "✦",
} as const;

export function WorldStateTransitionScene({
  transition = DEFAULT_WORLD_STATE_TRANSITION,
  replay = false,
}: {
  transition?: WorldStateTransitionPayload;
  replay?: boolean;
}) {
  return (
    <section
      className={styles.scene}
      data-pinoria-world-state-transition
      data-from-theme={transition.from.ambientTheme}
      data-to-theme={transition.to.ambientTheme}
    >
      <div className={styles.scrim} />
      <div className={styles.oldWorld} />
      <div className={styles.newWorld} />
      <div className={styles.vignette} />

      <div className={styles.header}>
        <span>{replay ? "PHÁT LẠI · WORLD STATE" : "PINORIA · WORLD STATE"}</span>
        <strong>THẾ GIỚI ĐANG THAY ĐỔI</strong>
      </div>

      <div className={styles.axis}>
        <div className={styles.fromCard}>
          <span className={styles.stateGlyph}>{themeGlyph[transition.from.ambientTheme]}</span>
          <small>TRƯỚC</small>
          <strong>{transition.from.regionLabel}</strong>
          <p>{transition.from.chapterLabel} · {transition.from.seasonLabel}</p>
        </div>

        <div className={styles.portal} aria-hidden="true">
          <i className={styles.ringA} />
          <i className={styles.ringB} />
          <i className={styles.ringC} />
          <span>✦</span>
        </div>

        <div className={styles.toCard}>
          <span className={styles.stateGlyph}>{themeGlyph[transition.to.ambientTheme]}</span>
          <small>HIỆN TẠI</small>
          <strong>{transition.to.regionLabel}</strong>
          <p>{transition.to.chapterLabel} · {transition.to.seasonLabel}</p>
        </div>
      </div>

      <div className={styles.copy}>
        <p>{transition.title}</p>
        <h1>{transition.to.chapterLabel}</h1>
        <strong>{transition.detail}</strong>
      </div>

      <div className={styles.persistenceLine}>
        <span />
        <div>
          <small>WORLD STATE ĐÃ ĐƯỢC COMMIT</small>
          <strong>{transition.footer ?? "House Ambient sẽ tiếp tục phản ánh trạng thái mới."}</strong>
        </div>
      </div>

      <div className={styles.truthNote}>STATE COMMITTED BEFORE PROJECTION · NO TEMPORARY SKIN</div>
    </section>
  );
}
