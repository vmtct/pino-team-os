import { dbId, getPage, queryAll } from "@/lib/notion";
import { relationIds, selectProp, textProp } from "@/lib/notion/properties";
import { listShifts } from "@/lib/repositories/shifts";
import { mapStaffSchedule, type StaffSchedule } from "@/lib/domain/staff-schedule";
import type { Staff } from "@/lib/domain/staff";
import type { NotionPage } from "@/lib/notion/types";

type WeekInfo = { name: string; start: string; end: string };
type PropertyRecord = Record<string, unknown>;
function record(value: unknown): PropertyRecord | null { return value && typeof value === "object" ? value as PropertyRecord : null; }
function formulaDate(page: NotionPage, name: string): string { const property = record(page.properties[name]); const formula = record(property?.formula); const date = record(formula?.date); return typeof date?.start === "string" ? date.start : ""; }
async function loadWeek(pageId: string): Promise<WeekInfo> { const page = await getPage(pageId); return { name: textProp(page, "Name"), start: formulaDate(page, "T2"), end: formulaDate(page, "T7") }; }
function priority(status: string): number { return status === "Approved" ? 3 : status === "Submitted" ? 2 : status === "Draft" ? 1 : 0; }
export async function currentStaffSchedule(staff: Staff): Promise<StaffSchedule | null> {
  const [schedulePages, shifts] = await Promise.all([queryAll(dbId("NOTION_SCHEDULE_DB_ID")), listShifts()]);
  const shiftsById = new Map(shifts.map((shift) => [shift.id, shift]));
  const staffPages = schedulePages.filter((page) => relationIds(page, "Staff").includes(staff.id));
  if (!staffPages.length) return null;
  const candidates = await Promise.all(staffPages.map(async (page) => { const weekId = relationIds(page, "Week")[0]; if (!weekId) return null; const week = await loadWeek(weekId); return { page, week, status: selectProp(page, "Schedule Status") }; }));
  const today = new Date();
  const current = candidates.filter((item): item is { page: NotionPage; week: WeekInfo; status: string } => Boolean(item?.week.start && item?.week.end)).filter(({ week }) => { const start = new Date(week.start); const end = new Date(week.end); end.setHours(23, 59, 59, 999); return today >= start && today <= end; }).sort((a, b) => priority(b.status) - priority(a.status))[0];
  if (!current) return null;
  return mapStaffSchedule(current.page, shiftsById, current.week);
}
