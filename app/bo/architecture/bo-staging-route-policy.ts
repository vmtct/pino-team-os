/** PAP-901: explicit UI-only staging admission for canonical BO module routes. */
export const boStagingAdmittedRoutes = new Set([
  "/bo/missions",
  "/bo/bills",
  "/bo/workforce-shift-plans",
  "/bo/workforce-availability",
  "/bo/workforce-assignments",
  "/bo/payroll-periods",
  "/bo/pinoria-avatars",
  "/bo/open-studio-passes",
  "/bo/classroom-diaries",
  // PAP-764 / Epic PAP-759: S1 Staging-only navigation; Core read/review not admitted.
  "/bo/opening-evidence",
]);

// New canonical modules must be admitted or deliberately deferred in this policy.
export const boStagingDeferredRoutes = new Set<string>([]);

export function isBoStagingRouteAdmitted(path: string): boolean {
  return boStagingAdmittedRoutes.has(path);
}
