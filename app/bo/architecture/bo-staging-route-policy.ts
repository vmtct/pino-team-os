import {openingEvidenceBoModule} from "@/lib/opening-evidence-host-contract";
import {nativePayrollModule} from "@/lib/bo-native-payroll-route";
/** PAP-901: explicit UI-only staging admission for canonical BO module routes. */
export const boStagingAdmittedRoutes = new Set([
  "/bo/running-classes",
  "/bo/missions",
  "/bo/parents",
  "/bo/workforce/staffs",
  "/bo/bills",
  "/bo/workforce-shift-plans",
  "/bo/workforce-availability",
  "/bo/workforce-assignments",
  "/bo/workforce/timekeeping",
  "/bo/payroll-periods",
  "/bo/payroll-daily",
  "/bo/payroll-exceptions",
  "/bo/pinoria-avatars",
  "/bo/afterschool-accounts",
  "/bo/open-studio-passes",
  "/bo/classroom-diaries",
  "/bo/piner-posts",
  "/bo/sales/leads",

  "/bo/guests",
  "/bo/mytime-workshops",
  "/bo/enrollments",
  "/bo/opening-evidence",
  "/bo/pinoria-wish-events",
]);

// New canonical modules must be admitted or deliberately deferred in this policy.
export const boStagingDeferredRoutes = new Set<string>([]);

export function isBoStagingRouteAdmitted(path: string): boolean {
  const native=nativePayrollModule(path)??openingEvidenceBoModule(path);
  return boStagingAdmittedRoutes.has(path) || Boolean(native && boStagingAdmittedRoutes.has("/bo/"+native));
}
