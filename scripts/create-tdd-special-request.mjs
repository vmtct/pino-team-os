/** PAP-1085: request data only; never writes admission or Founder approvals. */
import path from "node:path";
import { fileURLToPath } from "node:url";

const usage = "Usage: npm run tdd:new-special-request -- --surface=bo|ho --key=module-key --route=/ho/exact-route --owner=PAP-1234";
export function createSpecialRequest({ surface, key, route, owner }) {
  if (!["bo", "ho"].includes(surface) || typeof key !== "string" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(key) || key.length > 60 ||
      typeof route !== "string" || route.length > 240 || !route.startsWith("/" + surface + "/") || !/^\/(?:[a-z][a-z0-9-]*\/)*[a-z][a-z0-9-]*$/.test(route) ||
      typeof owner !== "string" || !/^PAP-[1-9][0-9]*$/.test(owner)) throw Error(usage);
  return {
    id: `${owner}-${surface}-${key}`, status: "requested", surface: surface.toUpperCase(), key, route, owner,
    justification: "", designAuthority: "", fallback: "", permissions: [],
    files: ["app" + route + "/page.tsx"],
    tests: { security: [], authorization: [], accessibility: [], responsive: [], visual: [], e2e: [] },
    reviewTrigger: "", expiresAt: null,
    approvedBy: null, reference: null, approvedAt: null,
  };
}
export function parseSpecialRequestArgs(args) {
  const options = {};
  for (const arg of args) {
    const match = /^--(surface|key|route|owner)=(.+)$/.exec(arg);
    if (!match || Object.hasOwn(options, match[1])) throw Error(usage);
    options[match[1]] = match[2];
  }
  return createSpecialRequest(options);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(JSON.stringify(parseSpecialRequestArgs(process.argv.slice(2)), null, 2) + "\n"); }
  catch { process.stderr.write(usage + "\n"); process.exitCode = 1; }
}
