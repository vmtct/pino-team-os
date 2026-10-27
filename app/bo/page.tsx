import { redirect } from "next/navigation";
import { BO_SIDEBAR_MODULES } from "@/lib/bo-sidebar-routes";
import { BoRuntimeEntry } from "./components/registration/BoRuntimeBoundary";

export default async function BoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const options = Object.fromEntries(["centerId", "from", "to"].flatMap(key => typeof query[key] === "string" ? [[key, query[key]]] : []));
  if (query.module !== undefined && (typeof query.module !== "string" || !BO_SIDEBAR_MODULES.includes(query.module))) redirect("/bo");
  // Existing bookmarks and unified BO nav must reach the approved S1/S2
  // Subscription app, not the legacy generic "Create Subscriptions" form.
  if (query.module === "subscriptions") redirect("/bo/subscriptions");
  return <BoRuntimeEntry moduleKey={typeof query.module === "string" ? query.module : "students"} options={options} />;
}
