import { listStaff } from "@/lib/repositories/staff";
import { diagnoseStaffSchedule } from "@/lib/repositories/staff-schedule";

export const dynamic = "force-dynamic";

/**
 * Temporary public diagnostic endpoint for production schedule debugging.
 * It intentionally omits staff identity and Notion record IDs.
 * Remove after the schedule issue is resolved.
 */
export async function GET() {
  const configuredEmail = process.env.SCHEDULE_E2E_EMAIL?.trim().toLowerCase();

  if (!configuredEmail) {
    return Response.json(
      { ok: false, error: "Missing SCHEDULE_E2E_EMAIL" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const staffList = await listStaff();
    const staff = staffList.find((person) => person.email.toLowerCase() === configuredEmail) ?? null;

    if (!staff) {
      return Response.json(
        { ok: false, error: "Configured staff not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const diagnostic = await diagnoseStaffSchedule(staff);

    return Response.json(
      {
        ok: true,
        diagnostic: {
          week: diagnostic.week,
          days: diagnostic.days,
          result: diagnostic.result,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Public Schedule Diagnostic] failed", { message });

    return Response.json(
      {
        ok: false,
        error: "diagnostic_failed",
        stage: "diagnoseStaffSchedule",
        message,
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
