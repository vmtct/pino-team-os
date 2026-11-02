import type { BoWorkforcePlanningBootstrap, BoWorkforceWeeklyPlanning } from "@/lib/bo-model";

export type GlobalWeekResult = Pick<BoWorkforcePlanningBootstrap, "terms" | "termWeeks">;

async function readAuthorized<T>(path: string, fetcher: typeof fetch = fetch): Promise<T> {
  const response = await fetcher("/api/bo/" + path, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error("Workforce API read failed: HTTP " + response.status);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("data" in body) || (body as { data?: unknown }).data == null) {
    throw new Error("Invalid Workforce API response");
  }
  return (body as { data: T }).data;
}
export const workforceRead = {
  bootstrap: (fetcher?: typeof fetch) => readAuthorized<BoWorkforcePlanningBootstrap>("workforce/planning/bootstrap", fetcher),
  globalWeeks: (centerId: string, fetcher?: typeof fetch) =>
    readAuthorized<GlobalWeekResult>("workforce/planning/global-weeks?centerId=" + encodeURIComponent(centerId), fetcher),
  weekly: (centerId: string, termWeekId: string, fetcher?: typeof fetch) =>
    readAuthorized<BoWorkforceWeeklyPlanning>("workforce/planning/weekly?centerId=" + encodeURIComponent(centerId) + "&termWeekId=" + encodeURIComponent(termWeekId), fetcher),
};
