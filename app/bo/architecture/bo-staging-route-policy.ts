/** PAP-901: explicit UI-only staging admission for canonical BO module routes. */
export const boStagingAdmittedRoutes = new Set([
  "/bo/workforce-shift-plans",
  "/bo/workforce-availability",
  "/bo/workforce-assignments",
]);

// New canonical modules must be admitted or deliberately deferred in this policy.
export const boStagingDeferredRoutes = new Set<string>([]);

export function isBoStagingRouteAdmitted(path: string): boolean {
  return boStagingAdmittedRoutes.has(path);
}
