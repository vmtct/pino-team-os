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
const safeFile = file =>
  file && typeof file.filename === "string" &&
  !file.previous_filename &&
  !["removed", "renamed"].includes(file.status);

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
  if (!names.some(f => APPLICATION_FILES.has(f)))
    return { ok: false, reason: "not an application change" };
  if (names.some(f => !APPLICATION_FILES.has(f) && !safeUiPath(f)))
    return { ok: false, reason: "requires manual merge: out-of-policy application path" };
  if (!names.some(f => APPLICATION_FILES.has(f) && TEST_FILE.test(f)))
    return { ok: false, reason: "application auto-merge requires an owned regression test" };
  return { ok: true, lane: "scoped-application" };
}
