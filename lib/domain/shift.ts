import type { NotionPage } from "@/lib/notion/types";
import { checkboxProp, dateStartProp, selectProp, textProp } from "@/lib/notion/properties";

export type Shift = {
  id: string;
  code: string;
  period: string;
  startTime: string;
  endTime: string;
  active: boolean;
};

export function mapShift(page: NotionPage): Shift {
  return {
    id: page.id,
    code: textProp(page, "Name"),
    period: selectProp(page, "Period"),
    startTime: dateStartProp(page, "Start Time"),
    endTime: dateStartProp(page, "End Time"),
    active: checkboxProp(page, "Active", true),
  };
}
