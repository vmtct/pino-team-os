/** PAP-1855 / Epic PAP-650 PNR-TV: a single canonical Detail field per semantic property.
 * Core Visibility is authoritative for Name / Scope / assigned Centers.
 * Core Directory supplies only the other existing readonly Policy/audit attributes.
 */
import type { BoField, BoRecord } from "./bo-registration";
import { tvPolicyModule } from "./ho-tv-policy-directory";
import type { TvLiveVisibility, TvVisibilityCenter } from "./ho-tv-visibility-client";

export const hoTvDetailSections = [
  { id: "policy", label: "Thông tin Policy", fields: [
    "name", "typeName", "scope", "center", "resolution",
    "inherited", "active", "latest", "aspectRatio",
  ] },
  { id: "audit", label: "Thông tin hệ thống", fields: [
    "createdAt", "createdByUser", "updatedAt", "updatedByUser",
  ] },
] as const;

export const hoTvEditableBusinessKeys = ["name", "scope", "center"] as const;

export function projectHoTvPolicyDetail(
  policy: BoRecord,
  verified: TvLiveVisibility,
  centers: readonly TvVisibilityCenter[],
): { fields: BoField[]; record: BoRecord; sections: typeof hoTvDetailSections } {
  if (policy.id !== verified.id) throw new Error("PAP1855_POLICY_PROJECTION_MISMATCH");
  const labels = new Map(centers.map(c => [c.id, c.name + " · " + c.id.slice(-6)]));
  if (verified.assignedCenterIds.some(id => !labels.has(id)))
    throw new Error("PAP1855_UNAUTHORIZED_CENTER_PROJECTION");

  const fields: BoField[] = tvPolicyModule.fields.map(field => {
    if (field.key === "name") return { ...field, readonly: false, type: "text", icon: "Aa" };
    if (field.key === "scope") return { ...field, readonly: false,
      type: "select", options: ["DEFAULT", "CENTER"] };
    if (field.key === "center") return { ...field,
      readonly: verified.scope !== "CENTER", type: "multiselect",
      options: centers.map(c => labels.get(c.id)!),
    };
    return field;
  });
  const record: BoRecord = {
    ...policy,
    name: verified.name,
    scope: verified.scope,
    center: verified.scope === "DEFAULT"
      ? ["Tất cả Center"]
      : verified.assignedCenterIds.map(id => labels.get(id)!),
  };

  // Fail the source gate before React: aliases are NOT independent fields.
  const keys = hoTvDetailSections.flatMap(section => [...section.fields]);
  if (keys.length !== 13 || new Set(keys).size !== keys.length ||
      hoTvEditableBusinessKeys.some(key => keys.filter(item => item === key).length !== 1) ||
      fields.some(field => !keys.includes(field.key as typeof keys[number])))
    throw new Error("DSA_FIELD_SINGLE_AUTHORITY_P0_FAIL");
  return { fields, record, sections: hoTvDetailSections };
}
