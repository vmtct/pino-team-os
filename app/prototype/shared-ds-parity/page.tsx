import { notFound } from "next/navigation";
import SharedDsConsumerClient from "./SharedDsConsumerClient";

/**
 * PAP-1117: development-only local probe for a pinned shared DS release.
 * No Core/user requests and no public/staging route admission.
 */
export default function SharedDsParityPreview() {
  if (process.env.NODE_ENV !== "development" || process.env.PAP1117_SHARED_DS_LOCAL_PREVIEW !== "true") notFound();
  return <SharedDsConsumerClient />;
}
