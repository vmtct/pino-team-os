import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { OpeningEvidenceStageGate } from "./OpeningEvidenceStageGate";

/** PAP-764 · SCH-OPENING-EVIDENCE / Epic PAP-759.
 * AP_PREP_ONLY: dormant route scaffold until registered BO TDD/Core adapter.
 * Not admitted into Staging or Production navigation; never bypass BO route policy.
 */
export default async function OpeningEvidencePage() {
  const host = (await headers()).get("host")?.toLowerCase().split(":")[0] ?? "";
  if (host !== "bo.staging.pinohouse.art") notFound();
  return <OpeningEvidenceStageGate />;
}
