/** PAP-1091 — narrowly scoped application auto-merge admission.
 * This module is read from trusted main by pull_request_target, NEVER from PR code.
 * Policy changes and CI verifiers are NOT broadly auto-mergeable.
 */
const APPLICATION_FILES = new Set([
  "app/bo/architecture/bo-unified-workspace-source.ts",
  "lib/bo-sidebar-routes.ts",
  "lib/bo-url-contract.ts",
  "lib/bo-url-contract.test.ts",
  // Introduce additional narrow application files only via reviewed policy PR.
]);
const EXCEPTION_948 = Object.freeze({
  number: 948,
  headSha: "4d459bbde542be98fd4a29ad0deff9196de4eb4c",
  files: [
    "app/bo/architecture/bo-unified-workspace-source.ts",
    "lib/bo-sidebar-routes.ts",
    "lib/bo-url-contract.test.ts",
    "lib/bo-url-contract.ts",
    "scripts/verify-bo-runtime-surface-ownership.mjs",
    "scripts/verify-bo-runtime-surface-ownership.test.mjs",
  ].sort(),
});
const TEST_FILE = /(?:\.test\.ts|\.test\.tsx|\.test\.mjs)$/;
// V2: ordinary scoped BO/HO/TOS library logic can self-admit only with a
// changed, exact companion regression test and a fully inspectable safe patch.
// Do not interpret this filename check as a privilege/ACL attestation.
const LIBRARY_PATH = /^lib\/(bo|ho|tos)-[a-z0-9-]+(?:\.test)?\.(?:ts|tsx)$/;
const SENSITIVE_NAME = /(?:^|[-/.])(api|auth|authentication|authorization|acl|access|permission|permissions|security|secret|secrets|token|tokens|session|sessions|login|logout|role|roles|user|users|payment|payments|financial|finance|salary|payroll|migration|migrations|production|deploy|release|worker|wrangler|core|config|configuration|policy|policies|guard|guards|identity|audit)(?:[-/.]|$)/;
const SENSITIVE_DIFF = /\b(?:auth|authentication|authorization|acl|accesscontrol|permission|permissions|role|roles|secret|token|jwt|cookie|session|password|migration|migrations|wrangler|cloudflare|d1database|createclient|transaction|sql)\b|process\.env|\b(?:fetch|execute|prepare|insert|delete)\s*\(|(?:next\/headers|next\/server|server-only)|\/api\//i;
const safeFile = file =>
  file && typeof file.filename === "string" &&
  !file.previous_filename &&
  !["removed", "renamed"].includes(file.status);
export function safeBoundedLibraryPath(path) {
  return typeof path === "string" && LIBRARY_PATH.test(path) &&
    !path.includes("..") && !SENSITIVE_NAME.test(path.toLowerCase());
}
function exactCompanionTests(source) {
  return [source.replace(/\.tsx?$/, ".test.ts"), source.replace(/\.tsx?$/, ".test.tsx")];
}
export function inspectSafeLibraryPatch(file) {
  if (typeof file.patch !== "string" || !file.patch.length || file.patch.length > 25000)
    return {ok: false, reason: "missing or oversized inspectable application diff"};
  const lines = file.patch.split("\n").filter(line =>
    (line.startsWith("+") && !line.startsWith("+++")) ||
    (line.startsWith("-") && !line.startsWith("---")));
  if (lines.length > 400) return {ok: false, reason: "application diff too large"};
  if (lines.some(line => SENSITIVE_DIFF.test(line.slice(1))))
    return {ok: false, reason: "sensitive application diff requires protected merge"};
  return {ok: true};
}

/**
 * No wildcard directories. A sensitive verifier can enter exactly once, only
 * for the immutable Founder-approved PR#948 HEAD and exact six-file manifest.
 * CI and protected branch rules are still enforced by the caller and GitHub.
 */
export function assessApplicationFiles(files, context, safeUiPath) {
  if (!Array.isArray(files) || files.length === 0 || files.length > 40 ||
    !files.every(safeFile))
    return { ok: false, reason: "invalid, renamed or removed application file" };
  const names = files.map(f => f.filename);
  if (new Set(names).size !== names.length)
    return { ok: false, reason: "duplicated changed path" };
  if (context?.prNumber === EXCEPTION_948.number) {
    if (context.headSha !== EXCEPTION_948.headSha ||
      JSON.stringify(names.slice().sort()) !== JSON.stringify(EXCEPTION_948.files))
      return { ok: false, reason: "PAP-1089 pinned PR head or file set changed" };
    return { ok: true, lane: "pinned-pap1089" };
  }

  const eligible = f => APPLICATION_FILES.has(f) || safeBoundedLibraryPath(f) || safeUiPath(f);
  if (names.some(f => !eligible(f)))
    return { ok: false, reason: "requires manual merge: out-of-policy application path" };

  const boundedSources = files.filter(f => safeBoundedLibraryPath(f.filename) &&
    !TEST_FILE.test(f.filename) && !APPLICATION_FILES.has(f.filename));
  const legacySources = files.filter(f => APPLICATION_FILES.has(f.filename) && !TEST_FILE.test(f.filename));
  if (!boundedSources.length && !legacySources.length)
    return { ok: false, reason: "not an application change" };
  // Scope proof must not be satisfied by an unrelated or stale test on main.
  for (const source of boundedSources) {
    if (!exactCompanionTests(source.filename).some(testName => names.includes(testName)))
      return { ok: false, reason: "application auto-merge requires exact changed companion test: " + source.filename };
    const patch = inspectSafeLibraryPatch(source);
    if (!patch.ok) return patch;
  }
  // Preserve the existing PAP-1091 bounded, test-backed architecture lane.
  if (legacySources.length && !names.some(f => APPLICATION_FILES.has(f) && TEST_FILE.test(f)))
    return { ok: false, reason: "legacy application auto-merge requires an owned regression test" };
  return { ok: true, lane: boundedSources.length ? "verified-library" : "scoped-application" };
}
