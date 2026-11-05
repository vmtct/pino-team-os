/**
 * PAP-1074: fail-closed, READ-ONLY G4 runner admission.
 * Runtime proof still requires authenticated Playwright + trusted live Worker receipt.
 */
const SHA = /^[0-9a-f]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATE = /\.json$/i;
export const G4_BO_ORIGIN = "https://bo.staging.pinohouse.art";
export const G4_HO_ORIGIN = "https://ho.staging.pinohouse.art";

export type G4RunnerEnv = {
  TDD_G4_RUN?: string;
  TDD_G4_EXPECTED_MAIN_SHA?: string;
  TDD_G4_SERVING_SHA?: string;
  TDD_G4_MAIN_CI_RUN?: string;
  TDD_G4_STAGING_CD_RUN?: string;
  TDD_G4_FOUNDER_STATE?: string;
  TDD_G4_MANAGER_STATE?: string;
  TDD_G4_SUBSCRIPTION_ID?: string;
};

export function validateG4RunnerEnv(env: G4RunnerEnv): string[] {
  const errors: string[] = [];
  if (env.TDD_G4_RUN !== "1") errors.push("explicit TDD_G4_RUN=1 required");
  if (!SHA.test(env.TDD_G4_EXPECTED_MAIN_SHA ?? "")) errors.push("full immutable 40-character main SHA required");
  if (!SHA.test(env.TDD_G4_SERVING_SHA ?? "")) errors.push("independently checked live Worker serving SHA required");
  if (env.TDD_G4_EXPECTED_MAIN_SHA !== env.TDD_G4_SERVING_SHA) errors.push("stale Worker: serving SHA does not equal main SHA");
  if (!/^[1-9][0-9]+$/.test(env.TDD_G4_MAIN_CI_RUN ?? "")) errors.push("main CI run receipt required");
  if (!/^[1-9][0-9]+$/.test(env.TDD_G4_STAGING_CD_RUN ?? "")) errors.push("guarded Staging CD receipt required");
  for (const name of ["TDD_G4_FOUNDER_STATE", "TDD_G4_MANAGER_STATE"] as const) {
    const file = env[name];
    if (!file || !STATE.test(file) || file.includes("://") || file.includes("\n")) errors.push(name + " must be an existing private local .json storageState path");
  }
  if (env.TDD_G4_FOUNDER_STATE && env.TDD_G4_FOUNDER_STATE === env.TDD_G4_MANAGER_STATE) errors.push("Founder and Manager must have distinct storage states");
  if (!UUID.test(env.TDD_G4_SUBSCRIPTION_ID ?? "")) errors.push("authorized existing Staging Subscription UUID required");
  return errors;
}

/** The profile has immutable staging-only hosts, never caller-provided URLs. */
export function g4SubscriptionUrl(id: string, tab: "overview" | "enrollment" | "history" = "overview"): string {
  if (!UUID.test(id)) throw new Error("invalid G4 Staging Subscription ID");
  const url = new URL("/bo?module=subscriptions", G4_BO_ORIGIN);
  url.searchParams.set("record", id);
  if (tab !== "overview") url.searchParams.set("tab", tab);
  return url.toString();
}
