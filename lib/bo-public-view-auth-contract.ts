import type { BoContext } from "./bo-model";
import type { BoViewRole } from "./bo-public-view-state";

/** Fail-closed BO Shared Views UI role projection. Core must independently enforce every request. */
export function authorizedBoSharedViewRole(
  context: Pick<BoContext, "surface" | "entitled" | "permissionKeys"> | null | undefined,
  moduleReadPermission: string,
): BoViewRole | null {
  if (!context || context.surface !== "BO" || context.entitled !== true ||
      !Array.isArray(context.permissionKeys) || !moduleReadPermission) return null;
  const keys = new Set(context.permissionKeys);
  if (!keys.has(moduleReadPermission)) return null;
  return keys.has("bo.shared_view.manage") ? "manager" : "staff";
}

/** Only Core-registered pilot modules may be mounted. Classes remain denied pending read ACL. */
export const BO_PILOT_PUBLIC_VIEW_CONTRACT = {
  students: { moduleKey: "students", readPermission: "student.profile.view",
    allowedFields: ["id", "name", "birth", "paths", "learning", "member", "attention"] },
} as const;
