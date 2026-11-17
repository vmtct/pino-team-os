/** PAP-1768 — Parent Center multi-select F1, Epic PAP-1384 SCH-PARENTS-GUARDIANS.
 * This pure presentation state never constructs grants or writes data.
 */
export type ParentCenterOption = Readonly<{
  centerId: string; centerName: string; direct: boolean;
  inherited: boolean; selected: boolean;
}>;
export type ParentCenterVerified = Readonly<{
  parentId: string; selectedCenterId: string;
  centers: readonly ParentCenterOption[];
}>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireValue(ok: boolean, reason: string): asserts ok {
  if (!ok) throw new Error("PAP1768_PARENT_CENTER_F1_" + reason);
}
export function validateParentCenterRead(raw: ParentCenterVerified): ParentCenterVerified {
  requireValue(!!raw && uuid.test(raw.parentId) && uuid.test(raw.selectedCenterId), "INVALID_ACTOR_OR_SCOPE");
  requireValue(Array.isArray(raw.centers) && raw.centers.length > 0 && raw.centers.length <= 50, "UNBOUNDED_CENTERS");
  const known=new Set<string>();
  for (const c of raw.centers) {
    requireValue(uuid.test(c.centerId) && typeof c.centerName === "string" &&
      c.centerName.trim().length > 0 && c.centerName.length <= 160,
      "INVALID_CENTER_OPTION");
    requireValue(!known.has(c.centerId), "DUPLICATE_CENTER");
    known.add(c.centerId);
    requireValue(typeof c.direct === "boolean" && typeof c.inherited === "boolean" &&
      c.selected === (c.direct || c.inherited), "INVALID_PROVENANCE");
  }
  requireValue(raw.centers.some(c=>c.centerId===raw.selectedCenterId && c.selected), "SELECTED_CENTER_NOT_VISIBLE");
  return raw;
}
/** Only for source-verified options. Inherited links cannot be removed from the effective display. */
export function planParentDirectCenters(source:ParentCenterVerified,nextDirect:readonly string[]):readonly string[] {
  const read=validateParentCenterRead(source);
  requireValue(Array.isArray(nextDirect) && nextDirect.length<=50, "INVALID_SELECTION");
  const unique=new Set(nextDirect),allowed=new Set(read.centers.map(c=>c.centerId));
  requireValue(unique.size===nextDirect.length && nextDirect.every(id=>uuid.test(id)&&allowed.has(id)), "FOREIGN_OR_DUPLICATE_CENTER");
  // Conservative: no automatic removal of a direct link with inherited provenance.
  requireValue(read.centers.every(c=>!c.inherited || !c.direct || unique.has(c.centerId)),
    "INHERITED_DIRECT_CANNOT_REMOVE");
  const effective=new Set([...unique,...read.centers.filter(c=>c.inherited).map(c=>c.centerId)]);
  requireValue(effective.has(read.selectedCenterId), "SELECTED_CENTER_WOULD_BE_REMOVED");
  return [...unique].sort();
}
export function safeParentCenterLabels(names:readonly string[]):readonly string[] {
  requireValue(Array.isArray(names) && names.length<=50, "INVALID_FALLBACK");
  requireValue(names.every(n=>typeof n==="string" && !!n.trim() && n.length<=160), "INVALID_FALLBACK_LABEL");
  // Names are display-only; never infer Center IDs or direct/inherited provenance from them.
  return [...new Set(names.map(n=>n.trim()))];
}
