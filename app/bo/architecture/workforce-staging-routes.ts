/** PAP-901 narrow staging admission: never unlock unrelated BO routes. */
export const workforceBoStagingRoutes = new Set([
  "/bo/workforce-term-weeks",
  "/bo/workforce-shift-plans",
  "/bo/workforce-availability",
  "/bo/workforce-assignments",
]);
export function isWorkforceBoStagingRoute(path: string): boolean {
  return workforceBoStagingRoutes.has(path);
}
