import type { BoContext } from "./bo-model";
import type { BoViewRole } from "./bo-public-view-state";

/** PAP-879: never infer manage rights from email, job title, or BO access alone. */
export function authorizedPublicViewRole(
  context: BoContext,
  permission: { readKey: string; manageKey: string },
): BoViewRole | null {
  if (context.surface !== "BO" || context.entitled !== true ||
      !Array.isArray(context.permissionKeys) ||
      !permission.readKey || !permission.manageKey) return null;
  if (!context.permissionKeys.includes(permission.readKey)) return null;
  return context.permissionKeys.includes(permission.manageKey) ? "manager" : "staff";
}
