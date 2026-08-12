import { currentStaff } from "@/lib/repositories/current-user";
import { diagnoseStaffSchedule } from "@/lib/repositories/staff-schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await currentStaff();

  if (!staff) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const diagnostic = await diagnoseStaffSchedule(staff);

    return Response.json({
      ok: true,
      staff: {
        email: diagnostic.identity.email,
        name: diagnostic.identity.name,
      },
      week: diagnostic.week,
      days: diagnostic.days,
      result: diagnostic.result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Schedule Inspect] failed", {
      staffId: staff.id,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return Response.json(
      {
        ok: false,
        error: "schedule_inspect_failed",
        stage: "diagnoseStaffSchedule",
        message,
      },
      { status: 500 },
    );
  }
}
