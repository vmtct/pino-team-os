import {notFound} from "next/navigation";
import {allowPap938LocalPreview} from "./preview-gate";
import TosVNextIntegrationClient from "./TosVNextIntegrationClient";

export const dynamic = "force-dynamic";

/** PAP-938: hard-off on any production build, even when local flag is set. */
export default function Pap938LocalIntegrationPreviewPage() {
 if (!allowPap938LocalPreview(process.env)) notFound();
 return <TosVNextIntegrationClient />;
}
