export type BoWebCmsSite = "PINOHOUSE" | "TOPPI" | "AFTERWORK";
export type BoWebCmsLocale = "vi" | "en";
export type BoWebCmsKind = "HEADING" | "BODY" | "LABEL" | "CTA_LABEL" | "SEO_TITLE" | "SEO_DESCRIPTION" | "IMAGE";

export type BoWebCmsTextValue = {
  type: "TEXT";
  values: { vi: string | null; en: string | null };
};

export type BoWebCmsImageValue = {
  type: "IMAGE";
  mediaAssetId: string;
  alt: { vi: string; en: string };
};

export type BoWebCmsValue = BoWebCmsTextValue | BoWebCmsImageValue;

export interface BoWebCmsSlotSummary {
  id: string;
  site: BoWebCmsSite;
  page: string;
  key: string;
  kind: BoWebCmsKind;
  status: "ACTIVE" | "RETIRED";
  currentRevision: number;
  sourceFallback: BoWebCmsValue;
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
}

export interface BoWebCmsRevision {
  id: string;
  slotId: string;
  revision: number;
  state: "DRAFT" | "PUBLISHED";
  value: BoWebCmsValue;
  rollbackSourceRevisionId: string | null;
  createdAt: string;
  createdByUserId: string;
  publishedAt: string | null;
}

export interface BoWebCmsSlotDetail extends BoWebCmsSlotSummary {
  draft: BoWebCmsRevision | null;
  published: BoWebCmsRevision | null;
}

export const BO_WEB_CMS_SITES: Array<{ id: BoWebCmsSite; label: string }> = [
  { id: "PINOHOUSE", label: "PINO House" },
  { id: "TOPPI", label: "Toppi" },
  { id: "AFTERWORK", label: "Afterwork" },
];