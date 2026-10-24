import type { BoContext } from "./bo-model";
import type { BoViewRole } from "./bo-public-view-state";

/**
 * Read-only capabilities stay read-only. The server remains the authority for
 * individual Core view operations; a browser role is only a UI affordance.
 */
export function boPublicViewActorRole(context: BoContext | null | undefined, moduleReadPermission: string): BoViewRole | null {
  if (!context || context.surface !== "BO" || context.entitled !== true || !Array.isArray(context.permissionKeys)) return null;
  if (!context.permissionKeys.includes(moduleReadPermission)) return null;
  return context.permissionKeys.includes("bo.shared_view.manage") ? "manager" : "staff";
}
