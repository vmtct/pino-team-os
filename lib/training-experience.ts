import type { ComponentType } from "react";

export const TRAINING_EXPERIENCE_CONTRACT_V1 = "wfm-train-exp/v1" as const;

export type TrainingExperienceRef = {
  contractVersion: typeof TRAINING_EXPERIENCE_CONTRACT_V1;
  experienceKey: string;
  experienceRevision: number;
};

export type TrainingArtifactReviewStatus = "WAITING_REVIEW" | "PASS" | "RETRY";

export type TrainingArtifactProjection = {
  submissionId: string;
  submissionKey: string;
  status: TrainingArtifactReviewStatus;
  feedback: string | null;
};

export type TrainingExperienceSignal =
  | { type: "STARTED" }
  | { type: "CHECKPOINT_COMPLETED"; checkpointKey: string }
  | { type: "ASSESSMENT_SUBMITTED"; score: number }
  | { type: "SUBMISSION_CREATED"; submissionId: string; submissionKey: string }
  | { type: "COMPLETION_REQUESTED" }
  | { type: "SIGN_OFF_REQUESTED" };
export type TrainingExperienceContext = {
  mode: "STAFF" | "PREVIEW";
  assignmentId: string;
  moduleVersionId: string;
  title: string;
  dueDate: string | null;
  completedCheckpointKeys: readonly string[];
  artifactSubmissions?: readonly TrainingArtifactProjection[];
};

export type TrainingArtifactDraft = {
  submissionKey: string;
  kind: "IMAGE";
  file: File;
};

export type TrainingArtifactReceipt = {
  submissionId: string;
  submissionKey: string;
  status: "WAITING_REVIEW";
};

export type TrainingExperienceProps = {
  context: TrainingExperienceContext;
  onSignal: (signal: TrainingExperienceSignal) => void | Promise<void>;
  onArtifactSubmit?: (artifact: TrainingArtifactDraft) => Promise<TrainingArtifactReceipt>;
};
export type TrainingExperienceDefinition = TrainingExperienceRef & {
  title: string;
  summary: string;
  estimatedMinutes: number | null;
  capabilities: readonly string[];
  Component: ComponentType<TrainingExperienceProps>;
};

export type TrainingExperienceResolution =
  | { ok: true; definition: TrainingExperienceDefinition }
  | { ok: false; code: "EXPERIENCE_NOT_REGISTERED" | "EXPERIENCE_CONTRACT_UNSUPPORTED"; message: string };

function identityOf(ref: Pick<TrainingExperienceRef, "experienceKey" | "experienceRevision">) {
  return `${ref.experienceKey}@${ref.experienceRevision}`;
}

function assertDefinition(definition: TrainingExperienceDefinition) {
  if (definition.contractVersion !== TRAINING_EXPERIENCE_CONTRACT_V1) {
    throw new Error(`Unsupported training experience contract: ${definition.contractVersion}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.experienceKey)) {
    throw new Error(`Invalid training experience key: ${definition.experienceKey}`);
  }
  if (!Number.isInteger(definition.experienceRevision) || definition.experienceRevision < 1) {
    throw new Error(`Invalid training experience revision: ${definition.experienceRevision}`);
  }
}

export function createTrainingExperienceRegistry(definitions: readonly TrainingExperienceDefinition[]) {
  const byIdentity = new Map<string, TrainingExperienceDefinition>();
  for (const definition of definitions) {
    assertDefinition(definition);
    const identity = identityOf(definition);
    if (byIdentity.has(identity)) throw new Error(`Duplicate training experience: ${identity}`);
    byIdentity.set(identity, definition);
  }

  return {
    resolve(ref: TrainingExperienceRef): TrainingExperienceResolution {
      if (ref.contractVersion !== TRAINING_EXPERIENCE_CONTRACT_V1) {
        return {
          ok: false,
          code: "EXPERIENCE_CONTRACT_UNSUPPORTED",
          message: `Experience contract ${ref.contractVersion} is not supported by this TOS build.`,
        };
      }
      const definition = byIdentity.get(identityOf(ref));
      if (!definition) {
        return {
          ok: false,
          code: "EXPERIENCE_NOT_REGISTERED",
          message: `Training experience ${identityOf(ref)} is not bundled in this TOS build.`,
        };
      }
      return { ok: true, definition };
    },
    list() {
      return [...byIdentity.values()];
    },
  } as const;
}
