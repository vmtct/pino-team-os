/** PAP-901: fail CI when a canonical BO route has no explicit staging decision. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLICY = "app/bo/architecture/bo-staging-route-policy.ts";
const LAYOUT = "app/bo/layout.tsx";
const CI = ".github/workflows/pr-validation.yml";
const read = (root, file) => fs.readFileSync(path.join(root, file), "utf8");

function policyRoutes(source, name, issues) {
  const match = source.match(new RegExp(`\\bconst\\s+${name}\\s*=\\s*new Set(?:<string>)?\\s*\\(\\s*(\\[[\\s\\S]*?\\])\\s*\\);`));
  if (!match) { issues.push(`Missing literal ${name}`); return new Set(); }
  let routes;
  try { routes = JSON.parse(match[1].replace(/,\s*\]$/, "]")); }
  catch { issues.push(`${name} must contain only JSON string literals`); return new Set(); }
  if (!Array.isArray(routes) || routes.some(route => typeof route !== "string" || !/^\/bo\/[a-z0-9-]+$/.test(route))) {
    issues.push(`${name} must be a literal Set of BO route strings`);
    return new Set();
  }
  if (new Set(routes).size !== routes.length) issues.push(`Duplicate route in ${name}`);
  return new Set(routes);
}

function canonicalRoutes(root) {
  const base = path.join(root, "app/bo");
  const routes = new Set();
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name === "page.tsx" && /<BoModuleFactory\b/.test(fs.readFileSync(full, "utf8"))) {
        const relative = path.relative(base, dir).replaceAll(path.sep, "/");
        routes.add(`/bo/${relative}`);
      }
    }
  }
  visit(base);
  return routes;
}

export function verifyBoStagingRoutePolicy(root = ROOT) {
  const issues = [];
  const admitted = policyRoutes(read(root, POLICY), "boStagingAdmittedRoutes", issues);
  const deferred = policyRoutes(read(root, POLICY), "boStagingDeferredRoutes", issues);
  const canonical = canonicalRoutes(root);
  for (const route of canonical) {
    if (admitted.has(route) === deferred.has(route))
      issues.push(`${route}: canonical BO route needs exactly one staging decision (admitted or deferred)`);
  }
  for (const route of [...admitted, ...deferred]) {
    if (!canonical.has(route)) issues.push(`${route}: staging policy must reference a canonical BoModuleFactory page`);
  }

  const layout = read(root, LAYOUT);
  const admittedBranch = layout.match(/if\s*\(isBoStagingRouteAdmitted\(routePath\)\)\s*\{([^\n]*\n?[^\n]*\n?)/)?.[1] ?? "";
  if (!admittedBranch.includes('<link rel="stylesheet" href="/bo-legacy-foundation.css" />') ||
      !admittedBranch.includes("<BoShell "))
    issues.push("Admitted BO staging shell must load scoped V2.3 foundation CSS");
  if (!layout.includes('if (routePath !== "/bo" && routePath !== "/bo/") redirect("/bo")'))
    issues.push("Unadmitted UI-only BO routes must remain denied");
  if (!layout.includes('from "./architecture/bo-staging-route-policy"'))
    issues.push("BO layout must use the canonical staging route policy");

  const ci = read(root, CI);
  if (!ci.includes("node scripts/verify-bo-staging-route-policy.mjs") ||
      !ci.includes("node --test scripts/verify-bo-staging-route-policy.test.mjs"))
    issues.push("PR CI must enforce BO staging route policy and regressions");
  return { issues, canonical: canonical.size, admitted: admitted.size, deferred: deferred.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyBoStagingRoutePolicy();
  if (result.issues.length) {
    for (const issue of result.issues) console.error("BO_STAGING_ROUTE_FAIL:", issue);
    process.exitCode = 1;
  } else console.log(`BO_STAGING_ROUTE_PASS canonical=${result.canonical} admitted=${result.admitted} deferred=${result.deferred}`);
}
