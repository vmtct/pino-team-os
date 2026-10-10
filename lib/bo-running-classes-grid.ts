import type { F3Path, F3RunningClass } from "./f3-delivery-api";

export type RunningClassGridSortKey = "class" | "program" | "pattern" | "capacity" | "status";

export type RunningClassGridRow = {
  item: F3RunningClass;
  programName: string;
  patternLabel: string;
  capacityLabel: string;
};

export type RunningClassGridOptions = {
  search?: string;
  status?: string;
  sortKey?: RunningClassGridSortKey;
  sortDirection?: "asc" | "desc";
};

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function isRunningClassGridSortKey(value: string | null): value is RunningClassGridSortKey {
  return value === "class" || value === "program" || value === "pattern" || value === "capacity" || value === "status";
}

export function buildRunningClassGridRows(
  classes: readonly F3RunningClass[],
  paths: readonly F3Path[],
  options: RunningClassGridOptions = {},
): RunningClassGridRow[] {
  const pathNames = new Map(paths.map((path) => [path.id, path.displayName] as const));
  const search = options.search?.trim().toLowerCase() ?? "";
  const status = options.status?.trim() ?? "";
  const sortKey = options.sortKey ?? "class";
  const direction = options.sortDirection === "desc" ? -1 : 1;

  const rows = classes.map((item) => {
    const programName = pathNames.get(item.pathProgramId) ?? "Unlinked Path";
    const patternLabel = `${weekdayNames[item.weekdayIso % 7] ?? "?"} · ${item.windowStartsLocal}–${item.windowEndsLocal}`;
    const capacityLabel = item.hardConcurrentCapacity !== null
      ? `${item.optimalConcurrentCapacity} / ${item.hardConcurrentCapacity} hard`
      : String(item.optimalConcurrentCapacity);
    return { item, programName, patternLabel, capacityLabel };
  }).filter((row) => {
    if (status && row.item.status !== status) return false;
    if (!search) return true;
    return [
      row.item.operationalName,
      row.programName,
      row.patternLabel,
      row.capacityLabel,
      row.item.status,
      row.item.id,
    ].some((value) => value.toLowerCase().includes(search));
  });

  return rows.sort((left, right) => {
    const primary = compareRows(left, right, sortKey) * direction;
    return primary || left.item.id.localeCompare(right.item.id);
  });
}

function compareRows(left: RunningClassGridRow, right: RunningClassGridRow, sortKey: RunningClassGridSortKey) {
  switch (sortKey) {
    case "program": return left.programName.localeCompare(right.programName);
    case "pattern":
      return left.item.weekdayIso - right.item.weekdayIso
        || left.item.windowStartsLocal.localeCompare(right.item.windowStartsLocal)
        || left.item.windowEndsLocal.localeCompare(right.item.windowEndsLocal);
    case "capacity":
      return left.item.optimalConcurrentCapacity - right.item.optimalConcurrentCapacity
        || (left.item.hardConcurrentCapacity ?? Number.MAX_SAFE_INTEGER) - (right.item.hardConcurrentCapacity ?? Number.MAX_SAFE_INTEGER);
    case "status": return left.item.status.localeCompare(right.item.status);
    case "class":
    default: return left.item.operationalName.localeCompare(right.item.operationalName);
  }
}
