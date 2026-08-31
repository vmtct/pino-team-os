export type BoPracticeFamily = "STARTER" | "JOURNEY" | "SPECIALTY";
export type BoPracticeLifecycle = "DRAFT" | "PUBLISHED";

export interface BoPracticePage {
  id: string;
  order: number;
  sheetMediaRef: string;
  worksheetMediaRef: string | null;
  sheetPreviewUrl?: string | null;
  worksheetPreviewUrl?: string | null;
}

export interface BoPracticeDraft {
  id: string;
  version: number;
  revision: number;
  pages: BoPracticePage[];
}

export interface BoPracticePublishedVersion {
  id: string;
  version: number;
  publishedAt: string;
  pages?: BoPracticePage[];
}

export interface BoPracticeResourceSummary {
  id: string;
  title: string;
  family: BoPracticeFamily;
  pathId: string | null;
  contextKey: string | null;
  formatDefinitionKey: string;
  lifecycle: BoPracticeLifecycle;
  draftVersion: number | null;
  publishedVersion: number | null;
  updatedAt: string;
}

export interface BoPracticeResourceDetail extends BoPracticeResourceSummary {
  draft: BoPracticeDraft | null;
  currentPublished: BoPracticePublishedVersion | null;
}

export interface BoPracticeCreateCommand {
  title: string;
  family: BoPracticeFamily;
  pathId: string | null;
  contextKey: string | null;
  formatDefinitionKey: string;
}

export interface BoPracticeDraftPageCommand {
  id?: string;
  order: number;
  sheetMediaRef: string;
  worksheetMediaRef: string | null;
}

export interface BoPracticeSaveDraftCommand extends BoPracticeCreateCommand {
  expectedRevision: number;
  pages: BoPracticeDraftPageCommand[];
}
export interface BoPracticePublishCommand {
  expectedRevision: number;
}

export interface BoPracticeMediaUpload {
  mediaRef: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  previewUrl?: string | null;
}

export const PIANO_PRACTICE_FORMAT_V1 = "PIANO_SHEET_176X250_8ROW_V1" as const;
