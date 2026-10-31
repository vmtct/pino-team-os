/**
 * PAP-1077: filesystem route denominator only. This is not Staging/ACL attestation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSpecial } from "./verify-tdd-authority.mjs";

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
const classifications = ["TDD_COMPLIANT", "TDD_PARTIAL", "GRANDFATHERED", "FOUNDER_EXEMPT", "OUT_OF_SCOPE", "UNVERIFIED"];
function coverage(rows) {
  const counts = Object.fromEntries(classifications.map(key => [key, 0]));
  const eligibility = { ELIGIBLE: 0, NOT_ELIGIBLE: 0, UNVERIFIED: 0 };
  for (const row of rows) {
    counts[row.classification]++;
    eligibility[row.eligibility]++;
  }
  return { classifications: counts, eligibility };
}
export function reportTddCoverage(root = ROOT, { now = Date.now() } = {}) {
  const baseline = JSON.parse(fs.readFileSync(path.join(root,"config/tdd-inventory.json"),"utf8"));
  const manifest = JSON.parse(fs.readFileSync(path.join(root,"config/tdd-admission.json"),"utf8"));
  const specialPath = path.join(root,"config/tdd-approved-special.json");
  const special = fs.existsSync(specialPath) ? JSON.parse(fs.readFileSync(specialPath,"utf8")) : {approvals:[]};
  const legacy = new Map(baseline.routes.map(x => [x.file,x]));
  const admission = new Map(manifest.modules.map(x => [x.file,x]));
  const duplicateAdmissions = manifest.modules.length !== admission.size;
  const pages = listPages(root);
  const exceptionErrors = [];
  const rows = pages.map(file => {
    const surface = file.startsWith("app/bo/") ? "BO" : "HO";
    const base = legacy.get(file);
    const a = admission.get(file);
    const route = routeFromPage(file);
    if (a && (a.route !== route || a.surface !== surface)) throw Error("Admission identity mismatch " + file);
    const isSpecial = a?.profile === "FOUNDER_APPROVED_SPECIAL";
    const approval = isSpecial ? (special.approvals ?? []).find(x => x.id === a.approval) : null;
    const invalid = isSpecial ? validateSpecial(a, special.approvals ?? [], [], now) : [];
    exceptionErrors.push(...invalid.map(error => "special route missing exact approved exception: " + file + ": " + error));
    let category;
    if (a?.profile === "TDD_DEFAULT") category = "TDD_ADMITTED_FOUNDATION";
    else if (isSpecial) category = invalid.length ? "INVALID_SPECIAL_APPROVAL" : "FOUNDER_APPROVED_SPECIAL";
    else if (route === "/bo" || route === "/ho") category = "ROOT_OR_OUT_OF_SCOPE";
    else if (base && !a) category = "GRANDFATHERED_MIGRATION_PENDING";
    else category = "UNADMITTED_NEW_ROUTE";
    // Admission is partial evidence, never proof that G0-G4 and live visual acceptance passed.
    const classification = ({ TDD_ADMITTED_FOUNDATION: "TDD_PARTIAL", FOUNDER_APPROVED_SPECIAL: "FOUNDER_EXEMPT", ROOT_OR_OUT_OF_SCOPE: "OUT_OF_SCOPE", GRANDFATHERED_MIGRATION_PENDING: "GRANDFATHERED" })[category] ?? "UNVERIFIED";
    return {
      surface, route, file, category, classification,
      owner: (!invalid.length && approval?.owner) || a?.owner || base?.owner || null,
      eligibility: classification === "TDD_PARTIAL" ? "ELIGIBLE" : ["OUT_OF_SCOPE", "FOUNDER_EXEMPT"].includes(classification) ? "NOT_ELIGIBLE" : "UNVERIFIED",
      baselineEligibility: base?.tddEligibility ?? "UNVERIFIED",
      g4: "NOT_ATTESTED_BY_STATIC_INVENTORY",
      // No assignment of a serving SHA here: report is source-level only.
      servingSha: null,
      exception: a?.approval ?? null,
      exceptionDetails: isSpecial ? {
        id: a.approval, valid: invalid.length === 0,
        owner: approval?.owner ?? null, route: approval?.route ?? null,
        surface: approval?.surface ?? null, reference: approval?.reference ?? null,
        approvedAt: approval?.approvedAt ?? null, expiresAt: approval?.expiresAt ?? null,
      } : null,
    };
  });
  const missing = manifest.modules.filter(x => !pages.includes(x.file)).map(x => x.file);
  const errors = [
    ...(duplicateAdmissions ? ["duplicate admission files"] : []),
    ...missing.map(f => "missing admitted route: " + f),
    ...exceptionErrors,
    ...rows.filter(x => x.category === "UNADMITTED_NEW_ROUTE").map(x => "new BO/HO page requires TDD admission: " + x.file),
  ];
  const bySurface = Object.fromEntries(["BO","HO"].map(s=>[s,count(rows.filter(x=>x.surface===s))]));
  return {
    evidence: "SOURCE_ONLY_NOT_AUTHENTICATED_STAGING",
    sourceBaseline: baseline.sourceSha, totals: count(rows),
    bySurface, rows, errors,
    coverage: {
      denominator: "BO/HO filesystem page entrypoints only; root hosts are not separate data modules. Query-hosted BO modules and live reachability require the PAP-1068 inventory.",
      basis: "Source declarations only, not verified live compliance. TDD_PARTIAL means admitted with acceptance not attested here; zero TDD_COMPLIANT does not assert live module failure. Special records pass the shared structural validator; G0 separately requires already-merged Founder authority.",
      ...coverage(rows),
      bySurface: Object.fromEntries(["BO", "HO"].map(surface => [surface, coverage(rows.filter(row => row.surface === surface))])),
    },
    migrationOwners: ["PAP-1086","PAP-1087"],
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = reportTddCoverage();
  const format = process.argv.includes("--json") ? result : { evidence: result.evidence, sourceBaseline: result.sourceBaseline, totals: result.totals, bySurface: result.bySurface, coverage: result.coverage, errors: result.errors };
  console.log(JSON.stringify(format, null, 2));
  if (result.errors.length) process.exitCode=1;
}
