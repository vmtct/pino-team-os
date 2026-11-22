import { notFound } from "next/navigation";
import { PersonAccounts } from "@/app/bo/person-accounts/PersonAccounts";

export const dynamic = "force-dynamic";

// PAP-2211 · local synthetic M1 preview. Never admit this route outside local development.
export default function PersonAccountsPreviewPage() {
  const stylesheetUrl = process.env.PAP2211_PERSON_PREVIEW_CSS_URL;
  if (process.env.NODE_ENV !== "development" || process.env.PAP2211_PERSON_PREVIEW !== "1" || !stylesheetUrl) {
    notFound();
  }

  return (
    <>
      <link rel="stylesheet" href={stylesheetUrl} />
      <main data-pap-task="PAP-2211" data-preview="synthetic-only">
        <PersonAccounts localPreview />
      </main>
    </>
  );
}
