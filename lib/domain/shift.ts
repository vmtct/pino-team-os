import type { NotionPage } from "@/lib/notion/types";
import { checkboxProp, selectProp, textProp } from "@/lib/notion/properties";

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue | null { return value && typeof value === "object" ? (value as RecordValue) : null; }
function numberProp(page: NotionPage, name: string): number | null { const property = record(page.properties[name]); return typeof property?.number === "number" ? property.number : null; }

export type Shift = {
  id: string;
  code: string;
  period: string;
  startTime: string;
  endTime: string;
  active: boolean;
};

function time(value: number | null): string { if (value === null) return ""; const hours = Math.floor(value / 100); const minutes = value % 100; return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`; }

export function mapShift(page: NotionPage): Shift {
  return { id: page.id, code: textProp(page, "Name"), period: selectProp(page, "Period"), startTime: time(numberProp(page, "Start Time")), endTime: time(numberProp(page, "End Time")), active: checkboxProp(page, "Active", true) };
}
