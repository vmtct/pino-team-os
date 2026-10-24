import type { BoContext } from "./bo-model";
import type { BoBrowserViewModuleContract } from "./bo-public-view-browser-runtime";

/** Fail-closed browser role projection. Server-side Core ACL remains authoritative. */
export function studentSharedViewContract(context: BoContext): BoBrowserViewModuleContract | null {
  if (context.surface !== "BO" || context.entitled !== true) return null;
  if (!context.permissionKeys.includes("student.profile.view")) return null;
  return {
    moduleKey: "students",
    allowedFields: ["id", "name", "birth", "paths", "learning", "member", "attention"],
    role: context.permissionKeys.includes("bo.shared_view.manage") ? "manager" : "staff",
  };
}
