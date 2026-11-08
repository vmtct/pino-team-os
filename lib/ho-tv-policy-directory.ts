/** PAP-650 / PNR-TV · PAP-1386 / PAP-1419: presentation only.
 * No Policy directory contract is registered in the admitted HO read plane.
 * Display/device/config-version records must never be promoted to Policy rows.
 */
import type { BoModule, BoRecord } from "./bo-registration";

export const tvPolicyColumns = [
  ["name", "Policy", 240], ["typeName", "Loại TV", 165],
  ["scope", "Scope", 135], ["center", "Center", 190],
  ["resolution", "Effective State", 170], ["inherited", "Inherited From", 165],
  ["active", "Active Revision", 145], ["latest", "Head Revision", 155],
  ["displaysCount", "Displays", 135], ["aspectRatio", "Frame", 110],
  ["createdAt", "Created Time", 185], ["createdByUser", "Created by (User)", 205],
  ["updatedAt", "Last Modified Time", 205], ["updatedByUser", "Last Modified by (User)", 220],
] as const;

export const tvPolicyModule: BoModule = {
  label: "Pinoria TV", group: "Pinoria",
  fields: tvPolicyColumns.map(([key, label, w]) => ({
    key, label, w, type: "text", icon: "", readonly: true, defaultVisible: true,
  })),
};

export type TvPolicyDirectoryRead = Readonly<{
  status: "unavailable";
  reason: "CORE_POLICY_DIRECTORY_CONTRACT_MISSING";
  rows: readonly BoRecord[];
  total: null;
}>;

/** Intentionally synchronous: no invented endpoint, request or loading phase.
 * This is a capability result, never an authorization decision or empty Core read.
 * Replace only after a governed, Founder-gated, per-Center Core contract exists.
 */
export function readHoTvPolicyDirectory(): TvPolicyDirectoryRead {
  return {
    status: "unavailable", reason: "CORE_POLICY_DIRECTORY_CONTRACT_MISSING",
    rows: [], total: null,
  };
}

export const tvPolicyUnavailableMessage =
  "Chưa thể tải danh sách chính sách trình chiếu. Nguồn dữ liệu chính sách chưa sẵn sàng; số lượng chính sách chưa xác định.";
