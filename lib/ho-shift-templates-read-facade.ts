import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { teamCredential, TeamAuthError } from "./team-auth";
import type { WorkforcePlanningCoreBinding } from "./bo-workforce-planning-handler";

export interface HoShiftTemplatesEnv extends HoEnv {
  PINO_WORKFORCE_CORE: WorkforcePlanningCoreBinding;
}
export type HoShiftTemplateRow = {
  id: string;
  scopeType: "GLOBAL" | "CENTER";
  centerId: string | null;
  assignmentCount?: number;
  availabilityCount?: number;
  history?: Array<{id:string;occurredAt:string;actorId:string|null;action:string;changes:Array<{field:string;before:string|null;after:string|null}>}>;
  code: string;
  displayLabel: string;
  startLocalTime: string;
  endLocalTime: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const json = (body: unknown, status: number) => Response.json(body, {
  status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
});

/** Fail closed: never synthesize templates, statuses or a default Center. */
export function parseHoShiftTemplates(body: unknown, requestedCenterId: string): HoShiftTemplateRow[] | null {
  if ((!uuid.test(requestedCenterId) && !["ALL","GLOBAL"].includes(requestedCenterId)) || !body || typeof body !== "object" || !("data" in body)) return null;
  const items = (body as { data?: unknown }).data;
  if (!Array.isArray(items)) return null;
  const rows: HoShiftTemplateRow[] = [];
  const ids = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const v = item as Record<string, unknown>;
    const scopeType=v.scopeType === undefined ? "CENTER" : v.scopeType;
    const validScope=scopeType==="GLOBAL" ? v.centerId===null : scopeType==="CENTER" && uuid.test(String(v.centerId));
    if (!validScope || !uuid.test(String(v.id))
      || (requestedCenterId!=="ALL" && (requestedCenterId==="GLOBAL" ? scopeType!=="GLOBAL" : v.centerId!==requestedCenterId)) || ids.has(String(v.id))
      || typeof v.code !== "string" || !v.code.trim() || v.code.length > 64
      || typeof v.displayLabel !== "string" || !v.displayLabel.trim() || v.displayLabel.length > 160
      || typeof v.startLocalTime !== "string" || !time.test(v.startLocalTime)
      || typeof v.endLocalTime !== "string" || !time.test(v.endLocalTime)
      || v.endLocalTime <= v.startLocalTime
      || (v.status !== "ACTIVE" && v.status !== "INACTIVE")
      || typeof v.createdAt !== "string" || Number.isNaN(Date.parse(v.createdAt))
      || typeof v.updatedAt !== "string" || Number.isNaN(Date.parse(v.updatedAt))) return null;
    if ([v.assignmentCount,v.availabilityCount].some(n=>n!==undefined && (!Number.isSafeInteger(n) || Number(n)<0))) return null;
    if(v.history!==undefined && (!Array.isArray(v.history) || v.history.length>100 || v.history.some(h=>!validHistory(h))))return null;
    ids.add(v.id as string);
    rows.push({
      id: v.id as string, scopeType, centerId: v.centerId as string|null,
      ...(v.assignmentCount===undefined?{}:{assignmentCount:v.assignmentCount}),
      ...(v.availabilityCount===undefined?{}:{availabilityCount:v.availabilityCount}),
      ...(v.history===undefined?{}:{history:v.history}),
      code: v.code, displayLabel: v.displayLabel,
      startLocalTime: v.startLocalTime, endLocalTime: v.endLocalTime,
      status: v.status, createdAt: v.createdAt, updatedAt: v.updatedAt,
    } as HoShiftTemplateRow);
  }
  return rows.sort((a, b) => a.startLocalTime.localeCompare(b.startLocalTime) || a.code.localeCompare(b.code) || a.id.localeCompare(b.id));
}

export async function handleHoShiftTemplatesRead(request: Request, env: HoShiftTemplatesEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (env.APP_ENV !== "staging"
      || normalizeHostname(request.headers.get("host") || url.hostname) !== HO_STAGING_HOSTNAME
      || url.pathname !== "/api/ho/workforce/shift-templates") return json({ error: { code: "PLATFORM_NOT_FOUND" } }, 404);
    if (request.method !== "GET") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED" } }, 405);
    const centerId = url.searchParams.get("centerId");
    if (!centerId || (!uuid.test(centerId) && !["ALL","GLOBAL"].includes(centerId)) || [...url.searchParams.keys()].some(k => k !== "centerId")
      || url.searchParams.getAll("centerId").length !== 1) return json({ error: { code: "PLATFORM_INVALID_INPUT" } }, 400);
    const actor = await authorizeHoShell(request.headers, env);
    if (!actor.userId || !actor.permissionKeys.includes("workforce.shift_template.ho_manage"))
      return json({ error: { code: "HO_SHIFT_TEMPLATE_ACCESS_DENIED" } }, 403);
    const credential = await teamCredential(request, env, "BO");
    if (credential.kind !== "password") return json({ error: { code: "IDENTITY_UNAUTHORIZED" } }, 401);
    const response = await env.PINO_WORKFORCE_CORE.executePlanningWithStaffPassword({
      method: "GET", path: "shift-templates/ho", body: centerId==="ALL"?{}:centerId==="GLOBAL"?{scopeType:"GLOBAL",centerId:null}:{scopeType:"CENTER",centerId},
    }, credential.token);
    if (response.status !== 200) return json(response.body, response.status);
    const rows = parseHoShiftTemplates(response.body, centerId);
    if (!rows) return json({ error: { code: "HO_SHIFT_TEMPLATE_DATA_INVALID" } }, 502);
    return json({ data: rows }, 200);
  } catch (error) {
    if (error instanceof BoShellGateError) return json({ error: { code: "HO_ACCESS_DENIED" } }, error.status);
    if (error instanceof TeamAuthError) return json({ error: { code: "IDENTITY_UNAUTHORIZED" } }, error.status);
    return json({ error: { code: "HO_SHIFT_TEMPLATE_UNAVAILABLE" } }, 503);
  }
}

function validHistory(value:unknown):boolean {
 if(!value || typeof value!=="object")return false;
 const h=value as Record<string,unknown>;
 return uuid.test(String(h.id)) && typeof h.occurredAt==="string" && Number.isFinite(Date.parse(h.occurredAt)) &&
  (h.actorId===null || uuid.test(String(h.actorId))) && typeof h.action==="string" && h.action.startsWith("WORKFORCE_SHIFT_TEMPLATE_") &&
  Array.isArray(h.changes) && h.changes.every(c=>c && typeof c==="object" &&
   ["code","displayLabel","startLocalTime","endLocalTime","status"].includes(c.field) &&
   (c.before===null || typeof c.before==="string") && (c.after===null || typeof c.after==="string"));
}
