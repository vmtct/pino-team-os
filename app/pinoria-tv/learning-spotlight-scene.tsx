"use client";

import { PrototypeCharacter } from "./prototype-assets";
import type { LearningSpotlightPayload } from "./shop-types";
import styles from "./learning-spotlight.module.css";

export const LEARNING_SPOTLIGHT_MS = 8_600;

export type LearningSpotlightSubject = {
  id: string;
  name: string;
  path: string;
  room: string;
};

export const DEFAULT_LEARNING_SPOTLIGHT: LearningSpotlightPayload = {
  id: "prototype-art-composition",
  program: "artchitect",
  kind: "skill",
  milestoneLabel: "Composition",
  previousLabel: "Color",
  nextLabel: "Style",
  detail: "Từ những yếu tố riêng lẻ, con bắt đầu tổ chức chúng thành một bức tranh có chủ đích.",
  evidenceLabel: "Hoàn thành Core checkpoint",
};

function programLabel(program: LearningSpotlightPayload["program"]) {
  return ({
    artchitect: "ARTCHITECT",
    pianohouse: "PIANO HOUSE",
    "little-piner": "LITTLE PINER",
    toppi: "TOPPI ENGLISH",
    house: "PINO HOUSE",
  } as const)[program];
}

function kindLabel(kind: LearningSpotlightPayload["kind"]) {
  return ({
    skill: "MỞ KHÓA KỸ NĂNG",
    performance: "MỐC BIỂU DIỄN",
    project: "ĐỒ ÁN HOÀN THÀNH",
    achievement: "THÀNH QUẢ MỚI",
  } as const)[kind];
}

export function LearningSpotlightScene({
  subject,
  spotlight = DEFAULT_LEARNING_SPOTLIGHT,
  replay = false,
}: {
  subject: LearningSpotlightSubject;
  spotlight?: LearningSpotlightPayload;
  replay?: boolean;
}) {
  return (
    <section
      className={styles.scene}
      data-pinoria-learning-spotlight
      data-program={spotlight.program}
      data-kind={spotlight.kind}
    >
      <div className={styles.scrim} />
      <div className={styles.lightWash} />
      <div className={styles.vignette} />

      <div className={styles.characterWrap}>
        <div className={styles.characterHalo} />
        <PrototypeCharacter
          subjectId={subject.id}
          motion="celebrate"
          size="100%"
          style={{ filter: "drop-shadow(0 25px 30px rgba(0,0,0,.34))" }}
        />
      </div>

      <div className={styles.story}>
        <div className={styles.kickerRow}>
          <span>{programLabel(spotlight.program)}</span>
          <i />
          <span>{replay ? "PHÁT LẠI" : kindLabel(spotlight.kind)}</span>
        </div>

        <div className={styles.sparkMark}>✦</div>
        <p className={styles.eyebrow}>MỘT BƯỚC MỚI TRÊN HÀNH TRÌNH</p>
        <h1>
          <span>{subject.name} vừa mở khóa</span>
          <strong>{spotlight.milestoneLabel}</strong>
        </h1>
        <p className={styles.detail}>{spotlight.detail}</p>

        <div className={styles.progress} aria-label="Learning journey progression">
          <div className={`${styles.node} ${styles.done}`}>
            <span>✓</span>
            <small>{spotlight.previousLabel ?? "Đã đi qua"}</small>
          </div>
          <div className={styles.line}><i /></div>
          <div className={`${styles.node} ${styles.current}`}>
            <span>✦</span>
            <small>{spotlight.milestoneLabel}</small>
          </div>
          <div className={`${styles.line} ${styles.lineFuture}`} />
          <div className={`${styles.node} ${styles.future}`}>
            <span>·</span>
            <small>{spotlight.nextLabel ?? "Tiếp theo"}</small>
          </div>
        </div>

        {spotlight.evidenceLabel ? (
          <div className={styles.evidence}>
            <span>✓</span>
            <div>
              <small>DẤU MỐC ĐÃ ĐƯỢC GHI NHẬN</small>
              <strong>{spotlight.evidenceLabel}</strong>
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.contextLine}>
        <span>{subject.room || "PINO House"}</span>
        <i />
        <span>{subject.path || "Hành trình sáng tạo"}</span>
      </div>
      <div className={styles.truthNote}>LEARNING TRUTH COMMITTED · TV PRESENTATION ONLY</div>
    </section>
  );
}
