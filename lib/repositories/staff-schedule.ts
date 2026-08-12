import { dbId, getPage, queryAll } from "@/lib/notion";
import { dateStartProp, relationIds, selectProp, textProp } from "@/lib/notion/properties";
import { mapShift, type Shift } from "@/lib/domain/shift";
import { mapStaffSchedule, type StaffSchedule } from "@/lib/domain/staff-schedule";
import type { Staff } from "@/lib/domain/staff";
import type { NotionPage } from "@/lib/notion/types";

type WeekInfo = { id: string; name: string; start: string; end: string };
type ScheduleCandidate = { page: NotionPage; week: WeekInfo; status: string };
type PropertyRecord = Record<string, unknown>;

export type ScheduleDiagnostic = {
  identity: { staffId: string; email: string; name: string };
  schedule: { found: boolean; scheduleId: string; weekId: string; status: string };
  week: { name: string; startRawType: string; startResolved: string; endResolved: string };
  days: Record<string, { date: string; shiftIds: string[]; shiftCodes: string[]; shifts: Array<{ code: string; startTime: string; endTime: string }> }>;
  result: { currentWeek: boolean; reason: string };
};

function record(value: unknown): PropertyRecord | null { return value && typeof value === "object" ? value as PropertyRecord : null; }

function dateValue(value: unknown): string {
  const object = record(value);
  if (!object) return "";
  const date = record(object.date);
  if (typeof date?.start === "string") return date.start;
  if (typeof object.string === "string") {
    const value = object.string.trim();
    if (/^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/.test(value)) return value;
    const match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }
  if (Array.isArray(object.array)) for (const item of object.array) { const resolved = dateValue(item); if (resolved) return resolved; }
  return "";
}

function computedDate(page: NotionPage, name: string): string {
  const property = record(page.properties[name]);
  if (!property) return "";
  const formulaDate = dateValue(record(property.formula));
  if (formulaDate) return formulaDate;
  const rollupDate = dateValue(record(property.rollup));
  if (rollupDate) return rollupDate;
  return dateStartProp(page, name);
}

function rawType(page: NotionPage, name: string): string {
  const property = record(page.properties[name]);
  if (!property) return "missing";
  return typeof property.type === "string" ? property.type : "unknown";
}

function addDays(value: string, days: number): string { const date = new Date(value); date.setUTCDate(date.getUTCDate() + days); return date.toISOString(); }
function priority(status: string): number { return status === "Approved" ? 3 : status === "Submitted" ? 2 : status === "Draft" ? 1 : 0; }
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

async function loadWeek(pageId: string): Promise<WeekInfo> {
  const page = await getPage(pageId);
  const start = computedDate(page, "Monday Start on");
  const end = computedDate(page, "Saturday Date") || (start ? addDays(start, 6) : "");
  return { id: page.id, name: textProp(page, "Name"), start, end };
}

