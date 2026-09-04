export type TrainingLesson = {
  key: string;
  title: string;
  kind: "READ" | "CHECKLIST" | "QUIZ";
  estimatedMinutes: number | null;
};

export type TrainingModuleVersion = {
  id: string;
  moduleId: string;
  versionNumber: number;
  status: "DRAFT" | "PUBLISHED";
  title: string;
  summary: string | null;
  track: string | null;
  lessons: TrainingLesson[];
  assessmentThreshold: number | null;
  requiresSignoff: boolean;
  qualificationCode: string | null;
  policyReference: string | null;
  revision: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type TrainingModule = {
  id: string;
  moduleKey: string;
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
  createdAt: string;
  updatedAt: string;
  versions: TrainingModuleVersion[];
};

export type TrainingAssignment = {
  id: string;
  staffMemberId: string;
  moduleVersionId: string;
  status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETION_PENDING" | "COMPLETED";
  dueDate: string | null;
  assignmentReason: string;
  assignedAt: string;
  completedAt: string | null;
  updatedAt: string;
};

export type StaffQualification = {
  id: string;
  staffMemberId: string;
  qualificationCode: string;
  sourceAssignmentId: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  grantedAt: string;
  expiresAt: string | null;
};
export type TrainingAssignmentDetail = {
  assignment: TrainingAssignment;
  version: TrainingModuleVersion;
  completedLessonKeys: string[];
  latestAssessment: { score: number; passed: boolean; attemptedAt: string } | null;
  signOff: { signedOffByUserId: string; note: string | null; signedOffAt: string } | null;
  qualification: StaffQualification | null;
};

export type TrainingSelfProjection = {
  assignments: TrainingAssignmentDetail[];
  qualifications: StaffQualification[];
};

export type TrainingDraftInput = {
  title: string;
  summary?: string | null;
  track?: string | null;
  lessons: TrainingLesson[];
  assessmentThreshold?: number | null;
  requiresSignoff?: boolean;
  qualificationCode?: string | null;
  policyReference?: string | null;
};
