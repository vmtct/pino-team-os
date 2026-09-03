"use client";

import type {
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
}: {
  experienceRef: TrainingExperienceRef;
  context: TrainingExperienceContext;
  onSignal: (signal: TrainingExperienceSignal) => void | Promise<void>;
}) {
  const resolved = trainingExperienceRegistry.resolve(experienceRef);

  if (!resolved.ok) {
    return (
      <section className={styles.unavailable} role="alert">
        <strong>Training experience chưa khả dụng trên TOS này.</strong>
        <p>{resolved.message}</p>
        <code>{resolved.code}</code>
      </section>
    );
  }

  const Experience = resolved.definition.Component;
  return <Experience context={context} onSignal={onSignal} />;
}
