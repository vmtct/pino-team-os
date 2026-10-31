import { BoApiError } from "@/lib/bo-api-error";
import { readData } from "@/lib/workspace-adapters/providers";
import type { SurfaceProvider, SurfaceScope } from "@/lib/workspace-adapters";
import type { ModuleRow } from "@/lib/workspace-schema";
import type { ParentFields } from "./schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Row = ModuleRow<ParentFields>;
type Json = Record<string, unknown>;
function invalid(status = 502): never { throw new BoApiError(status, "Core Parent scope receipt or read projection is invalid.", null); }
function asObject(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Json;
}
function center(scope: SurfaceScope): string {
  if (scope.surface !== "BO" || !UUID.test(scope.centerId)) return invalid(403);
  return scope.centerId;
}
function receipt(value: unknown, centerId: string): Json {
  const payload = asObject(value);
  // No unscoped/legacy fallback. Only Core may attest the selected Center.
  if (payload.scopeCenterId !== centerId) return invalid(403);
  return payload;
}
function row(value: unknown): Row {
  const item = asObject(value);
  if (Object.keys(item).some(key => !["id","displayName","maskedContact","linkedStudentCount","centers","updatedAt","attention"].includes(key))) return invalid();
  if (typeof item.id !== "string" || !UUID.test(item.id) ||
      (item.displayName !== null && typeof item.displayName !== "string") ||
      (item.maskedContact !== null && (typeof item.maskedContact !== "string" || !/[•*]/.test(item.maskedContact))) ||
      !Number.isSafeInteger(item.linkedStudentCount) || Number(item.linkedStudentCount) < 0 ||
      !Array.isArray(item.centers) || item.centers.some(x => typeof x !== "string" || !x.trim()) ||
      typeof item.updatedAt !== "string" || !Number.isFinite(Date.parse(item.updatedAt)) ||
      (item.attention !== null && typeof item.attention !== "string")) return invalid();
  return {
    id: item.id, name: item.displayName === null ? "Chưa có tên" : item.displayName as string,
    maskedContact: item.maskedContact as string | null, studentCount: Number(item.linkedStudentCount),
    centers: (item.centers as string[]).join(", "), updatedAt: item.updatedAt as string,
    attention: item.attention as string | null,
  };
}
/** Canonical read-only directory: Core attests and SQL-binds the selected BO Center. */
export async function readScopedParentDirectory(centerId: string, fetcher: typeof fetch, signal: AbortSignal): Promise<Row[]> {
  if (!UUID.test(centerId)) return invalid(403);
  const rows: Row[] = [], seen = new Set<string>();
  let total: number | null = null;
  for (let page = 0; page < 100; page++) {
    const offset = page * 100;
    const query = new URLSearchParams({ centerId, limit: "100", offset: String(offset) });
    const data = receipt(await readData(fetcher, "identity/parents/directory?" + query, signal), centerId);
    if (!Number.isSafeInteger(data.total) || Number(data.total) < 0 || Number(data.total) > 10000 ||
        data.limit !== 100 || data.offset !== offset || !Array.isArray(data.items) ||
        data.items.length > 100 || (total !== null && data.total !== total)) return invalid();
    total = Number(data.total);
    if (!data.items.length && rows.length !== total) return invalid();
    for (const item of data.items) {
      const entry = row(item);
      if (seen.has(entry.id)) return invalid();
      seen.add(entry.id); rows.push(entry);
    }
    if (rows.length === total) return rows;
    if (rows.length > total || rows.length !== offset + data.items.length) return invalid();
  }
  return invalid();
}
export type ScopedParentDetail = {
  id: string; scopeCenterId: string; auditAuthorized: boolean;
  students: readonly Json[]; contacts: readonly Json[]; audit: readonly Json[];
};
export async function readScopedParentDetail(
  id: string, scope: SurfaceScope, fetcher: typeof fetch, signal: AbortSignal,
): Promise<ScopedParentDetail> {
  const centerId = center(scope);
  if (!UUID.test(id)) return invalid(404);
  const query = new URLSearchParams({ centerId });
  const data = receipt(await readData(fetcher, "identity/parents/" + encodeURIComponent(id) + "/detail?" + query, signal), centerId);
  if (Object.keys(data).some(key => !["id","scopeCenterId","students","contacts","audit","auditAuthorized"].includes(key)) ||
      data.id !== id || typeof data.auditAuthorized !== "boolean" ||
      !Array.isArray(data.students) || !Array.isArray(data.contacts) || !Array.isArray(data.audit) ||
      [data.students, data.contacts, data.audit].some(list => list.length > 100) ||
      (!data.auditAuthorized && data.audit.length > 0)) return invalid();
  const students = data.students.map(raw => {
    const student = asObject(raw);
    if (Object.keys(student).some(key => !["id","name","relationship","linkedAt"].includes(key)) ||
        typeof student.id !== "string" || !UUID.test(student.id) ||
        typeof student.name !== "string" || typeof student.relationship !== "string" ||
        typeof student.linkedAt !== "string" || !Number.isFinite(Date.parse(student.linkedAt))) return invalid();
    return { id: student.id, name: student.name, relationship: student.relationship, linkedAt: student.linkedAt };
  });
  const contacts = data.contacts.map(raw => {
    const contact = asObject(raw);
    if (Object.keys(contact).some(key => !["id","type","maskedValue","primary","verified"].includes(key)) ||
        typeof contact.id !== "string" || !UUID.test(contact.id) ||
        !["PHONE","EMAIL"].includes(String(contact.type)) || typeof contact.maskedValue !== "string" ||
        !/[•*]/.test(contact.maskedValue) || typeof contact.primary !== "boolean" ||
        typeof contact.verified !== "boolean") return invalid();
    return { id: contact.id, type: contact.type, maskedValue: contact.maskedValue, primary: contact.primary, verified: contact.verified };
  });
  const audit = data.audit.map(raw => {
    const event = asObject(raw);
    if (Object.keys(event).some(key => !["id","at","action","outcome","actorType"].includes(key)) ||
        typeof event.id !== "string" || !UUID.test(event.id) ||
        typeof event.at !== "string" || !Number.isFinite(Date.parse(event.at)) ||
        typeof event.action !== "string" || !event.action ||
        !["succeeded","failed","denied"].includes(String(event.outcome)) ||
        typeof event.actorType !== "string" || !event.actorType) return invalid();
    return { id: event.id, at: event.at, action: event.action, outcome: event.outcome, actorType: event.actorType };
  });
  for (const values of [students, contacts, audit]) if (new Set(values.map(value => value.id)).size !== values.length) return invalid();
  return { id, scopeCenterId: centerId, auditAuthorized: data.auditAuthorized as boolean, students, contacts, audit };
}
/** No selected Center => no reads. Search/filter/paging stay in canonical local TDD table. */
export function parentDirectoryProvider(): SurfaceProvider<ParentFields> {
  return {
    pagination: "local-ui",
    list: async (_query, scope, fetcher, signal) => {
      const centerId = center(scope);
      const rows = await readScopedParentDirectory(centerId, fetcher, signal);
      return { records: rows.map(row => ({ row, centerId })), total: rows.length };
    },
    detail: async (id, scope, fetcher, signal) => {
      const centerId = center(scope);
      if (!UUID.test(id)) return invalid(404);
      const rows = await readScopedParentDirectory(centerId, fetcher, signal);
      const found = rows.find(x => x.id === id);
      if (!found) return null;
      await readScopedParentDetail(id, scope, fetcher, signal);
      return { row: found, centerId };
    },
    history: {
      subjectType: "parent_user",
      bind: (fetcher, scope) => ({
        kind: "provider", source: { adapter: "bo-parent-core-audit", permission: "access.audit.view" },
        load: async (subject, _context, cursor, signal) => {
          if (subject.type !== "parent_user" || cursor !== null) return invalid(400);
          const detail = await readScopedParentDetail(subject.id, scope, fetcher, signal);
          if (!detail.auditAuthorized) return { status: "denied" };
          const events = detail.audit.map(raw => {
            const a = asObject(raw);
            if (typeof a.id !== "string" || !UUID.test(a.id) || typeof a.at !== "string" ||
                !Number.isFinite(Date.parse(a.at)) || typeof a.action !== "string" || !a.action ||
                typeof a.actorType !== "string" || !a.actorType || !["succeeded","failed","denied"].includes(String(a.outcome))) return invalid();
            return { id: a.id as string, at: a.at as string, action: a.action as string,
              actor: a.actorType as string, outcome: a.outcome as "succeeded" | "failed" | "denied",
              source: "Core Parent detail", subject, redacted: true as const };
          });
          return { status: "authorized" as const, events, nextCursor: null };
        },
      }),
    },
  };
}
