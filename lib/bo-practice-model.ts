export type BoPracticeFamily = "STARTER" | "JOURNEY" | "SPECIALTY";
export type BoPracticeVersionStatus = "DRAFT" | "PUBLISHED";
export type BoPianoRepertoireClass = "KHOI_HANH" | "HANH_TRINH" | "CHUYEN_DE";

export interface BoPracticeCatalogItem {
  id: string;
  code: string;
  title: string;
  repertoireClass: BoPianoRepertoireClass;
  status: "DRAFT" | "PUBLISHED";
}

export interface BoPracticeCatalogPath {
  id: string;
  code: string;
  displayName: string;
  repertoireItems: BoPracticeCatalogItem[];
}

export interface BoPracticeAuthoringContext {
  paths: BoPracticeCatalogPath[];
}

export interface BoPracticePage {
  id: string;
  versionId: string;
  order: number;
  sheetMediaAssetId: string;
  worksheetMediaAssetId: string | null;
  revision: number;
}

export interface BoPracticeResourceVersion {
  id: string;
  resourceId: string;
  versionNumber: number;
  title: string;
  formatDefinition: typeof PIANO_PRACTICE_FORMAT_V1;
  status: BoPracticeVersionStatus;
  revision: number;
  publishedAt: string | null;
  pages: BoPracticePage[];
}

export interface BoPracticeResourceDetail {
  id: string;
  pathProgramId: string;
  pianoRepertoireItemId: string;
  family: BoPracticeFamily;
  title: string;
  currentPublishedVersionId: string | null;
  revision: number;
  draft: BoPracticeResourceVersion | null;
  currentPublished: BoPracticeResourceVersion | null;
}

export interface BoPracticeCreateCommand {
  title: string;
  family: BoPracticeFamily;
  pathProgramId: string;
  pianoRepertoireItemId: string;
}

export interface BoPracticeDraftPageCommand {
  sheetMediaAssetId: string;
  worksheetMediaAssetId: string | null;
}

export interface BoPracticeMediaUpload {
  mediaAssetId: string;
  fileName: string;
  mimeType: "image/webp" | "image/png" | "image/jpeg";
  byteSize: number;
}

export const PIANO_PRACTICE_FORMAT_V1 = "PIANO_SHEET_176X250_8ROW_V1" as const;

export interface BoPracticeRepertoireAccessGrant {
  id: string;
  studentProfileId: string;
  pianoRepertoireItemId: string;
  validFrom: string;
  validUntilExclusive: string | null;
  grantedByUserId: string;
  grantReason: string;
  grantedAt: string;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revokeReason: string | null;
  createdAt: string;
}

export interface BoPracticeRepertoireAccessContext {
  paths: BoPracticeCatalogPath[];
}
export type BoPracticeEffectiveAccessState = "HIDDEN" | "BASELINE" | "PARTIAL_PREVIEW" | "LOCKED_DISCOVERABLE" | "FULL";
export type BoPracticeCapabilityDecision = "ALLOWED" | "LOCKED" | "HIDDEN";

export interface BoPracticeEffectiveAccess {
  pianoRepertoireItemId: string;
  state: BoPracticeEffectiveAccessState;
  capabilities: Record<string, BoPracticeCapabilityDecision>;
  recommendedAction: "NONE" | "UPGRADE_PREMIUM" | "RENEW_SUBSCRIPTION" | "ADD_SPECIALTY";
  authorityReasons: string[];
}

export interface BoPracticeRepertoireAccessProjection {
  studentProfileId: string;
  pathProgramId: string;
  effectiveAt: string;
  activeGrants: BoPracticeRepertoireAccessGrant[];
  history: BoPracticeRepertoireAccessGrant[];
  effectiveAccess: BoPracticeEffectiveAccess[];
}

export interface BoPracticeRepertoireGrantCommand {
  studentProfileId: string;
  pianoRepertoireItemId: string;
  validFrom?: string;
  validUntilExclusive?: string | null;
  grantReason: string;
}
