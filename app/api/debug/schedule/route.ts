import { currentStaff } from "@/lib/repositories/current-user";
import { listStaff } from "@/lib/repositories/staff";
import { diagnoseStaffSchedule } from "@/lib/repositories/staff-schedule";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const probeSecret = process.env.SCHEDULE_E2E_SECRET;
  const configuredEmail = process.env.SCHEDULE_E2E_EMAIL?.trim().toLowerCase();
  const suppliedSecret = request.headers.get("x-pino-e2e-secret");
  const suppliedEmail = request.headers.get("x-pino-e2e-email")?.trim().toLowerCase();

  let staff = await currentStaff();

  if (probeSecret && configuredEmail && suppliedSecret === probeSecret && suppliedEmail === configuredEmail) {
    const staffList = await listStaff();
    staff = staffList.find((person) => person.email.toLowerCase() === configuredEmail) ?? null;
  }

  if (!staff) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const diagnostic = await diagnoseStaffSchedule(staff);
    return Response.json({ ok: true, diagnostic });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Schedule Diagnostic] failed", {
      staffId: staff.id,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return Response.json(
      {
        ok: false,
        error: "diagnostic_failed",
        stage: "diagnoseStaffSchedule",
        message,
      },
      { status: 500 },
    );
  }
}
