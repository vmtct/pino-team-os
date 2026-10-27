/** PAP-901: explicit UI-only staging admission for canonical BO module routes. */
export const boStagingAdmittedRoutes = new Set([
  "/bo/workforce-shift-plans",
  "/bo/workforce-availability",
  "/bo/workforce-assignments",
  "/bo/payroll-periods",
  // PAP-1034: authorized standalone commercial UI; unlike workforce routes,
  // this is NOT a managed registry table adapter. Its server page owns Core API wiring.
  "/bo/subscriptions",
]);

// New canonical modules must be admitted or deliberately deferred in this policy.
export const boStagingDeferredRoutes = new Set<string>([]);

export function isBoStagingRouteAdmitted(path: string): boolean {
  return boStagingAdmittedRoutes.has(path);
}
