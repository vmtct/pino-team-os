// PAP-2377 / PAP-2342 — staging-only consumer of the named private Identity RPC.
// This returns only the synthetic reviewer decision; it does not render, grant
// real-data access, authenticate a browser, or accept client assertions.
const routes = new Map([["/piner/house","house"],["/piner/house/grid","house"],
  ["/piner/mytime","mytime"],["/piner/mytime/grid","mytime"]]);
export async function readSyntheticReviewDecision(request, binding, memberChrome, enabled) {
  const deny = { allowed: false };
  try {
    const url = new URL(request.url), program = routes.get(url.pathname);
    if (enabled !== "true" || memberChrome?.runtime !== true || !program ||
        url.origin !== "https://app.staging.pinohouse.art" || url.username || url.password ||
        !["GET","HEAD"].includes(request.method) ||
        ["cross-site","same-site"].includes(request.headers.get("sec-fetch-site")) ||
        typeof binding?.verify !== "function") return deny;
    const result = await binding.verify(request);
    if (result?.allowed !== true || result.program !== program ||
        Object.keys(result).length !== 2) return deny;
    return { allowed: true, program };
  } catch {
    return deny;
  }
}
