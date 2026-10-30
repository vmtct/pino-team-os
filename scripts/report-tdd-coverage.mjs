/**
 * PAP-1077: filesystem route denominator only. This is not Staging/ACL attestation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = /^page\.(?:tsx?|jsx?)$/;
const normalized = name => name.split(path.sep).join("/");
const routeFromPage = file => "/" + file.replace(/^app\//, "").replace(/\/page\.(?:tsx?|jsx?)$/, "");
export function listPages(root) {
  const out = [];
  for (const surface of ["bo", "ho"]) {
    const start = path.join(root, "app", surface);
    if (!fs.existsSync(start)) continue;
    const walk = folder => {
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const abs = path.join(folder, entry.name);
        if (entry.isDirectory()) walk(abs);
        else if (entry.isFile() && PAGE.test(entry.name)) {
          out.push(normalized(path.relative(root, abs)));
        }
      }
    };
    walk(start);
  }
  return out.sort();
}
function count(rows) {
  const result = {};
  for (const r of rows) {
    result[r.category] = (result[r.category] ?? 0) + 1;
  }
  return result;
}
export function reportTddCoverage(root = ROOT) {
  const baseline = JSON.parse(fs.readFileSync(path.join(root,"config/tdd-inventory.json"),"utf8"));
  const manifest = JSON.parse(fs.readFileSync(path.join(root,"config/tdd-admission.json"),"utf8"));
  const specialPath = path.join(root,"config/tdd-approved-special.json");
  const special = fs.existsSync(specialPath) ? JSON.parse(fs.readFileSync(specialPath,"utf8")) : {approvals:[]};
  const legacy = new Map(baseline.routes.map(x => [x.file,x]));
  const admission = new Map(manifest.modules.map(x => [x.file,x]));
  const duplicateAdmissions = manifest.modules.length !== admission.size;
  const pages = listPages(root);
  const rows = pages.map(file => {
    const surface = file.startsWith("app/bo/") ? "BO" : "HO";
    const base = legacy.get(file);
    const a = admission.get(file);
    const route = routeFromPage(file);
    if (a && (a.route !== route || a.surface !== surface)) throw Error("Admission identity mismatch " + file);
    let category;
    if (a?.profile === "TDD_DEFAULT") category = "TDD_ADMITTED_FOUNDATION";
    else if (a?.profile === "FOUNDER_APPROVED_SPECIAL") category = "FOUNDER_APPROVED_SPECIAL";
    else if (base) category = "GRANDFATHERED_MIGRATION_PENDING";
    else if (route === "/bo" || route === "/ho") category = "ROOT_OR_OUT_OF_SCOPE";
    else category = "UNADMITTED_NEW_ROUTE";
    return {
      surface, route, file, category,
      owner: a?.owner ?? base?.owner ?? null,
      eligibility: base?.tddEligibility ?? "UNVERIFIED",
      g4: "NOT_ATTESTED_BY_STATIC_INVENTORY",
      // No assignment of a serving SHA here: report is source-level only.
      servingSha: null,
      exception: a?.approval ?? null,
    };
  });
  const missing = manifest.modules.filter(x => !pages.includes(x.file)).map(x => x.file);
  const extra = [...admission].filter(([f,e])=>e.profile==="FOUNDER_APPROVED_SPECIAL" && !(special.approvals??[]).some(x=>x.id===e.approval && x.status==="approved")).map(([f])=>f);
  const errors = [
    ...(duplicateAdmissions ? ["duplicate admission files"] : []),
    ...missing.map(f => "missing admitted route: " + f),
    ...extra.map(f => "special route missing exact approved exception: " + f),
    ...rows.filter(x => x.category === "UNADMITTED_NEW_ROUTE").map(x => "new BO/HO page requires TDD admission: " + x.file),
  ];
  const bySurface = Object.fromEntries(["BO","HO"].map(s=>[s,count(rows.filter(x=>x.surface===s))]));
  return {
    evidence: "SOURCE_ONLY_NOT_AUTHENTICATED_STAGING",
    sourceBaseline: baseline.sourceSha, totals: count(rows),
    bySurface, rows, errors,
    migrationOwners: ["PAP-1086","PAP-1087"],
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = reportTddCoverage();
  const format = process.argv.includes("--json") ? result : { evidence: result.evidence, sourceBaseline: result.sourceBaseline, totals: result.totals, bySurface: result.bySurface, errors: result.errors };
  console.log(JSON.stringify(format, null, 2));
  if (result.errors.length) process.exitCode=1;
}
