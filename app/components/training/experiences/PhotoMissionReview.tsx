"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TRAINING_EXPERIENCE_CONTRACT_V1,
  type TrainingArtifactDraft,
  type TrainingArtifactProjection,
  type TrainingExperienceSignal,
} from "@/lib/training-experience";
import { trainingExperienceRegistry } from "./registry";
import { TrainingExperienceHost } from "./TrainingExperienceHost";
import styles from "./experience.module.css";

type ReviewSubmission = TrainingArtifactProjection & {
  fileName: string;
  size: number;
  previewUrl: string;
};

export function PhotoMissionReview() {
  const [signals, setSignals] = useState<TrainingExperienceSignal[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [submission, setSubmission] = useState<ReviewSubmission | null>(null);
  useEffect(() => setHydrated(true), []);

  const definition = trainingExperienceRegistry.list().find((item) => item.experienceKey === "pino-photo-mission")!;
  const experienceRef = useMemo(() => ({
    contractVersion: TRAINING_EXPERIENCE_CONTRACT_V1,
    experienceKey: definition.experienceKey,
    experienceRevision: definition.experienceRevision,
  }), [definition]);

  async function submitArtifact(artifact: TrainingArtifactDraft) {
    if (submission?.previewUrl) URL.revokeObjectURL(submission.previewUrl);
    const next: ReviewSubmission = {
      submissionId: `photo-${Date.now()}`,
      submissionKey: artifact.submissionKey,
      status: "WAITING_REVIEW",
      feedback: null,
      fileName: artifact.file.name,
      size: artifact.file.size,
      previewUrl: URL.createObjectURL(artifact.file),
    };
    setSubmission(next);
    return { submissionId: next.submissionId, submissionKey: next.submissionKey, status: "WAITING_REVIEW" as const };
  }

  function review(status: "PASS" | "RETRY") {
    setSubmission((value) => value ? {
      ...value,
      status,
      feedback: status === "PASS" ? "Góc thấp tốt, khoảnh khắc tự nhiên và có PINO context." : "Background còn rối. Hạ góc thêm và giữ tác phẩm rõ hơn.",
    } : value);
  }
  return (
    <main className={styles.review} data-hydrated={hydrated ? "true" : "false"}>
      <header className={styles.reviewHead}>
        <div>
          <p className={styles.kicker}>WFM-TRAIN · BESPOKE EXPERIENCE</p>
          <h1>Photo Mission</h1>
          <p>Staff học bằng mắt, chụp ảnh thật, rồi handoff submission cho Manager review.</p>
        </div>
        <span className={styles.pill}>8 phút · Staff mobile</span>
      </header>

      <div className={styles.reviewGrid}>
        <section className={styles.phone}>
          <div className={styles.phoneTop}><span>Học & Chứng nhận</span><small>Preview as Staff</small></div>
          <TrainingExperienceHost
            experienceRef={experienceRef}
            context={{
              mode: "PREVIEW",
              assignmentId: "photo-preview",
              moduleVersionId: "photo-v1",
              title: definition.title,
              dueDate: null,
              completedCheckpointKeys: [],
              artifactSubmissions: submission ? [submission] : [],
            }}
            onSignal={(signal) => setSignals((items) => [...items, signal])}
            onArtifactSubmit={submitArtifact}
          />
        </section>
        <aside className={styles.inspector}>
          <section>
            <p className={styles.kicker}>Manager review</p>
            <h2>Ảnh thực hành</h2>
            {!submission ? <p className={styles.muted}>Chưa có submission.</p> : <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.managerPreview} src={submission.previewUrl} alt="Ảnh Staff submit để Manager review" />
              <dl>
                <div><dt>file</dt><dd>{submission.fileName}</dd></div>
                <div><dt>size</dt><dd>{Math.max(1, Math.round(submission.size / 1024))} KB</dd></div>
                <div><dt>status</dt><dd>{submission.status}</dd></div>
              </dl>
              {submission.feedback ? <div className={submission.status === "PASS" ? styles.good : styles.warn}>{submission.feedback}</div> : null}
              {submission.status === "WAITING_REVIEW" ? <div className={styles.managerActions}>
                <button type="button" onClick={() => review("RETRY")}>Needs retry</button>
                <button type="button" onClick={() => review("PASS")}>Pass photo</button>
              </div> : null}
            </>}
          </section>

          <section>
            <p className={styles.kicker}>Lifecycle signals</p>
            <div className={styles.signalLog} aria-live="polite">
              {signals.length === 0 ? <span>Chưa có signal.</span> : signals.map((signal, index) => (
                <code key={`${signal.type}-${index}`}>
                  {signal.type}
                  {"checkpointKey" in signal ? ` · ${signal.checkpointKey}` : ""}
                  {"submissionId" in signal ? ` · ${signal.submissionId}` : ""}
                </code>
              ))}
            </div>
          </section>
          <section className={styles.rule}>
            <strong>Prototype storage boundary</strong>
            <p>Local review giữ ảnh trong browser memory. Production adapter sau F0 merge phải upload media trước, rồi Core mới giữ submission/review provenance.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
