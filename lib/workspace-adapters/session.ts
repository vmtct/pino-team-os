import { BoApiError } from "../bo-api-error";
import { decideHostBoundary, HO_STAGING_HOSTNAME, isBoHostname } from "../host-boundary";
import type { AuthorizationContext } from "../workspace-schema";
import type { SurfaceScope } from "./contracts";

export const adapterError = (status: number) => new BoApiError(status, "Không thể truy cập dữ liệu được yêu cầu.", null);
type Principal = { userId: string; permissionKeys: readonly string[] };
export type CenterSource = "centers" | "workforce/planning/bootstrap" | "delivery/calendar-scope";
/** No tokens, Authorization headers, client claims or schema grants accepted here.
 * Existing BFF/Core reauthorizes every operation; this projection controls UI only. */
export function surfaceSession(surface: "BO" | "HO", origin: string | undefined, fetcher: typeof fetch = fetch, center?: { id: string; source: CenterSource }) {
  const base = new URL(origin ?? window.location.origin);
  if (base.protocol !== "https:" || base.pathname !== "/" || base.search || base.hash || base.username || base.password ||
      (surface === "BO" ? !isBoHostname(base.hostname) : base.hostname !== HO_STAGING_HOSTNAME) ||
      (typeof window !== "undefined" && window.location.origin !== base.origin)) throw adapterError(404);
  if (surface === "BO" && (!center || !/^[0-9a-f-]{36}$/i.test(center.id))) throw adapterError(403);
  if (center && !["centers", "workforce/planning/bootstrap", "delivery/calendar-scope"].includes(center.source)) throw adapterError(403);
  if (surface === "HO" && center) throw adapterError(403);
  const scope: SurfaceScope = surface === "BO" ? Object.freeze({ surface, centerId: center!.id }) : Object.freeze({ surface });
  const lifetime = new AbortController();
  let principal: Principal | null = null, grants = new Set<string>(), revoked = false, generation = 0, applied = 0;
  const context: AuthorizationContext = Object.freeze({ ...scope, authorize: (permission: string) => !revoked && grants.has(permission) });
  const transport: typeof fetch = async (input, init) => {
    lifetime.signal.throwIfAborted();
    const url = new URL(input instanceof Request ? input.url : String(input), base);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const admittedHoPassInventory = surface === "HO" && method === "GET" && url.pathname === "/api/ho/open-studio/walkin/inventory";
    // PAP-1255: exact HO read route, explicit canonical Center; Core BFF rechecks Founder/ACL.
    const hoShiftTemplateQuery = url.searchParams.getAll("centerId");
    const admittedHoShiftTemplateRead = surface === "HO" && method === "GET" &&
      url.pathname === "/api/ho/workforce/shift-templates" && hoShiftTemplateQuery.length === 1 &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hoShiftTemplateQuery[0]!) &&
      [...url.searchParams.keys()].every(key => key === "centerId");
    const admittedHoDiary = surface === "HO" && method === "GET" && /^\/api\/ho\/learning\/path-diaries(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i.test(url.pathname);
    if (url.origin !== base.origin || !(url.pathname.startsWith("/api/bo/") || admittedHoPassInventory || admittedHoShiftTemplateRead || admittedHoDiary) || url.username || url.password || url.hash ||
        /%2f|%5c|\.\./i.test(url.pathname) || decideHostBoundary(base.host, url.pathname, method).action !== "next" ||
        (surface === "HO" && method !== "GET")) throw adapterError(404);
    const headers = new Headers(init?.headers);
    if (["authorization", "cookie", "host", "x-pino-surface"].some(key => headers.has(key))) throw adapterError(403);
    const signal = init?.signal ? AbortSignal.any([init.signal, lifetime.signal]) : lifetime.signal;
    const result = await fetcher(url.toString(), { ...init, method, headers, credentials: "same-origin", cache: "no-store", redirect: "error", signal });
    signal.throwIfAborted();
    const sessionOrScope = url.pathname === "/api/bo/context" || Boolean(center && url.pathname === "/api/bo/" + center.source);
    if (result.status === 401 || (result.status === 403 && sessionOrScope)) { grants.clear(); revoked = true; }
    return result;
  };
  async function json(path: string, signal: AbortSignal): Promise<unknown> {
    const response = await transport("/api/bo/" + path, { signal });
    if (!response.ok) throw adapterError(response.status);
    try { const body: unknown = await response.json(); if (!body || typeof body !== "object" || !("data" in body)) throw Error(); return body.data; }
    catch { throw adapterError(502); }
  }
  async function refresh(signal: AbortSignal) {
    signal.throwIfAborted();
    const current = ++generation;
    const data = await json("context", signal) as Record<string, unknown>;
    // HO uses the existing server HO gate before receiving this BO Core principal.
    if (!data || data.surface !== "BO" || data.entitled !== true || typeof data.userId !== "string" || !data.userId.trim() ||
        !Array.isArray(data.permissionKeys) || data.permissionKeys.some(p => typeof p !== "string")) throw adapterError(403);
    if (principal && principal.userId !== data.userId) { grants.clear(); revoked = true; throw adapterError(401); }
    if (revoked) throw adapterError(403);
    const next = new Set(data.permissionKeys as string[]);
    if (!next.has("team.bo.access")) { grants.clear(); revoked = true; throw adapterError(403); }
    if (center) {
      const allowed = await json(center.source, signal);
      const centers = center.source === "centers" ? allowed : (allowed as { centers?: unknown })?.centers;
      if (!Array.isArray(centers) || !centers.some(c => c && typeof c === "object" && c.id === center.id)) { grants.clear(); revoked = true; throw adapterError(403); }
    }
    signal.throwIfAborted();
    if (current < applied) {
      if (principal && next.size === grants.size && [...next].every(key => grants.has(key))) return principal;
      throw adapterError(409);
    }
    applied = current;
    principal = { userId: data.userId, permissionKeys: [...next] }; grants = next;
    return principal;
  }
  return { scope, context, transport, refresh, json, origin: base.origin, get principal() { return principal; },
    revoke: () => { grants.clear(); revoked = true; },
    dispose: () => { grants.clear(); revoked = true; lifetime.abort(); } };
}
export type SurfaceSession = ReturnType<typeof surfaceSession>;
