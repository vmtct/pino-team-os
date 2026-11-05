import { boSkeletonEnabled } from "./bo-skeleton";

/** S7 staging Parent pilot only, never a grant; Core and BO independently reauthorize. */
export function boParentTddPilotAllowed(
  env: { APP_ENV?: string; BO_UI_ONLY?: string },
  host: string,
  moduleKey: string,
  pilot: unknown,
): boolean {
  return moduleKey === "parents" && pilot === "tdd" && boSkeletonEnabled(env, host);
}
