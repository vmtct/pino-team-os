import { dbId, getPage, queryAll } from "@/lib/notion";
import { dateStartProp, relationIds, selectProp, textProp } from "@/lib/notion/properties";
import { mapShift, type Shift } from "@/lib/domain/shift";
import { mapStaffSchedule, type StaffSchedule } from "@/lib/domain/staff-schedule";
import type { Staff } from "@/lib/domain/staff";
import type { NotionPage } from "@/lib/notion/types";

type WeekInfo = { name: string; start: string; end: string };
type PropertyRecord = Record<string, unknown>;

function record(value: unknown): PropertyRecord | null {
  return value && typeof value === "object" ? value as PropertyRecord : null;
}

function computedDate(page: NotionPage, name: string): string {
  const property = record(page.properties[name]);
  if (!property) return "";

  const formula = record(property.formula);
  const formulaDate = record(formula?.date);
  if (typeof formulaDate?.start === "string") return formulaDate.start;

  const rollup = record(property.rollup);
  const rollupDate = record(rollup?.date);
  if (typeof rollupDate?.start === "string") return rollupDate.start;

  return dateStartProp(page, name);
}

function addDays(value: string, days: number): string {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

async function loadWeek(pageId: string): Promise<WeekInfo> {
  const page = await getPage(pageId);
  const start = computedDate(page, "T2");
  const end = computedDate(page, "T7");
  return { name: textProp(page, "Name"), start, end };
}

function priority(status: string): number {
  return status === "Approved" ? 3 : status === "Submitted" ? 2 : status === "Draft" ? 1 : 0;
}

async function loadReferencedShifts(page: NotionPage): Promise<Map<string, Shift>> {
  const ids = new Set<string>();
  for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) {
    relationIds(page, `${day} Shifts`).forEach((id) => ids.add(id));
  }

  const entries = await Promise.allSettled([...ids].map(async (id) => [id, mapShift(await getPage(id))] as const));
  const shifts = new Map<string, Shift>();
  for (const entry of entries) {
    if (entry.status === "fulfilled") shifts.set(entry.value[0], entry.value[1]);
    else console.error("[Schedule] shift load failed", { message: entry.reason instanceof Error ? entry.reason.message : String(entry.reason) });
  }
  return shifts;
}

export async function currentStaffSchedule(staff: Staff): Promise<StaffSchedule | null> {
  const schedulePages = await queryAll(dbId("NOTION_SCHEDULE_DB_ID"));
  const staffPages = schedulePages.filter((page) => relationIds(page, "Staff").includes(staff.id));
  if (!staffPages.length) return null;

  const candidates = await Promise.all(staffPages.map(async (page) => {
    const weekId = relationIds(page, "Week")[0];
    if (!weekId) return null;

    try {
      const week = await loadWeek(weekId);
      return { page, week, status: selectProp(page, "Schedule Status") };
    } catch (error) {
      // Staff Schedule also exposes Start On as a rollup. Use it as a resilient fallback
      // so a permission/read failure on the related Week page does not blank the schedule.
      const start = computedDate(page, "Start On");
      if (!start) {
        console.error("[Schedule] week load failed", { staffId: staff.id, scheduleId: page.id, weekId, message: error instanceof Error ? error.message : String(error) });
        return null;
      }
      console.warn("[Schedule] using Start On rollup fallback", { staffId: staff.id, scheduleId: page.id, weekId });
      return {
        page,
        week: { name: "Tuần hiện tại", start, end: addDays(start, 6) },
        status: selectProp(page, "Schedule Status"),
      };
    }
  }));

  const now = new Date();
  const current = candidates
    .filter((item): item is { page: NotionPage; week: WeekInfo; status: string } => Boolean(item?.week.start && item?.week.end))
    .filter(({ week }) => {
      const start = new Date(week.start);
      const end = new Date(week.end);
      end.setHours(23, 59, 59, 999);
      return now >= start && now <= end;
    })
    .sort((a, b) => priority(b.status) - priority(a.status))[0];

  if (!current) return null;

  const shiftsById = await loadReferencedShifts(current.page);
  return mapStaffSchedule(current.page, shiftsById, current.week);
}
