/**
 * PAP-1407 / PAP-220 — Founder-only HO Staff Center registration links BFF.
 * Never expose opaque link bearers to BO, public applicants or other surfaces.
 */
import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { callFounderCoreWithStaffPassword, type PinoCoreBinding } from "./founder-core";
import { teamCredential, TeamAuthError } from "./team-auth";

export interface HoStaffCenterLinksEnv extends HoEnv { PINO_CORE?: PinoCoreBinding }
const ROOT = "/api/ho/staff-center-links/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[a-zA-Z0-9_-]{43}$/;
const IDEMPOTENCY = /^[a-zA-Z0-9_-]{8,120}$/;
type LinkView = { centerId: string; token: string; enabled: boolean; version: number; updatedAt: string | null };

export function parseHoStaffLinkPath(pathname: string, method: string):
  | { centerId: string; corePath: string; kind: "read" | "status" }
  | null {
  if (!pathname.startsWith(ROOT)) return null;
  const tail = pathname.slice(ROOT.length).split("/");
  if (tail.length < 1 || tail.length > 2 || !UUID.test(tail[0] ?? "")) return null;
  const kind = tail.length === 1 && method === "GET" ? "read"
    : tail.length === 2 && tail[1] === "status" && method === "POST" ? "status" : null;
  if (!kind) return null;
  return { centerId: tail[0]!, kind,
    corePath: "workforce/staff-center-registration-links/" + tail[0] + (kind === "status" ? "/status" : "") };
}
export function parseHoStaffLinkStatus(input: unknown): { enabled: boolean; expectedVersion: number } | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (Object.keys(value).length !== 2 || typeof value.enabled !== "boolean"
    || typeof value.expectedVersion !== "number" || !Number.isSafeInteger(value.expectedVersion)
    || value.expectedVersion < 0) return null;
  return { enabled: value.enabled, expectedVersion: value.expectedVersion };
}
export function parseHoStaffLinkView(value: unknown, centerId: string): LinkView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.centerId !== centerId || !TOKEN.test(String(raw.token ?? ""))
    || typeof raw.enabled !== "boolean" || typeof raw.version !== "number"
    || !Number.isSafeInteger(raw.version) || raw.version < 0
    || !(raw.updatedAt === null || typeof raw.updatedAt === "string")) return null;
  return {
    centerId, token: raw.token as string, enabled: raw.enabled,
    version: raw.version, updatedAt: raw.updatedAt as string | null,
  };
}
/** PAP-1540 / PAP-220: Core status POST is a write receipt, not the GET link DTO.
 * The writer provides replayed but no updatedAt. Do not report 502 after an
 * accepted atomic write solely because the read-only projection differs.
 * The HO UI independently GETs and checks the committed state/version. */
export function parseHoStaffLinkResponse(
  value: unknown, centerId: string, kind: "read" | "status",
): LinkView | null {
  if (kind === "read") return parseHoStaffLinkView(value, centerId);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const permitted = ["centerId", "token", "enabled", "version", "replayed", "updatedAt"];
  if (Object.keys(raw).some(key => !permitted.includes(key)) ||
      !["centerId", "token", "enabled", "version", "replayed"].every(key => Object.hasOwn(raw, key)) ||
      typeof raw.replayed !== "boolean") return null;
  return parseHoStaffLinkView({ ...raw, updatedAt: raw.updatedAt ?? null }, centerId);
}
const reply = (body: unknown, status: number) => Response.json(body, {
  status, headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" },
});
const deny = (status: number) => reply({ error: { code: "HO_STAFF_LINK_UNAVAILABLE" } }, status);
export async function handleHoStaffCenterLinks(request: Request, env: HoStaffCenterLinksEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (env.APP_ENV !== "staging" || url.protocol !== "https:" || url.port || url.username || url.password
      || url.hostname !== HO_STAGING_HOSTNAME || normalizeHostname(request.headers.get("host") || "") !== HO_STAGING_HOSTNAME
      || url.search || url.hash) return deny(404);
    const route = parseHoStaffLinkPath(url.pathname, request.method);
    if (!route) return deny(404);
    if (route.kind === "status") {
      if (request.headers.get("origin") !== url.origin
        || request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return deny(403);
      if (!IDEMPOTENCY.test(request.headers.get("idempotency-key") ?? "")) return deny(400);
    }
    await authorizeHoShell(request.headers, env);
    const credential = await teamCredential(request, env, "BO");
    if (credential.kind !== "password") return deny(401);
    if (!env.PINO_CORE || typeof env.PINO_CORE.executeWithStaffPassword !== "function") return deny(503);
    let body: { enabled: boolean; expectedVersion: number } | undefined;
    if (route.kind === "status") {
      const raw = await request.text();
      if (raw.length > 1000) return deny(413);
      const input = parseHoStaffLinkStatus(JSON.parse(raw) as unknown);
      if (!input) return deny(400);
      body = input;
    }
    const result = await callFounderCoreWithStaffPassword(env.PINO_CORE, {
      method: request.method, path: route.corePath,
      ...(body ? { body, idempotencyKey: request.headers.get("idempotency-key")! } : {}),
    }, credential.token);
    if (result.status !== 200) return deny(result.status >= 400 && result.status < 600 ? result.status : 502);
    const raw = result.body && typeof result.body === "object" && "data" in result.body
      ? (result.body as { data: unknown }).data : null;
    const link = parseHoStaffLinkResponse(raw, route.centerId, route.kind);
    if (!link) return deny(502);
    return reply({ data: link }, 200);
  } catch (error) {
    if (error instanceof BoShellGateError || error instanceof TeamAuthError) return deny(error.status);
    if (error instanceof SyntaxError) return deny(400);
    return deny(503);
  }
}
