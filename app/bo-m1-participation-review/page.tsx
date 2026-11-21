import { notFound } from "next/navigation";
import { isPap2242M1LocalReviewEnabled } from "@/lib/pap2242-m1-local-review";
import { Pap2242ParticipationReview } from "./review";

export default function Page() {
  if (!isPap2242M1LocalReviewEnabled()) notFound();
  return <Pap2242ParticipationReview />;
}
