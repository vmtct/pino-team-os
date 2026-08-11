import { dbId, queryAll } from "@/lib/notion";
import { mapStaff, type Staff } from "@/lib/domain/staff";

export async function listStaff(): Promise<Staff[]> {
  try {
    const pages = await queryAll(dbId("NOTION_STAFF_DB_ID"));
    return pages.map(mapStaff);
  } catch (error) {
    console.error("[Staff] list failed", {
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : undefined,
    });
    throw error;
  }
}
