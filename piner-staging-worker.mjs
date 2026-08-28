import openNextWorker from "./.open-next/worker.js";

const ALLOWED_PREFIXES = [
  "/piner-space",
  "/piner-prototype",
  "/_next/",
  "/cdn-cgi/image/",
];

function isAllowedPath(pathname) {
  return ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function withNoIndex(response) {
  const staged = new Response(response.body, response);
  staged.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return staged;
}

const stagingWorker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/_next/static/")) {
      return withNoIndex(await env.ASSETS.fetch(request));
    }

    if (url.pathname === "/") {
      return Response.redirect(new URL("/piner-space", url), 302);
    }

    if (!isAllowedPath(url.pathname)) {
      return new Response("Not Found", {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
      });
    }

    return withNoIndex(await openNextWorker.fetch(request, env, ctx));
  },
};

export default stagingWorker;
