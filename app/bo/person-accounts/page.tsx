import { notFound } from "next/navigation";
import { PersonAccounts } from "./PersonAccounts";

// PAP-2211 · Person-linked Piner User — local synthetic M1 only.
export default function PersonAccountsPage() {
  if (process.env.NODE_ENV !== "development" || process.env.PAP2211_PERSON_PREVIEW !== "1") notFound();
  return <PersonAccounts />;
}
