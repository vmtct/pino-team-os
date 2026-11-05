import { mapHoCenters } from "../ho-centers";
import type { BoWorkforceWeeklyPlanning } from "../bo-model";
import { auditQueryString, validateSubjectAuditPage, type BoAuditSubjectType, type BoSubjectAuditPage } from "../bo-subject-history";
import type { FieldSchema, HistoryBinding, ModuleRow } from "../workspace-schema";
import type { ProviderRecord, SurfaceProvider, SurfaceScope } from "./contracts";
import { adapterError } from "./session";

export async function readData(fetcher: typeof fetch, path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetcher("/api/bo/" + path, { signal });
  if (!response.ok) throw adapterError(response.status);
  const body: unknown = await response.json(); signal.throwIfAborted();
  if (!body || typeof body !== "object" || !("data" in body)) throw adapterError(502);
  return body.data;
}
/** Existing HO directory provider, opt-in only. No registration/adoption or new route. */
export function hoCentersProvider<F extends readonly FieldSchema[]>(map: (row: ReturnType<typeof mapHoCenters>[number]) => ModuleRow<F>): SurfaceProvider<F> {
  const load = async (scope: SurfaceScope, fetcher: typeof fetch, signal: AbortSignal) => {
    if (scope.surface !== "HO") throw adapterError(403);
    return mapHoCenters(await readData(fetcher, "centers", signal)).map(row => ({ row: map(row) }));
  };
  return { pagination: "local-ui", list: async (_query, scope, fetcher, signal) => { const records = await load(scope, fetcher, signal); return { records, total: records.length }; },
    detail: async (id, scope, fetcher, signal) => (await load(scope, fetcher, signal)).find(v => v.row.id === id) ?? null };
}
/** Existing Center-scoped weekly snapshot. Domain mapper explicitly declares fields.
 * Filters/sort/group/page remain in canonical local Table; never advertised as server query. */
export function boPlanningProvider<F extends readonly FieldSchema[]>(termWeekId: string, map: (snapshot: BoWorkforceWeeklyPlanning) => readonly ProviderRecord<F>[]): SurfaceProvider<F> {
  if (!/^[0-9a-f-]{36}$/i.test(termWeekId)) throw adapterError(400);
  const load = async (scope: SurfaceScope, fetcher: typeof fetch, signal: AbortSignal) => {
    if (scope.surface !== "BO") throw adapterError(403);
    const data = await readData(fetcher, "workforce/planning/weekly?" + new URLSearchParams({ centerId: scope.centerId, termWeekId }), signal) as BoWorkforceWeeklyPlanning;
    if (!data || data.centerId !== scope.centerId || data.termWeekId !== termWeekId) throw adapterError(403);
    return map(data);
  };
  return { pagination: "local-ui", list: async (_query, scope, fetcher, signal) => { const records = await load(scope, fetcher, signal); return { records, total: records.length }; },
    detail: async (id, scope, fetcher, signal) => (await load(scope, fetcher, signal)).find(v => v.row.id === id) ?? null };
}
/** Only existing BO subject audit sources. No Access Audit substitution. */
export function boSubjectHistory(subjectType: BoAuditSubjectType, permission: string) {
  return { subjectType, bind: (fetcher: typeof fetch, scope: SurfaceScope): HistoryBinding => ({ kind: "provider", source: { adapter: "bo-subject-history", permission }, load: async (subject, _context, cursor, signal) => {
    if (scope.surface !== "BO" || subject.type !== subjectType) throw adapterError(403);
    const query = { subject_type: subjectType, subject_id: subject.id, cursor };
    const data = validateSubjectAuditPage(await readData(fetcher, "audit/subject?" + auditQueryString(query), signal) as BoSubjectAuditPage, query, [], cursor);
    return { status: "authorized", nextCursor: data.nextCursor, events: data.events.map(event => ({ id: event.id, at: event.occurred_at, actor: event.actor_label, action: event.action, outcome: event.outcome, source: "Core", subject, redacted: true })) };
  } }) };
}
