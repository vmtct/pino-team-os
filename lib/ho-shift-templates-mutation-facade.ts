import { authorizeHoShell } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { teamCredential, TeamAuthError } from "./team-auth";
import { parseHoShiftTemplates, type HoShiftTemplatesEnv, type HoShiftTemplateRow } from "./ho-shift-templates-read-facade";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const replay = /^[A-Za-z0-9:_-]{8,120}$/;
const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const json = (body: unknown, status: number) => Response.json(body, {
  status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
});
type Form = { centerId: string; code: string; displayLabel: string; startLocalTime: string; endLocalTime: string; expectedUpdatedAt?: string };
type StatusForm = { centerId: string; status: "ACTIVE" | "INACTIVE"; expectedUpdatedAt: string };
export type HoShiftTemplateWriteAction = "create" | "update" | "status";

/** Exact, explicit fields: no silent Center substitution, legacy BO commands, or forged CAS. */
export function parseHoShiftTemplateWrite(body: unknown, action: HoShiftTemplateWriteAction): Form | StatusForm | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const v = body as Record<string, unknown>;
  if (!uuid.test(String(v.centerId))) return null;
  const verifyVersion = (value: unknown) =>
    typeof value === "string" && iso.test(value) && Number.isFinite(Date.parse(value));
  if (action === "status") {
    if (Object.keys(v).length !== 3 || !["ACTIVE", "INACTIVE"].includes(String(v.status))
      || !verifyVersion(v.expectedUpdatedAt)) return null;
    return { centerId: v.centerId as string, status: v.status as "ACTIVE" | "INACTIVE",
      expectedUpdatedAt: v.expectedUpdatedAt as string };
  }
  const expectedFields = action === "create" ? 5 : 6;
  if (Object.keys(v).length !== expectedFields
    || typeof v.code !== "string" || !v.code.trim() || v.code !== v.code.trim() || v.code.length > 64
    || typeof v.displayLabel !== "string" || !v.displayLabel.trim() || v.displayLabel !== v.displayLabel.trim() || v.displayLabel.length > 160
    || typeof v.startLocalTime !== "string" || !time.test(v.startLocalTime)
    || typeof v.endLocalTime !== "string" || !time.test(v.endLocalTime)
    || v.endLocalTime <= v.startLocalTime
    || (action === "update" && !verifyVersion(v.expectedUpdatedAt))) return null;
  const base: Form = {
    centerId: v.centerId as string, code: v.code, displayLabel: v.displayLabel,
    startLocalTime: v.startLocalTime, endLocalTime: v.endLocalTime,
  };
  return action === "update" ? { ...base, expectedUpdatedAt: v.expectedUpdatedAt as string } : base;
}

function parseWritePath(path: string): { action: HoShiftTemplateWriteAction; templateId?: string } | null {
  if (path === "/api/ho/workforce/shift-templates") return { action: "create" };
  const matched = path.match(/^\/api\/ho\/workforce\/shift-templates\/([0-9a-f-]{36})\/(status|update)$/i);
  return matched && uuid.test(matched[1]!) ? { action: matched[2] as "status" | "update", templateId: matched[1] } : null;
}
function matches(expected: Form | StatusForm, row: HoShiftTemplateRow): boolean {
  return Object.entries(expected).every(([k, v]) => k === "expectedUpdatedAt" || (row as unknown as Record<string, unknown>)[k] === v);
}
export async function handleHoShiftTemplateWrite(request: Request, env: HoShiftTemplatesEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const location = parseWritePath(url.pathname);
    if (env.APP_ENV !== "staging" || normalizeHostname(request.headers.get("host") || url.hostname) !== HO_STAGING_HOSTNAME
      || !location) return json({ error: { code: "PLATFORM_NOT_FOUND" } }, 404);
    if (request.method !== "POST") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED" } }, 405);
    if (url.search || request.headers.get("origin") !== "https://" + HO_STAGING_HOSTNAME
      || !request.headers.get("content-type")?.startsWith("application/json"))
      return json({ error: { code: "HO_REQUEST_DENIED" } }, 403);
    const key = request.headers.get("idempotency-key")?.trim();
    if (!key || !replay.test(key)) return json({ error: { code: "PLATFORM_INVALID_INPUT" } }, 400);
    const input = parseHoShiftTemplateWrite(await request.json().catch(() => null), location.action);
    if (!input) return json({ error: { code: "PLATFORM_INVALID_INPUT" } }, 400);
    const actor = await authorizeHoShell(request.headers, env);
    if (!actor.userId || !actor.permissionKeys.includes("workforce.shift_template.ho_manage"))
      return json({ error: { code: "HO_SHIFT_TEMPLATE_MUTATION_DENIED" } }, 403);
    const credential = await teamCredential(request, env, "BO");
    if (credential.kind !== "password") return json({ error: { code: "IDENTITY_UNAUTHORIZED" } }, 401);
    const core = env.PINO_WORKFORCE_CORE;
    const path = location.action === "create" ? "shift-templates/ho"
      : "shift-templates/ho/" + location.templateId + "/" + location.action;
    const result = await core.executePlanningWithStaffPassword({
      method: "POST", path, body: input, idempotencyKey: key,
    }, credential.token);
    const desiredStatus = location.action === "create" ? 201 : 200;
    if (result.status !== desiredStatus) return json(result.body, result.status);
    const receipt = parseHoShiftTemplates({ data: [(result.body as { data?: unknown } | null)?.data] }, input.centerId)?.[0];
    if (!receipt || (location.templateId && receipt.id !== location.templateId) || !matches(input, receipt))
      return json({ error: { code: "HO_SHIFT_TEMPLATE_CONFIRMATION_FAILED" } }, 502);
    const read = await core.executePlanningWithStaffPassword({
      method: "GET", path: "shift-templates/ho", body: { centerId: input.centerId },
    }, credential.token);
    if (read.status !== 200) return json(read.body, read.status);
    const rows = parseHoShiftTemplates(read.body, input.centerId);
    const confirmed = rows?.find(row => row.id === receipt.id);
    if (!confirmed || !matches(input, confirmed) || confirmed.updatedAt !== receipt.updatedAt)
      return json({ error: { code: "HO_SHIFT_TEMPLATE_READBACK_MISMATCH" } }, 502);
    return json({ data: confirmed }, desiredStatus);
  } catch (error) {
    if (error instanceof BoShellGateError) return json({ error: { code: "HO_ACCESS_DENIED" } }, error.status);
    if (error instanceof TeamAuthError) return json({ error: { code: "IDENTITY_UNAUTHORIZED" } }, error.status);
    return json({ error: { code: "HO_SHIFT_TEMPLATE_UNAVAILABLE" } }, 503);
  }
}
