// PAP-2192 / PLT-ACCESS — UI fixtures only. Never a Core role or assignment.
import type { BoAccessPermission } from "@/lib/bo-access-model";
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

// These are synthetic catalog examples, not live grants or a complete Core catalog.
type Example=BoAccessPermission & {applicablePlatforms:("BO"|"TOS")[]};
const example=(key:string,domain:string,displayLabel:string,surface:"BO"|"TOS",kind:"read"|"mutation",scope:Example["allowedScopes"]):Example=>({key:"fixture."+key,domain,displayLabel,description:"M1 synthetic example",accessKind:kind,surfaceApplicability:surface,applicablePlatforms:[surface],allowedScopes:scope,contextualPolicy:null});
export const rolePreviewCatalog=[
 example("student.view","Student","Xem học viên","BO","read",["CENTER"]),
 example("student.edit","Student","Chỉnh sửa học viên","BO","mutation",["CENTER"]),
 example("enrollment.view","Enrollment","Xem ghi danh","BO","read",["CENTER"]),
 example("schedule.view","Schedule","Xem lịch học","BO","read",["CENTER"]),
 example("class.view","Class","Xem lớp học","TOS","read",["RUNNING_CLASS"]),
 example("class.attendance","Class","Điểm danh","TOS","mutation",["RUNNING_CLASS"]),
 example("mission.view","Mission","Xem nhiệm vụ","TOS","read",["CENTER","PATH"]),
 example("mission.complete","Mission","Hoàn thành nhiệm vụ","TOS","mutation",["RUNNING_CLASS"]),
];

// Route selection only, not authorization. A real record never enters the mock provider.
export function roleReviewRoute(query:{m1Preview?:string|string[];record?:string|string[]}):"live"|"preview"|"invalid" {
  if(query.m1Preview!==undefined&&query.m1Preview!=="1")return "invalid";
  if(query.record===undefined)return "preview";
  if(typeof query.record!=="string")return "invalid";
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.record))
    return query.m1Preview===undefined?"live":"invalid";
  return /^ROLE-MOCK-[0-9]{3,}$/.test(query.record)?"preview":"invalid";
}
