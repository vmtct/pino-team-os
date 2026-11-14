// PAP-1952 / PNR-APP-HUB — Staging ONLY, suppress Cloudflare automatic HTML mutation
// without allowing third-party scripts or weakening no-store on member shell responses.
import base from "./worker.mjs";
export default {
  async fetch(request, env, ctx) {
    const response = await base.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    headers.set("X-Piner-Environment", "staging");
    if ((headers.get("Content-Type") || "").includes("text/html")) {
      headers.set("Cache-Control", "no-store, no-transform");
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
