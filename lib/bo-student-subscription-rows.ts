import type { BoLearnerLifecycle } from "./bo-model";
import { defaultTable, type BoField, type BoRecord, type BoTableState } from "./bo-registration";

/** Student-scoped lifecycle truth, not an unbounded global Subscription listing. */
export function studentSubscriptionRows(data: BoLearnerLifecycle, studentId: string): BoRecord[] {
  if (data.student.id !== studentId) throw new Error("Hồ sơ học viên không khớp.");
  const seen = new Set<string>();
  return data.subscriptions
    .filter(item => item.subscription.studentProfileId === studentId)
    .map(({ subscription }) => {
      if (seen.has(subscription.id)) throw new Error("Subscription ID trùng.");
      seen.add(subscription.id);
      return {
        id: subscription.id,
        name: data.student.displayName,
        path: subscription.pathDisplayName,
        status: subscription.lifecycle,
        weekly: subscription.weeklyCommitment,
        remaining: subscription.effectiveAvailableUnits,
        start: subscription.serviceStartsOn,
        end: subscription.contractualEndsOn,
        reference: subscription.commercialReference,
      };
    });
}

/** Compact Student relation: date-leading, no redundant learner name, newest start first. */
export function studentSubscriptionTableState(fields: readonly BoField[]): BoTableState {
  if (!fields.some(field => field.key === "start")) throw new Error("Subscription start field required.");
  const state = defaultTable(fields);
  return {
    ...state,
    order: ["start", ...state.order.filter(key => key !== "start")],
    visible: state.visible.filter(key => key !== "name"),
    sort: "start",
    desc: true,
  };
}