/** PAP-2343 / PLT-M1-DELIVERY: verify collected evidence, not its authenticity or Founder acceptance. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { resolve, join, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

export const widths = [320, 390, 768, 1024, 1440];
const stages = ["table", "drawer", "detail"];
const audit = ["Created Time", "Created By", "Last Modified Time", "Last Modified By"];
const sha = /^[a-f0-9]{40}$/;
const digest = /^[a-f0-9]{64}$/;
const sourcePath = /^(?:app|lib|packages)\/[A-Za-z0-9_./()-]+\.(?:tsx?|jsx?|css)$/;
const pngHeader = Buffer.from([137,80,78,71,13,10,26,10]);
const checks = ["navigation", "deepLink", "reload", "back", "createViewRenderer", "overviewHistory", "keyboardFocus", "mockIsolation", "noWrites"];
const safePath = path => typeof path === "string" && sourcePath.test(path) && !path.split("/").some(s => s === "." || s === ".." || s === "");

export function verifyManifest(manifest, readSource) {
  const errors = [];
  const fail = (ok, message) => { if (!ok) errors.push(message); };
  const m = manifest ?? {};
  fail(m.schemaVersion === 1, "Unsupported evidence schema");
  fail(/^PAP-[1-9][0-9]*$/.test(m.jiraTask ?? ""), "Missing Jira task");
  fail(typeof m.epicCode === "string" && /^[A-Z][A-Z0-9-]+$/.test(m.epicCode), "Missing epic code");
  fail(["bo","ho"].includes(m.surface), "Unsupported surface");
  let url;
  try { url = new URL(m.reviewUrl); } catch { /* reported below */ }
  fail(url?.origin === "http://192.168.1.6:8800" &&
    !url.username && !url.password &&
    (url.pathname === "/" + m.surface || url.pathname.startsWith("/" + m.surface + "/")),
  "Review URL must be canonical i5 surface");
  fail(sha.test(m.sourceRevision ?? "") && m.servedRevision === m.sourceRevision, "Source/served revision mismatch");
  const fixture = m.fixtureIds;
  fail(Array.isArray(fixture) && fixture.length === 1 && /^[A-Z][A-Z0-9-]*-MOCK-001$/.test(fixture[0]), "Expected exactly one initial synthetic ID");
  fail(JSON.stringify(m.auditColumns) === JSON.stringify(audit), "Missing canonical audit columns");
  fail(m.auditValues === "unavailable", "Synthetic audit must be unavailable");
  const files = m.sourceFiles ?? {};
  const roles = ["route", "renderer", "schema", "fixture"];
  for (const role of roles) {
    const file = files[role];
    if (!safePath(file?.path) || !digest.test(file?.sha256 ?? "")) { errors.push("Missing source identity: " + role); continue; }
    if (!sha.test(m.sourceRevision ?? "")) continue;
    try {
      const actual = createHash("sha256").update(readSource(m.sourceRevision, file.path)).digest("hex");
      fail(actual === file.sha256, "Source hash mismatch: " + role);
    } catch { errors.push("Cannot read committed source: " + role); }
  }
  fail(m.createRenderer === files.renderer?.path && m.viewRenderer === files.renderer?.path &&
    safePath(m.createRenderer), "Create/View renderer identity mismatch");
  for (const key of checks) {
    const evidence = m.checks?.[key];
    fail(evidence?.status === "PASS" && typeof evidence.observation === "string" && evidence.observation.trim().length > 0,
      "Missing observed check: " + key);
  }
  fail(Array.isArray(m.css) && m.css.length > 0 && m.css.every(c => {
    try { const u = new URL(c.url, url); return u.origin === url.origin && c.status === 200 && /^text\/css(?:;|$)/i.test(c.mime ?? ""); }
    catch { return false; }
  }), "CSS response evidence missing or invalid");
  fail(m.unexpectedErrors === 0 && m.realWriteRequests === 0, "Unexpected errors or real writes");
  return errors;
}

export function verifyGeometry(width, metrics, readScreenshot, fixtureId) {
  const errors = [];
  if (metrics?.width !== width) errors.push("Wrong width: " + width);
  for (const stage of stages) {
    const m = metrics?.stages?.[stage];
    if (!m || m.width !== width || !Number.isFinite(m.shellWidth) || m.shellWidth <= 100 ||
        !Number.isFinite(m.documentOverflow) || m.documentOverflow < 0 || m.documentOverflow > 1 ||
        m.recordId !== fixtureId) errors.push("Invalid geometry/identity: " + width + "/" + stage);
    try {
      const png = readScreenshot(stage);
      if (png.length < 1024 || !png.subarray(0,8).equals(pngHeader)) throw new Error("Invalid PNG");
    } catch { errors.push("Missing/invalid screenshot: " + width + "/" + stage); }
  }
  return errors;
}

export function verifyEvidence(repo, evidenceDir) {
  const root = realpathSync(evidenceDir);
  const read = (...parts) => {
    const path = realpathSync(join(root, ...parts));
    const rel = relative(root, path);
    if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("Evidence path escapes root");
    return readFileSync(path);
  };
  const m = JSON.parse(read("manifest.json").toString("utf8"));
  const head = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], {encoding:"utf8"}).trim();
  const errors = verifyManifest(m, (revision, path) => execFileSync("git", ["-C", repo, "show", revision + ":" + path]));
  if (head !== m.sourceRevision) errors.push("Checked-out HEAD differs from source revision");
  if (execFileSync("git", ["-C", repo, "status", "--porcelain"], {encoding:"utf8"}).trim()) errors.push("Source worktree is dirty");
  for (const width of widths) {
    try {
      const metrics = JSON.parse(read(String(width), "geometry.json").toString("utf8"));
      errors.push(...verifyGeometry(width, metrics, stage => read(String(width), stage + ".png"), m.fixtureIds?.[0]));
    } catch { errors.push("Missing/malformed geometry: " + width); }
  }
  return { evidenceComplete: errors.length === 0, errors, founderGate: "PENDING_MANUAL", authenticatedG4: "NOT_RUN" };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw new Error("Usage: node scripts/verify-m1-preflight.mjs <source-worktree> <evidence-dir>");
    const result = verifyEvidence(process.argv[2], process.argv[3]);
    console.log(JSON.stringify(result, null, 2));
    if (!result.evidenceComplete) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