async function scheduleCandidates(staff: Staff): Promise<ScheduleCandidate[]> {
  const schedulePages = await queryAll(dbId("NOTION_SCHEDULE_DB_ID"));
  const staffPages = schedulePages.filter((page) => relationIds(page, "Staff").includes(staff.id));
  const candidates = await Promise.all(staffPages.map(async (page) => {
    const weekId = relationIds(page, "Week")[0];
    if (!weekId) return null;
    try {
      const week = await loadWeek(weekId);
      if (!week.start || !week.end) return null;
      return { page, week, status: selectProp(page, "Week Status") };
    } catch (error) {
      console.error("[Schedule] week load failed", { staffId: staff.id, scheduleId: page.id, weekId, message: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }));
  return candidates.filter((item): item is ScheduleCandidate => Boolean(item)).sort((a, b) => new Date(b.week.start).getTime() - new Date(a.week.start).getTime());
}

async function loadReferencedShifts(page: NotionPage): Promise<Map<string, Shift>> {
  const ids = new Set<string>();
  for (const day of DAYS) relationIds(page, `${day} Shifts`).forEach((id) => ids.add(id));
  const shifts = new Map<string, Shift>();
  const entries = await Promise.allSettled([...ids].map(async (id) => [id, mapShift(await getPage(id))] as const));
  for (const entry of entries) if (entry.status === "fulfilled") shifts.set(entry.value[0], entry.value[1]);
  return shifts;
}

function dayShiftEntries(page: NotionPage, day: string, shiftsByKey: Map<string, Shift>): Shift[] {
  const seen = new Set<string>();
  return relationIds(page, `${day} Shifts`).map((id) => shiftsByKey.get(id)).filter((shift): shift is Shift => Boolean(shift && !seen.has(shift.id) && seen.add(shift.id)));
}

function diagnosticDays(page: NotionPage, weekStart: string, shiftsByKey: Map<string, Shift>): ScheduleDiagnostic["days"] {
  return Object.fromEntries(DAYS.map((day, index) => {
    const shifts = dayShiftEntries(page, day, shiftsByKey);
    return [day, { date: weekStart ? addDays(weekStart, index) : "", shiftIds: shifts.map((shift) => shift.id), shiftCodes: shifts.map((shift) => shift.code), shifts: shifts.map((shift) => ({ code: shift.code, startTime: shift.startTime, endTime: shift.endTime })) }];
  }));
}

async function mapCandidate(candidate: ScheduleCandidate): Promise<StaffSchedule> {
  const shiftsByKey = await loadReferencedShifts(candidate.page);
  return mapStaffSchedule(candidate.page, shiftsByKey, candidate.week);
}

export async function listStaffScheduleHistory(staff: Staff): Promise<StaffSchedule[]> {
  const candidates = await scheduleCandidates(staff);
  return Promise.all(candidates.map(mapCandidate));
}

export async function currentStaffSchedule(staff: Staff): Promise<StaffSchedule | null> {
  const candidates = await scheduleCandidates(staff);
  const now = new Date();
  const current = candidates.filter(({ week }) => {
    const start = new Date(week.start);
    const end = new Date(week.end);
    end.setHours(23, 59, 59, 999);
    return now >= start && now <= end;
  }).sort((a, b) => priority(b.status) - priority(a.status))[0];
  return current ? mapCandidate(current) : null;
}

export async function staffScheduleByWeek(staff: Staff, weekId: string): Promise<StaffSchedule | null> {
  const candidate = (await scheduleCandidates(staff)).find((item) => item.week.id === weekId);
  return candidate ? mapCandidate(candidate) : null;
}

export async function diagnoseStaffSchedule(staff: Staff): Promise<ScheduleDiagnostic> {
  const schedulePages = await queryAll(dbId("NOTION_SCHEDULE_DB_ID"));
  const staffPages = schedulePages.filter((page) => relationIds(page, "Staff").includes(staff.id));
  const schedulePage = staffPages[0];
  const weekId = schedulePage ? relationIds(schedulePage, "Week")[0] ?? "" : "";
  const status = schedulePage ? selectProp(schedulePage, "Week Status") : "";
  const weekPage = weekId ? await getPage(weekId) : null;
  const start = weekPage ? computedDate(weekPage, "Monday Start on") : "";
  const end = weekPage ? computedDate(weekPage, "Saturday Date") || (start ? addDays(start, 6) : "") : "";
  const shiftsByKey = schedulePage ? await loadReferencedShifts(schedulePage) : new Map<string, Shift>();
  const now = new Date();
  const currentWeek = Boolean(start && end && now >= new Date(start) && now <= new Date(end));
  let reason = "ok";
  if (!schedulePage) reason = "no Staff Schedule row matched staff relation";
  else if (!weekId) reason = "Staff Schedule has no Week relation";
  else if (!start) reason = "Week Monday Start on did not resolve to a date";
  else if (!currentWeek) reason = "resolved Week is not current";
  return { identity: { staffId: staff.id, email: staff.email, name: staff.name }, schedule: { found: Boolean(schedulePage), scheduleId: schedulePage?.id ?? "", weekId, status }, week: { name: weekPage ? textProp(weekPage, "Name") : "", startRawType: weekPage ? rawType(weekPage, "Monday Start on") : "missing", startResolved: start, endResolved: end }, days: schedulePage ? diagnosticDays(schedulePage, start, shiftsByKey) : {}, result: { currentWeek, reason } };
}
