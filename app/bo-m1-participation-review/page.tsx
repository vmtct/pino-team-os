import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/bo-authority-source/styles.css";
import { notFound } from "next/navigation";
import { isPap2242M1LocalReviewEnabled } from "@/lib/pap2242-m1-local-review";
import { Pap2242ParticipationReview } from "./review";

export default function Page() {
  if (!isPap2242M1LocalReviewEnabled()) notFound();
  return <><link rel="stylesheet" href="/bo-legacy-foundation.css" /><Pap2242ParticipationReview /></>;
}
