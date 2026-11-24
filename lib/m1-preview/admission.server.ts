import type { PreviewSurface } from "./contract";

/**
 * PAP-2342: server decision only. Call AFTER the existing canonical
 * surface authentication and owning feature authorization/Center checks.
 * This is not an authenticator, and never grants live API permissions.
 */
export type PreviewAdmissionInput = {
  environment: string | undefined;
  hostname: string;
  surface: PreviewSurface;
  requested: boolean;
  featureEnabled: boolean;
  authenticated: boolean;
  surfaceAuthorized: boolean;
  featureReviewAuthorized: boolean;
  scopeAuthorized: boolean;
};
export type PreviewAdmission = { allowed: true } | { allowed: false; reason: "disabled" | "unauthenticated" | "forbidden" };
export function decideM1Preview(input: PreviewAdmissionInput): PreviewAdmission {
  if (typeof window !== "undefined") throw new Error("M1 admission must run on the server");
  const host = input.surface === "BO" ? "bo.staging.pinohouse.art" :
    input.surface === "HO" ? "ho.staging.pinohouse.art" : null;
  if (!host || input.environment !== "staging" || input.hostname !== host ||
      input.requested !== true || input.featureEnabled !== true) {
    return { allowed: false, reason: "disabled" };
  }
  if (input.authenticated !== true) return { allowed: false, reason: "unauthenticated" };
  if (input.surfaceAuthorized !== true || input.featureReviewAuthorized !== true || input.scopeAuthorized !== true) {
    return { allowed: false, reason: "forbidden" };
  }
  return { allowed: true };
}
