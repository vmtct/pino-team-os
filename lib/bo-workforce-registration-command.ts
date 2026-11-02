import { boApi } from "./bo-api";

/** PAP-1199: canonical bounded mutation and verified Core readback. */
export async function saveCenterShiftRegistration(
  input: { centerId: string; termWeekId: string; expectedVersion: number; open: boolean; reason: string },
  api: Pick<typeof boApi, "workforceWeekControl" | "setWorkforceAvailabilityRegistration"> = boApi,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<{ open: boolean; version: number }> {
  if (!input.centerId || !input.termWeekId || !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 0 || !input.reason.trim() || input.reason.trim().length > 500)
    throw new Error("Center, TermWeek, phiên bản và lý do hợp lệ là bắt buộc.");
  await api.setWorkforceAvailabilityRegistration({ ...input, reason: input.reason.trim() }, idempotencyKey);
  const current = await api.workforceWeekControl(input.centerId, input.termWeekId);
  if (!current.availability.shiftPlanExists ||
      current.availability.availabilityRegistrationOpen !== input.open ||
      current.availability.controlVersion <= input.expectedVersion)
    throw new Error("Core chưa xác nhận trạng thái đăng ký vừa lưu.");
  return { open: current.availability.availabilityRegistrationOpen, version: current.availability.controlVersion };
}
