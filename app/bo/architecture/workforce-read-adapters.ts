import { workforceRead, type GlobalWeekResult } from "./workforce-read-client";
import type { BoModuleReadAdapter } from "@/app/bo/architecture/BoModuleFactory";
import type { BoWorkforcePlanningBootstrap, BoWorkforceWeeklyPlanning } from "@/lib/bo-model";

type AuthorizedWeeks = {
  bootstrap: BoWorkforcePlanningBootstrap;
  weeksByCenter: Array<{ centerId: string; result: GlobalWeekResult }>;
};

async function authorizedWeeks(): Promise<AuthorizedWeeks> {
  const bootstrap = await workforceRead.bootstrap();
  const weeksByCenter = await Promise.all(bootstrap.centers.map(async ({ id }) => ({
    centerId: id,
    result: await workforceRead.globalWeeks(id),
  })));
  return { bootstrap, weeksByCenter };
}

function visibleWeeks(weeks: GlobalWeekResult["termWeeks"]): GlobalWeekResult["termWeeks"] {
  const ordered = [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const today = new Date().toISOString().slice(0, 10);
  const firstActive = ordered.findIndex((week) => week.endDate >= today);
  const first = Math.max(0, (firstActive < 0 ? ordered.length : firstActive) - 4);
  return ordered.slice(first, first + 12);
}

export async function authorizedWorkforceSnapshots(): Promise<{
  weeks: AuthorizedWeeks;
  snapshots: BoWorkforceWeeklyPlanning[];
}> {
  const weeks = await authorizedWeeks();
  const snapshots: BoWorkforceWeeklyPlanning[] = [];
  // Scope to each authorized Center, never a Cartesian product with legacy Center weeks.
  for (const { centerId, result } of weeks.weeksByCenter) {
    for (const week of visibleWeeks(result.termWeeks)) {
      // Fail closed on authorization or contract errors; never turn 403 into an empty row.
      snapshots.push(await workforceRead.weekly(centerId, week.id));
    }
  }
  return { weeks, snapshots };
}

export const termWeeksAdapter: BoModuleReadAdapter = {
  async list() {
    const { weeksByCenter } = await authorizedWeeks();
    const byId = new Map<string, Record<string, unknown>>();
    for (const { result } of weeksByCenter) {
      for (const week of result.termWeeks) {
        const term = result.terms.find((entry) => entry.id === week.termId);
        byId.set(week.id, {
          id: week.id, name: week.code, term: term?.displayName ?? week.termId,
          startDate: week.startDate, endDate: week.endDate, ordinal: week.ordinal,
        });
      }
    }
    return [...byId.values()].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  },
};

export const shiftPlansAdapter: BoModuleReadAdapter = {
  async list() {
    const { snapshots } = await authorizedWorkforceSnapshots();
    return snapshots.filter((s) => s.windows?.availability.shiftPlanExists === true).map((s) => ({
      id: s.centerId + ":" + s.termWeekId, name: s.termWeekId,
      centerId: s.centerId, termWeekId: s.termWeekId,
      availabilityState: s.windows?.availability.state ?? "UNKNOWN",
      planningState: s.windows?.planning.state ?? "UNKNOWN",
      registrationOpen: s.windows?.availability.availabilityRegistrationOpen ?? false,
    }));
  },
};

export const availabilityAdapter: BoModuleReadAdapter = {
  async list() {
    const { snapshots } = await authorizedWorkforceSnapshots();
    return snapshots.flatMap((s) => s.availability.map((a) => ({
      id: a.id, name: s.staff.find((staff) => staff.id === a.staffMemberId)?.displayLabel ?? a.staffMemberId,
      centerId: a.centerId, termWeekId: a.termWeekId, status: a.status, shiftCount: a.items.length,
    })));
  },
};

export const assignmentsAdapter: BoModuleReadAdapter = {
  async list() {
    const { snapshots } = await authorizedWorkforceSnapshots();
    return snapshots.flatMap((s) => s.assignments.map((a) => ({
      id: a.id, name: s.staff.find((staff) => staff.id === a.staffMemberId)?.displayLabel ?? a.staffMemberId,
      centerId: a.centerId, termWeekId: s.termWeekId, workDate: a.workDate,
      shift: s.templates.find((t) => t.id === a.shiftTemplateId)?.displayLabel ?? a.shiftTemplateId, status: a.status,
    })));
  },
};
