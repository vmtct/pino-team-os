// PAP-1952 / PNR-APP-HUB — Staging ONLY, suppress Cloudflare automatic HTML mutation
// without allowing third-party scripts or weakening no-store on member shell responses.
import base from "./worker.mjs";
const PIN_ROUTES = new Map([
  ["/api/piner/afterschool/pin/login", "POST"],
  ["/api/piner/afterschool/pin/change", "POST"],
  ["/api/piner/afterschool/session", "GET"],
  ["/api/piner/afterschool/students", "GET"],
  ["/api/piner/afterschool/logout", "POST"],
]);

async function forwardAfterschoolPin(request, service, method) {
  if (request.method !== method) {
    return new Response(null, { status: 405, headers: { Allow: method } });
  }
  try {
    // Forward the original request so Identity can validate its origin and session.
    if (service) return await service.fetch(request);
  } catch {
    // The shell can still render if the Identity Worker is unavailable.
  }
  return Response.json({ error: { code: "identity_unavailable" } }, { status: 503 });
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    const isPinRoute = path.startsWith("/api/piner/afterschool/");
    const method = PIN_ROUTES.get(path);
    const response = method
      ? await forwardAfterschoolPin(request, env?.AFTERSCHOOL_PIN_WORKER, method)
      : isPinRoute ? new Response(null, { status: 404 }) : await base.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    headers.set("X-Piner-Environment", "staging");
    if (isPinRoute) {
      headers.set("Cache-Control", "no-store, no-transform");
      headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    } else if ((headers.get("Content-Type") || "").includes("text/html")) {
      headers.set("Cache-Control", "no-store, no-transform");
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
