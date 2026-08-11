import { dbId, queryAll } from "@/lib/notion";
import { mapShift, type Shift } from "@/lib/domain/shift";

export async function listShifts(): Promise<Shift[]> {
  const pages = await queryAll(dbId("NOTION_SHIFT_MASTER_DB_ID"));
  return pages.map(mapShift);
}
