// PAP-2192 / PLT-ACCESS — UI fixtures only. Never a Core role or assignment.
import type { PreviewFeature, PreviewRecord } from "@/lib/m1-preview/contract";
import { roleCreateInput, type RoleDraft } from "./role-lifecycle-model";
type CatalogPermission = {key:string; applicablePlatforms?: readonly string[] | null; surfaceApplicability:string; allowedScopes:readonly string[]};
// One catalog, independent of assignment audience. Preserve the existing BO/TOS
// scope fence; platform chips are presentation filters, not role attributes.
export function eligiblePermissions<T extends CatalogPermission>(catalog:readonly T[]):T[] {
  return catalog.filter(p=>Array.isArray(p.applicablePlatforms)&&(
    (p.applicablePlatforms.includes("BO")&&(p.surfaceApplicability==="BO"||p.surfaceApplicability==="BOTH")&&p.allowedScopes.includes("CENTER"))||
    (p.applicablePlatforms.includes("TOS")&&(p.surfaceApplicability==="TOS"||p.surfaceApplicability==="BOTH")&&p.allowedScopes.some(scope=>scope==="CENTER"||scope==="PATH"||scope==="RUNNING_CLASS"))));
}
export type PreviewRole = PreviewRecord & {
  roleKey: string; name: string; description: string; roleType: "custom";
  status: "active" | "archived"; permissionKeys: string[]; assignmentCount: number;
};
export const roleM1: PreviewFeature<PreviewRole> = {
  feature: "HO-ROLES", jiraTask: "PAP-2192", surface: "HO", idPrefix: "ROLE-MOCK-",
  operations: ["create", "replace"],
  seed: { id: "ROLE-MOCK-001", fixture: true, createdAt: null, createdBy: null,
    updatedAt: null, updatedBy: null, roleKey: "demo-role", name: "Vai trò mẫu",
    description: "Dữ liệu xem trước", roleType: "custom", status: "active",
    permissionKeys: [], assignmentCount: 0 },
};
export function makePreviewRole(draft: RoleDraft, selected: readonly string[], catalog: readonly CatalogPermission[]): Omit<PreviewRole,"id"> | null {
  const input = roleCreateInput(draft);
  if (!input || selected.some(key => !eligiblePermissions(catalog).some(p=>p.key===key))) return null;
  return { fixture: true, createdAt: null, createdBy: null, updatedAt: null, updatedBy: null,
    roleKey: input.roleKey, name: input.displayName, description: input.description ?? "",
    roleType: "custom", status: "active", permissionKeys: [...new Set(selected)].sort(), assignmentCount: 0 };
}
export function archivePreviewRole(role: PreviewRole): PreviewRole | null {
  return role.fixture && role.id.startsWith(roleM1.idPrefix) && role.status === "active" && role.assignmentCount === 0
    ? { ...role, status: "archived" } : null;
}
