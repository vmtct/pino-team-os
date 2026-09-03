"use client";

import { useMemo, useState } from "react";
import {
  TRAINING_EXPERIENCE_CONTRACT_V1,
  type TrainingExperienceSignal,
} from "@/lib/training-experience";
import { trainingExperienceRegistry } from "./registry";
import { TrainingExperienceHost } from "./TrainingExperienceHost";
import styles from "./experience.module.css";

export function ExperienceConceptReview() {
  const [signals, setSignals] = useState<TrainingExperienceSignal[]>([]);
  const definition = trainingExperienceRegistry.list()[0];
  const experienceRef = useMemo(
    () => ({
      contractVersion: TRAINING_EXPERIENCE_CONTRACT_V1,
      experienceKey: definition.experienceKey,
      experienceRevision: definition.experienceRevision,
    }),
    [definition],
  );

  function record(signal: TrainingExperienceSignal) {
    setSignals((items) => [...items, signal]);
  }

  return (
    <main className={styles.review}>
      <header className={styles.reviewHead}>
        <div>
          <p className={styles.kicker}>WFM-TRAIN/F1-EXPERIENCE · LOCAL CONCEPT</p>
          <h1>Training Experience as Code</h1>
          <p>
            Runtime lifecycle cố định. UI/format của từng training được build bespoke rồi compile-time
            register.
          </p>
        </div>
        <span className={styles.pill}>No generic LMS builder</span>
      </header>

      <div className={styles.reviewGrid}>
        <section className={styles.phone}>
          <div className={styles.phoneTop}>
            <span>Học & Chứng nhận</span>
            <small>Preview as Staff</small>
          </div>
          <TrainingExperienceHost
            experienceRef={experienceRef}
            context={{
              mode: "PREVIEW",
              assignmentId: "preview-assignment",
              moduleVersionId: "preview-module-version",
              title: definition.title,
              dueDate: null,
              completedCheckpointKeys: [],
            }}
            onSignal={record}
          />
        </section>

        <aside className={styles.inspector}>
          <section>
            <p className={styles.kicker}>Compile-time registry</p>
            <h2>{definition.title}</h2>
            <dl>
              <div><dt>contract</dt><dd>{definition.contractVersion}</dd></div>
              <div><dt>identity</dt><dd>{definition.experienceKey}@{definition.experienceRevision}</dd></div>
              <div><dt>duration</dt><dd>{definition.estimatedMinutes} phút</dd></div>
              <div><dt>capabilities</dt><dd>{definition.capabilities.join(" · ")}</dd></div>
            </dl>
          </section>

          <section>
            <p className={styles.kicker}>Standard lifecycle signals</p>
            <div className={styles.signalLog} aria-live="polite">
              {signals.length === 0 ? <span>Chưa có signal.</span> : signals.map((signal, index) => (
                <code key={`${signal.type}-${index}`}>
                  {signal.type}
                  {"checkpointKey" in signal ? ` · ${signal.checkpointKey}` : ""}
                </code>
              ))}
            </div>
          </section>

          <section className={styles.rule}>
            <strong>Đây không phải template.</strong>
            <p>
              Training khác có thể là conversation simulator, visual story, rubric, game hoặc bất kỳ
              interaction nào. Chúng chỉ chia sẻ contract lifecycle.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
