/** PAP-1320: projection of PAP-1318 private planning contracts; never persistence types. */
export const GLOBAL_TERMS_API = "/api/ho/operating-cycle/global-terms";
export const GLOBAL_TERMS_PERMISSION = "operating_cycle.global_week.manage";
export const termUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isGlobalTermsRequest(path: string, method: string): boolean {
  if (path === GLOBAL_TERMS_API) return method === "GET" || method === "POST";
  const match = path.match(/^\/api\/ho\/operating-cycle\/global-terms\/([^/]+)(?:\/(update|delete))?$/);
  return !!match && termUuid.test(match[1]!) && (match[2] ? method === "POST" : method === "GET");
}
export type GlobalTerm = { id: string; name: string; code: string; startDate: string; endDate: string; weekCount: number; updatedAt: string; scopeType: "GLOBAL" };
export type GlobalTermWeek = { id: string; termId: string; code: string; ordinal: number; startDate: string; endDate: string; rhythmKey: string };
export type GlobalTermAudit = { id: string; occurredAt: string; action: string; actorId: string | null };
export type GlobalTermDetail = GlobalTerm & { weeks: GlobalTermWeek[]; history: GlobalTermAudit[] | null };
export const object = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
export function calendarDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00.000Z");
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === v;
}
export const timestamp = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const text = (v: unknown, max: number): v is string => typeof v === "string" && !!v.trim() && v === v.trim() && v.length <= max;
export function parseCoreTerm(value: unknown, weekCount?: number): GlobalTerm | null {
  const t = object(value);
  if (!t || typeof t.id !== "string" || !termUuid.test(t.id) || t.scopeType !== "GLOBAL" ||
    !text(t.displayName, 160) || !text(t.code, 96) || !calendarDate(t.startDate) || !calendarDate(t.endDate) || t.endDate < t.startDate || !timestamp(t.updatedAt)) return null;
  const count = weekCount ?? t.weekCount;
  if (!Number.isSafeInteger(count) || Number(count) < 0) return null;
  return { id: t.id, name: t.displayName, code: t.code, startDate: t.startDate, endDate: t.endDate, updatedAt: t.updatedAt, scopeType: "GLOBAL", weekCount: Number(count) };
}
export function parseCoreTermList(body: unknown): GlobalTerm[] | null {
  const data = object(body)?.data;
  if (!Array.isArray(data)) return null;
  const rows = data.map(t => parseCoreTerm(t));
  return rows.some(t => !t) || new Set(rows.map(t => t?.id)).size !== rows.length ? null : rows as GlobalTerm[];
}
export function parseCoreTermDetail(body: unknown): GlobalTermDetail | null {
  const d = object(object(body)?.data);
  if (!d || !Array.isArray(d.weeks)) return null;
  const term = parseCoreTerm(d, d.weeks.length);
  if (!term) return null;
  const weeks: GlobalTermWeek[] = [];
  for (const raw of d.weeks) {
    const w = object(raw);
    if (!w || typeof w.id !== "string" || !termUuid.test(w.id) || w.termId !== term.id || !text(w.code, 96) ||
      !Number.isSafeInteger(w.ordinal) || Number(w.ordinal) < 1 || !calendarDate(w.startDate) || !calendarDate(w.endDate) ||
      w.endDate < w.startDate || w.startDate < term.startDate || w.endDate > term.endDate || !text(w.rhythmKey, 96)) return null;
    weeks.push({ id: w.id, termId: term.id, code: w.code, ordinal: Number(w.ordinal), startDate: w.startDate, endDate: w.endDate, rhythmKey: w.rhythmKey });
  }
  if (new Set(weeks.map(w => w.id)).size !== weeks.length) return null;
  let history: GlobalTermAudit[] | null = null;
  if (d.history !== undefined && d.history !== null) {
    if (!Array.isArray(d.history)) return null;
    history = [];
    for (const raw of d.history) {
      const h = object(raw);
      if (!h || typeof h.id !== "string" || !termUuid.test(h.id) || !timestamp(h.occurredAt) || !text(h.action, 160) ||
        !(h.actorId === null || typeof h.actorId === "string" && termUuid.test(h.actorId))) return null;
      // Intentionally omit raw audit payload, Center anchor and private before/after.
      history.push({ id: h.id, occurredAt: h.occurredAt, action: h.action, actorId: h.actorId });
    }
  }
  return { ...term, weeks: weeks.sort((a, b) => a.ordinal - b.ordinal), history };
}
export type TermCommand = { displayName: string; code?: string; startDate?: string; endDate?: string; expectedUpdatedAt?: string };
export function parseTermCommand(body: unknown, action: "create" | "update" | "delete"): TermCommand | { expectedUpdatedAt: string } | null {
  const b = object(body);
  if (!b) return null;
  const allowed = action === "delete" ? ["expectedUpdatedAt"] : ["displayName", "code", "startDate", "endDate", ...(action === "update" ? ["expectedUpdatedAt"] : [])];
  if (Object.keys(b).some(k => !allowed.includes(k)) || action !== "create" && !timestamp(b.expectedUpdatedAt)) return null;
  if (action === "delete") return Object.keys(b).length === 1 ? { expectedUpdatedAt: b.expectedUpdatedAt as string } : null;
  if (!text(b.displayName, 160)) return null;
  if (action === "create" && (!text(b.code, 96) || !calendarDate(b.startDate) || !calendarDate(b.endDate))) return null;
  if (b.code !== undefined && !text(b.code, 96) || b.startDate !== undefined && !calendarDate(b.startDate) || b.endDate !== undefined && !calendarDate(b.endDate) ||
    typeof b.startDate === "string" && typeof b.endDate === "string" && b.endDate < b.startDate) return null;
  return b as TermCommand;
}
