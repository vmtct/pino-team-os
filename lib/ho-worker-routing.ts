import { decideHostBoundary } from "./host-boundary";
export interface HoStagingAssetsEnv { ASSETS: { fetch(request: Request): Promise<Response> } }
/** OpenNext needs an explicit static handoff when every request runs Worker-first.
 * Apply the exact host/method policy BEFORE ASSETS; never expose source artifacts.
 */
export async function handleHoStagingRequest(request: Request, env: HoStagingAssetsEnv, application: () => Promise<Response>): Promise<Response> {
  const url = new URL(request.url);
  const decision = decideHostBoundary(request.headers.get("host") || url.hostname, url.pathname, request.method);
  const denied = () => new Response("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
  if (decision.action === "not_found") return denied();
  if (decision.action === "redirect") return new Response(null, { status: 307, headers: { location: new URL(decision.pathname, url.origin).href, "cache-control": "no-store" } });
  const frameworkStatic = url.pathname.startsWith("/_next/static/");
  if (frameworkStatic && /[%\\]/.test(url.pathname)) return denied();
  const publicAsset = ["/team-legacy-global.css", "/bo-legacy-foundation.css", "/pap659-build-provenance.json", "/BUILD_ID", "/favicon.ico"].includes(url.pathname);
  if ((request.method === "GET" || request.method === "HEAD") && (frameworkStatic || publicAsset)) return env.ASSETS.fetch(request);
  return application();
}
