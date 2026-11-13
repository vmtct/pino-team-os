import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { OpeningEvidenceStageGate } from "./OpeningEvidenceStageGate";

/** PAP-764 · SCH-OPENING-EVIDENCE / Epic PAP-759.
 * AP FSG1 nav/route scaffold only; no Core read/review contract admitted.
 * This standalone Staging page MUST NOT become a Production route.
 */
export default async function OpeningEvidencePage() {
  const host = (await headers()).get("host")?.toLowerCase().split(":")[0] ?? "";
  if (host !== "bo.staging.pinohouse.art") notFound();
  return <OpeningEvidenceStageGate />;
}
