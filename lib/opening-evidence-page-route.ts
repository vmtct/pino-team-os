import type { OpeningEvidenceRow, SubjectType } from "./bo-opening-evidence-api";

/** PAP-1999 / PAP-759: browser paths are lowercase; API subjects remain uppercase. */
export function openingEvidencePageSubject(value: string): SubjectType | null {
  if (value === "class" || value === "CLASS") return "CLASS";
  if (value === "reception" || value === "RECEPTION") return "RECEPTION";
  return null;
}

export function openingEvidencePageHref(row: Pick<OpeningEvidenceRow, "subjectType" | "openingReceiptId" | "centerId">): string {
  return "/bo/opening-evidence/" + row.subjectType.toLowerCase() + "/" + encodeURIComponent(row.openingReceiptId) + "?centerId=" + encodeURIComponent(row.centerId);
}
