import type {BoAccessRoleDetail} from "@/lib/bo-access-model";

type Wanted = {displayName:string;description:string|null;permissionKeys:readonly string[];expectedUpdatedAt:string};

/** PAP-2373: verification of the existing editor's readback, not a write or permission gate. */
export function verifiedExistingRoleEdit(current:BoAccessRoleDetail,wanted:Wanted,actual:BoAccessRoleDetail):boolean {
 const before=Date.parse(current.updatedAt),after=Date.parse(actual.updatedAt);
 if(current.roleType!=="custom"||current.status!=="active"||current.roleKey.toLowerCase()==="founder"
  || actual.id!==current.id||actual.roleKey!==current.roleKey||actual.createdAt!==current.createdAt
  || actual.roleType!=="custom"||actual.status!=="active"||wanted.expectedUpdatedAt!==current.updatedAt
  || !Number.isFinite(before)||!Number.isFinite(after)||after<=before
  || actual.displayName!==wanted.displayName||(actual.description?.trim()||null)!==wanted.description
  || !Array.isArray(actual.permissionKeys)||!actual.permissionKeys.every(k=>typeof k==="string")
  || new Set(actual.permissionKeys).size!==actual.permissionKeys.length
  || new Set(wanted.permissionKeys).size!==wanted.permissionKeys.length
  || actual.permissionCount!==actual.permissionKeys.length
  || !Number.isSafeInteger(actual.assignmentCount)||actual.assignmentCount<0)return false;
 return JSON.stringify([...actual.permissionKeys].sort())===JSON.stringify([...wanted.permissionKeys].sort());
}
