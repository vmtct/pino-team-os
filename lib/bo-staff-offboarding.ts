export type StaffOffboardingState = {
  staffActive: boolean;
  accessActive: boolean;
};

export type StaffOffboardingActions = {
  suspendAccess: (reason: string) => Promise<unknown>;
  deactivateStaff: () => Promise<unknown>;
};

export type StaffOffboardingResult = {
  accessSuspended: boolean;
  staffDeactivated: boolean;
};

/**
 * Coordinates the two existing canonical offboarding actions without inventing
 * a new business transaction. Access is suspended first so any partial failure
 * leaves the safer state: no active login while Staff may still be active.
 */
export async function offboardStaff(
  state: StaffOffboardingState,
  reason: string,
  actions: StaffOffboardingActions,
): Promise<StaffOffboardingResult> {
  if (state.accessActive && !reason.trim()) {
    throw new Error("Cần lý do để suspend Access trước khi offboard.");
  }

  let accessSuspended = !state.accessActive;
  let staffDeactivated = !state.staffActive;

  if (state.accessActive) {
    await actions.suspendAccess(reason.trim());
    accessSuspended = true;
  }

  if (state.staffActive) {
    try {
      await actions.deactivateStaff();
      staffDeactivated = true;
    } catch (cause) {
      if (accessSuspended) {
        const detail = cause instanceof Error ? cause.message : "Không thể deactivate Staff.";
        throw new Error(`Access đã suspended nhưng Staff chưa deactivate: ${detail}`);
      }
      throw cause;
    }
  }

  return { accessSuspended, staffDeactivated };
}
