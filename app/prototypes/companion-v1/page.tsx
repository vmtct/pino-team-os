import { notFound } from "next/navigation";
import { CompanionV1Prototype } from "@/app/bo/pinoria-companions/prototype/CompanionV1Prototype";

export const dynamic = "force-dynamic";

export default function CompanionV1LocalPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CompanionV1Prototype />;
}
