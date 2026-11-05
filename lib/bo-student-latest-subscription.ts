import type { BoLearnerLifecycle } from "./bo-model";
import type { BoRecord } from "./bo-registration";
import { studentSubscriptionRows } from "./bo-student-subscription-rows";

/**
 * The Student Drawer and Full Detail use the same Core lifecycle-scoped rows.
 * Latest is by service start date, not by lifecycle status; undated rows sort last.
 * No global Subscription directory request and no fabricated "current" status.
 */
export function latestStudentSubscription(data: BoLearnerLifecycle, studentId: string): BoRecord | null {
  const rows = studentSubscriptionRows(data, studentId);
  return rows.sort((left, right) => {
    const dateA = typeof left.start === "string" ? left.start : "";
    const dateB = typeof right.start === "string" ? right.start : "";
    return dateB.localeCompare(dateA) || String(right.id).localeCompare(String(left.id));
  })[0] ?? null;
}
