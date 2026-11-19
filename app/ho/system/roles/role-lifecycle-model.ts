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

/** Bind the confirmation to the exact identity and version the operator reviewed. */
export function matchesArchiveConfirmation(reviewed: RoleCandidate, current: RoleCandidate): boolean {
  return canArchiveRole(reviewed) && canArchiveRole(current) && reviewed.id === current.id &&
    reviewed.roleKey === current.roleKey && reviewed.updatedAt === current.updatedAt;
}

/** A fulfilled command alone is not a verified archive. Require a fresh persisted Detail projection. */
export function verifyArchivedRole(reviewed: RoleCandidate, receipt: unknown): boolean {
  if (!canArchiveRole(reviewed) || !receipt || typeof receipt !== "object" || Array.isArray(receipt)) return false;
  const r = receipt as Record<string, unknown>;
  return r.id === reviewed.id && r.roleKey === reviewed.roleKey && r.roleType === "custom" &&
    r.status === "archived" && r.assignmentCount === 0 && typeof r.updatedAt === "string" &&
    Date.parse(r.updatedAt) > Date.parse(reviewed.updatedAt);
}

export type ExpiryReview = ExpiryDraft & { staffId: string };
export function matchesExpiryConfirmation(reviewed: ExpiryReview, current: ExpiryReview, roles: readonly RoleOption[], centers: readonly RoleOption[]): boolean {
  return !!reviewed.staffId && reviewed.staffId === current.staffId && reviewed.roleId === current.roleId &&
    reviewed.centerId === current.centerId && reviewed.minutes === current.minutes && validExpiryDraft(current, roles, centers);
}

/** Presentation contract only: the supplied independently read receipt must match the reviewed finite interval. */
export function verifyTemporaryAssignment(reviewed: ExpiryReview, receipt: unknown): boolean {
  if (!reviewed.staffId || !reviewed.roleId || !reviewed.centerId || !QA_MINUTES.includes(reviewed.minutes) ||
    !receipt || typeof receipt !== "object" || Array.isArray(receipt)) return false;
  const r = receipt as Record<string, unknown>;
  if (typeof r.assignmentId !== "string" || !r.assignmentId.trim() || r.staffId !== reviewed.staffId ||
      r.roleId !== reviewed.roleId || r.scopeType !== "CENTER" || r.scopeId !== reviewed.centerId ||
      r.status !== "active" || typeof r.effectiveFrom !== "string" || typeof r.effectiveUntil !== "string") return false;
  const from = Date.parse(r.effectiveFrom), until = Date.parse(r.effectiveUntil);
  return Number.isFinite(from) && Number.isFinite(until) && until - from === reviewed.minutes * 60000;
}
