"use client";

/** PAP-1407 / PAP-220. Business views for the one canonical Workforce > Staffs TDD.
 * Staff registration is NOT inferred from regular Staff rows. The Core Center-
 * scoped application contract is a separate data source (PAP-1406).
 */
import type { BoRecord } from "@/lib/bo-registration";

export type StaffsView = "all" | "register" | "active" | "deactivated";

export const STAFFS_VIEWS: readonly { key: StaffsView; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "register", label: "Đăng ký" },
  { key: "active", label: "Đang làm" },
  { key: "deactivated", label: "Ngưng hoạt động" },
];

export function staffsViewRows(rows: readonly BoRecord[], view: StaffsView): BoRecord[] {
  if (view === "register") {
    // Registration data is ONLY admissible through an explicitly Center-scoped
    // Core request adapter, never from a global Staff directory or old queue.
    return [];
  }
  // Staff directory is only active/inactive; pending applications must come
  // from the new authenticated Center queue, never from this broad source.
  const directory = rows.filter(row => row.status === "active" || row.status === "inactive");
  if (view === "all") return directory;
  return directory.filter(row => view === "active" ? row.status === "active" : row.status === "inactive");
}

export function BoStaffsViews({
  selected,
  onSelect,
}: {
  selected: StaffsView;
  onSelect: (view: StaffsView) => void;
}) {
  return <nav className="tabs-left" aria-label="Trạng thái Staff">
    {STAFFS_VIEWS.map(view =>
      <button
        type="button"
        key={view.key}
        className={"view-tab " + (selected === view.key ? "active" : "")}
        data-staffs-view={view.key}
        aria-current={selected === view.key ? "page" : undefined}
        onClick={() => onSelect(view.key)}
      >{view.label}</button>
    )}
  </nav>;
}
