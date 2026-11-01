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
  centerId: string;
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
  if (!uuid.test(requestedCenterId) || !body || typeof body !== "object" || !("data" in body)) return null;
  const items = (body as { data?: unknown }).data;
  if (!Array.isArray(items)) return null;
  const rows: HoShiftTemplateRow[] = [];
  const ids = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const v = item as Record<string, unknown>;
    if (!uuid.test(String(v.id)) || !uuid.test(String(v.centerId))
      || v.centerId !== requestedCenterId || ids.has(String(v.id))
      || typeof v.code !== "string" || !v.code.trim() || v.code.length > 64
      || typeof v.displayLabel !== "string" || !v.displayLabel.trim() || v.displayLabel.length > 160
      || typeof v.startLocalTime !== "string" || !time.test(v.startLocalTime)
      || typeof v.endLocalTime !== "string" || !time.test(v.endLocalTime)
      || v.endLocalTime <= v.startLocalTime
      || (v.status !== "ACTIVE" && v.status !== "INACTIVE")
      || typeof v.createdAt !== "string" || Number.isNaN(Date.parse(v.createdAt))
      || typeof v.updatedAt !== "string" || Number.isNaN(Date.parse(v.updatedAt))) return null;
    ids.add(v.id as string);
    rows.push({
      id: v.id as string, centerId: v.centerId as string,
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
    if (!centerId || !uuid.test(centerId) || [...url.searchParams.keys()].some(k => k !== "centerId")
      || url.searchParams.getAll("centerId").length !== 1) return json({ error: { code: "PLATFORM_INVALID_INPUT" } }, 400);
    const actor = await authorizeHoShell(request.headers, env);
    if (!actor.userId || !actor.permissionKeys.includes("workforce.shift_template.ho_manage"))
      return json({ error: { code: "HO_SHIFT_TEMPLATE_ACCESS_DENIED" } }, 403);
    const credential = await teamCredential(request, env, "BO");
    if (credential.kind !== "password") return json({ error: { code: "IDENTITY_UNAUTHORIZED" } }, 401);
    const response = await env.PINO_WORKFORCE_CORE.executePlanningWithStaffPassword({
      method: "GET", path: "shift-templates/ho", body: { centerId },
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
