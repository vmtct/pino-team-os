/** PAP-782: one canonical URL contract for the full Staff workspace. */
export const STAFF_DETAIL_TABS = [
  { key: "overview", label: "Tổng quan" },
  { key: "profile", label: "Hồ sơ" },
  { key: "assignments", label: "Phân công" },
  { key: "training", label: "Năng lực" },
  { key: "income", label: "Thu nhập" },
  { key: "access", label: "Access" },
  { key: "pinoria", label: "Pinoria" },
  { key: "audit", label: "Audit" },
] as const;

export type StaffDetailTab = (typeof STAFF_DETAIL_TABS)[number]["key"];

export function resolveStaffDetailTab(value: string | null): StaffDetailTab {
  return STAFF_DETAIL_TABS.find((tab) => tab.key === value)?.key ?? "overview";
}

/** Keep existing directory context while changing tabs; never embed profile data in URL. */
export function staffDetailTabHref(pathname: string, query: string, tab: StaffDetailTab): string {
  const params = new URLSearchParams(query);
  if (tab === "overview") params.delete("tab");
  else params.set("tab", tab);
  const suffix = params.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}
