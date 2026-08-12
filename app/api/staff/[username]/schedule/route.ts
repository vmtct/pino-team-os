import { staffByUsername } from "@/lib/repositories/staff-access";
import { currentStaffSchedule } from "@/lib/repositories/staff-schedule";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ username: string }> }) {
  const { username } = await context.params;
  const staff = await staffByUsername(decodeURIComponent(username));
  if (!staff) return Response.json({ ok: false, error: "staff_not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  try {
    const schedule = await currentStaffSchedule(staff);
    return Response.json({ ok: true, staff: { name: staff.name }, schedule }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[Staff Schedule API] failed", { staffId: staff.id, message: error instanceof Error ? error.message : String(error) });
    return Response.json({ ok: false, error: "schedule_load_failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
