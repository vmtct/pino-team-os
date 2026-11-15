import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { OpeningEvidenceStageGate } from "./OpeningEvidenceStageGate";

/** PAP-764 · SCH-OPENING-EVIDENCE / Epic PAP-759.
 * Native DSA candidate; exact staging-only host and layout admission. Core reauthorizes all data.
 */
export default async function OpeningEvidencePage() {
  const host = (await headers()).get("host")?.toLowerCase().split(":")[0] ?? "";
  if (host !== "bo.staging.pinohouse.art") notFound();
  return <OpeningEvidenceStageGate />;
}
