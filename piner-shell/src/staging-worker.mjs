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

const LOGIN_PATH = "/piner-space/afterschool/login";
const NEXT_STATIC = /^\/_next\/static\/(?:[\w.-]+\/)*[\w.-]+\.(?:js|css|woff2)$/;

async function forwardAfterschoolPin(request, service, allowedMethods) {
  if (!allowedMethods.includes(request.method)) {
    return new Response(null, { status: 405, headers: { Allow: allowedMethods.join(", ") } });
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
    const isLogin = path === LOGIN_PATH;
    const isAsset = NEXT_STATIC.test(path);
    const method = PIN_ROUTES.get(path);
    const allowedMethods = isLogin || isAsset ? ["GET", "HEAD"] : method ? [method] : null;
    const response = allowedMethods
      ? await forwardAfterschoolPin(request, env?.AFTERSCHOOL_PIN_WORKER, allowedMethods)
      : isPinRoute ? new Response(null, { status: 404 }) : await base.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    headers.set("X-Piner-Environment", "staging");
    if (isPinRoute || isLogin || isAsset) {
      headers.set("Cache-Control", "no-store, no-transform");
      headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      headers.set("X-Content-Type-Options", "nosniff");
      if (isLogin) {
        headers.set("X-Frame-Options", "DENY");
        headers.set("Referrer-Policy", "no-referrer");
      }
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
