"use client";

import { useEffect, useMemo, useState } from "react";
import { TRAINING_EXPERIENCE_CONTRACT_V1, type TrainingExperienceSignal } from "@/lib/training-experience";
import { trainingExperienceRegistry } from "./registry";
import { TrainingExperienceHost } from "./TrainingExperienceHost";
import styles from "./experience.module.css";

export function PhotoMissionReview() {
  const [signals, setSignals] = useState<TrainingExperienceSignal[]>([]);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const definition = trainingExperienceRegistry.list().find((item) => item.experienceKey === "pino-photo-mission")!;
  const experienceRef = useMemo(() => ({
    contractVersion: TRAINING_EXPERIENCE_CONTRACT_V1,
    experienceKey: definition.experienceKey,
    experienceRevision: definition.experienceRevision,
  }), [definition]);

  return (
    <main className={styles.review} data-hydrated={hydrated ? "true" : "false"}>
      <header className={styles.reviewHead}>
        <div>
          <p className={styles.kicker}>WFM-TRAIN · BESPOKE EXPERIENCE</p>
          <h1>Photo Mission</h1>
          <p>Prototype training nội bộ: học bằng mắt và quyết định trực tiếp trên simulated camera frame.</p>
        </div>
        <span className={styles.pill}>8 phút · Staff mobile</span>
      </header>
      <div className={styles.reviewGrid}>
        <section className={styles.phone}>
          <div className={styles.phoneTop}><span>Học & Chứng nhận</span><small>Preview as Staff</small></div>
          <TrainingExperienceHost
            experienceRef={experienceRef}
            context={{ mode: "PREVIEW", assignmentId: "photo-preview", moduleVersionId: "photo-v1", title: definition.title, dueDate: null, completedCheckpointKeys: [] }}
            onSignal={(signal) => setSignals((items) => [...items, signal])}
          />
        </section>
        <aside className={styles.inspector}>
          <section>
            <p className={styles.kicker}>Training intent</p>
            <h2>{definition.title}</h2>
            <dl>
              <div><dt>identity</dt><dd>{definition.experienceKey}@{definition.experienceRevision}</dd></div>
              <div><dt>duration</dt><dd>{definition.estimatedMinutes} phút</dd></div>
              <div><dt>format</dt><dd>visual mission · compare shots · pre-shutter scan</dd></div>
              <div><dt>outcome</dt><dd>Staff biết tự chọn một frame “ra PINO” trước khi bấm máy</dd></div>
            </dl>
          </section>
          <section>
            <p className={styles.kicker}>Lifecycle signals</p>
            <div className={styles.signalLog} aria-live="polite">
              {signals.length === 0 ? <span>Chưa có signal.</span> : signals.map((signal, index) => (
                <code key={`${signal.type}-${index}`}>{signal.type}{"checkpointKey" in signal ? ` · ${signal.checkpointKey}` : ""}</code>
              ))}
            </div>
          </section>
          <section className={styles.rule}>
            <strong>Content stance</strong>
            <p>Training không đặt ra consent/privacy policy mới. Nó chỉ nhắc Staff tuân thủ quy định hiện hành trước khi chụp; policy authority vẫn nằm ở owner tương ứng.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
