"use client";

import type {
  TrainingArtifactDraft,
  TrainingArtifactReceipt,
  TrainingExperienceContext,
  TrainingExperienceRef,
  TrainingExperienceSignal,
} from "@/lib/training-experience";
import { trainingExperienceRegistry } from "./registry";
import styles from "./experience.module.css";

export function TrainingExperienceHost({
  experienceRef,
  context,
  onSignal,
  onArtifactSubmit,
}: {
  experienceRef: TrainingExperienceRef;
  context: TrainingExperienceContext;
  onSignal: (signal: TrainingExperienceSignal) => void | Promise<void>;
  onArtifactSubmit?: (artifact: TrainingArtifactDraft) => Promise<TrainingArtifactReceipt>;
}) {
  const resolution = trainingExperienceRegistry.resolve(experienceRef);
  if (!resolution.ok) {
    return (
      <section className={styles.unavailable}>
        <strong>Training experience unavailable.</strong>
        <p>{resolution.message}</p>
        <code>{resolution.code}</code>
      </section>
    );
  }

  const Component = resolution.definition.Component;
  return (
    <Component
      context={context}
      onSignal={onSignal}
      onArtifactSubmit={onArtifactSubmit}
    />
  );
}
