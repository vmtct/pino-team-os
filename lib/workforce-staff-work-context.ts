import type { Assignment, WorkforceContext } from "@/lib/workforce-api";

const VI_WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

export function workDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return {
    weekday: VI_WEEKDAYS[date.getUTCDay()],
    day: String(day).padStart(2, "0"),
    month: String(month).padStart(2, "0"),
  };
}

export function compactWorkDate(value: string) {
  const part = workDateParts(value);
  return `${part.weekday}, ${part.day}/${part.month}`;
}

export function assignmentTime(row: Assignment) {
  return row.shift ? `${row.shift.startLocalTime}–${row.shift.endLocalTime}` : row.status;
}

export function assignmentsInWeek(rows: Assignment[], week: WorkforceContext["termWeeks"][number] | null) {
  if (!week) return [];
  return rows.filter((row) => row.workDate >= week.startDate && row.workDate <= week.endDate);
}

export function nextAssignment(rows: Assignment[], fromDate: string) {
  return [...rows]
    .filter((row) => row.workDate >= fromDate && row.status !== "CANCELLED")
    .sort((a, b) => {
      const byDate = a.workDate.localeCompare(b.workDate);
      if (byDate) return byDate;
      return (a.shift?.startLocalTime ?? "").localeCompare(b.shift?.startLocalTime ?? "");
    })[0] ?? null;
}

export function staffInitials(displayLabel: string) {
  const words = displayLabel.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)?.[0] ?? ""}` : words[0]?.slice(0, 2) ?? "P").toUpperCase();
}
