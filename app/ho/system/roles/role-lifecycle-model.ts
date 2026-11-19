// PAP-2192: presentation validation only; Core and the authenticated HO boundary remain authoritative.
export interface RoleCandidate { id: string; roleKey: string; roleType: "system" | "custom"; status: "active" | "archived"; assignmentCount: number; updatedAt: string }
export interface RoleDraft { roleKey: string; displayName: string; description: string }
export type RoleCreateInput = { roleKey: string; displayName: string; description: string | null; permissionKeys: string[] };
export function roleCreateInput(draft: RoleDraft): RoleCreateInput | null {
  const roleKey = draft.roleKey.trim().toLowerCase();
  const displayName = draft.displayName.trim();
  const description = draft.description.trim();
  if (!/^[a-z][a-z0-9_-]{2,79}$/.test(roleKey) || roleKey === "founder" || !displayName || displayName.length > 120 || description.length > 500) return null;
  return { roleKey, displayName, description: description || null, permissionKeys: [] };
}
export function canArchiveRole(role: RoleCandidate): boolean {
  return role.roleType === "custom" && role.roleKey !== "founder" && role.status === "active" && role.assignmentCount === 0 && Number.isFinite(Date.parse(role.updatedAt));
}
export const QA_MINUTES = [15, 30, 60, 120] as const;
export type QaMinutes = typeof QA_MINUTES[number];
export interface RoleOption { id: string; label: string }
export interface ExpiryDraft { roleId: string; centerId: string; minutes: QaMinutes }
export function validExpiryDraft(draft: ExpiryDraft, roles: readonly RoleOption[], centers: readonly RoleOption[]): boolean {
  return roles.some(role => role.id === draft.roleId) && centers.some(center => center.id === draft.centerId) && QA_MINUTES.includes(draft.minutes);
}



/** Only a persisted readback matching the identity-only contract may report success. */
export function verifyCreatedRole(input:RoleCreateInput,receipt:unknown):boolean {
 if(!receipt||typeof receipt!=="object"||Array.isArray(receipt))return false;
 const r=receipt as Record<string,unknown>;
 return typeof r.id==="string"&&r.id.trim().length>0&&r.roleKey===input.roleKey&&r.displayName===input.displayName&&
 r.description===input.description&&r.roleType==="custom"&&r.status==="active"&&r.permissionCount===0&&r.assignmentCount===0&&
 Array.isArray(r.permissionKeys)&&r.permissionKeys.length===0;
}
