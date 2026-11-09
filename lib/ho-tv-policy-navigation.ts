/** PAP-1419 · PNR-TV S4: URL owns presentation only, never authorizes a Policy.
 * Distinct query keys avoid colliding with the generic HO workspace's ?record=.
 */
export type TvPolicyPane = "drawer" | "detail";
export type TvPolicyLocation = Readonly<{ policyId: string | null; pane: TvPolicyPane; tab: "overview" | "history" }>;

export function readTvPolicyLocation(search: string): TvPolicyLocation {
  const params = new URLSearchParams(search);
  const policyId = params.get("policy");
  return {
    policyId: policyId?.trim() || null,
    pane: params.get("tvView") === "detail" ? "detail" : "drawer",
    tab: params.get("tvTab") === "history" ? "history" : "overview",
  };
}

export function tvPolicyLocationUrl(href: string, state: TvPolicyLocation): string {
  const url = new URL(href);
  if (state.policyId) url.searchParams.set("policy", state.policyId);
  else url.searchParams.delete("policy");
  if (state.policyId && state.pane === "detail") url.searchParams.set("tvView", "detail");
  else url.searchParams.delete("tvView");
  if (state.policyId && state.pane === "detail" && state.tab === "history")
    url.searchParams.set("tvTab", "history");
  else url.searchParams.delete("tvTab");
  return url.pathname + url.search + url.hash;
}

/** Does not accept client-supplied records: only Core-validated Directory result may be shown. */
export function tvPolicyS4State(
  status: "loading" | "ready" | "denied" | "unavailable",
  hasRecord: boolean,
): "loading" | "ready" | "denied" | "unavailable" | "not-found" {
  if (status !== "ready") return status;
  return hasRecord ? "ready" : "not-found";
}
