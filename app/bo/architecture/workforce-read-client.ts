import type { BoWorkforcePlanningBootstrap, BoWorkforceWeeklyPlanning } from "@/lib/bo-model";

export type GlobalWeekResult = Pick<BoWorkforcePlanningBootstrap, "terms" | "termWeeks">;

async function readAuthorized<T>(path: string): Promise<T> {
  const response = await fetch("/api/bo/" + path, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error("Workforce API read failed: HTTP " + response.status);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("data" in body) || (body as { data?: unknown }).data == null) {
    throw new Error("Invalid Workforce API response");
  }
  return (body as { data: T }).data;
}
export const workforceRead = {
  bootstrap: () => readAuthorized<BoWorkforcePlanningBootstrap>("workforce/planning/bootstrap"),
  globalWeeks: (centerId: string) =>
    readAuthorized<GlobalWeekResult>("workforce/planning/global-weeks?centerId=" + encodeURIComponent(centerId)),
  weekly: (centerId: string, termWeekId: string) =>
    readAuthorized<BoWorkforceWeeklyPlanning>("workforce/planning/weekly?centerId=" + encodeURIComponent(centerId) + "&termWeekId=" + encodeURIComponent(termWeekId)),
};
