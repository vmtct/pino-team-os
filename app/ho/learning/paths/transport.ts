/** PAP-1594 / PAP-1592 / Epic PAP-223 — bounded Path-only transport.
 * Keeps the shared HO session's permissions, refresh and disposal unchanged.
 * Exact GET Path route is reauthorized again by the existing HO BFF and Core.
 * No shared session admission-fence or other feature is modified.
 */
import type { FieldSchema } from "@/lib/workspace-schema";
import type { SurfaceOptions } from "@/lib/workspace-adapters/contracts";
import { surfaceSession, adapterError, type SurfaceSession } from "@/lib/workspace-adapters/session";
import { bindSurface } from "@/lib/workspace-adapters/adapter";

const route = "/api/ho/learning/paths";
const forbiddenHeaders = ["authorization", "cookie", "host", "x-pino-surface"];

export function pathReadTransport(session: SurfaceSession, fetcher: typeof fetch): typeof fetch {
  return (input, init) => {
    if (typeof input !== "string") return session.transport(input, init);
    const url = new URL(input, session.origin);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method !== "GET" || url.origin !== session.origin || url.pathname !== route ||
        url.search || url.hash || url.username || url.password ||
        /%2f|%5c|\.\./i.test(url.pathname))
      return session.transport(input, init);
    const headers = new Headers(init?.headers);
    if (forbiddenHeaders.some(key => headers.has(key))) return Promise.reject(adapterError(403));
    return fetcher(url.toString(), {
      ...init, method: "GET", headers,
      credentials: "same-origin", cache: "no-store", redirect: "error",
    });
  };
}

export async function createHoPathTddAdapter<F extends readonly FieldSchema[]>(
  options: SurfaceOptions<F>, signal: AbortSignal,
) {
  // surfaceSession validates the HTTPS HO origin and obtains the actual BO principal.
  const session = surfaceSession("HO", options.origin, options.fetcher);
  const scoped: SurfaceSession = {
    ...session,
    get principal() { return session.principal; },
    transport: pathReadTransport(session, options.fetcher ?? fetch),
  };
  try { return await bindSurface(scoped, options, signal); }
  catch(error) { session.dispose(); throw error; }
}
