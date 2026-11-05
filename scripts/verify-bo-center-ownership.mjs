/**
 * PAP-1459 / Epic PAP-1316 — guard the single BO workspace Center owner.
 * Only BO shell can mount the provider or discover authorized workspace Centers.
 * Business-tab Center fields are allowed; Core remains the authorization authority.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SHELL = "app/bo/components/registration/BoRuntimeBoundary.tsx";
const CENTER_OWNER = "app/bo/components/registration/BoCenterSelection.tsx";
const SELF = "app/bo/pinoria-avatars/SelfDirectoryTdd.tsx";
/** PAP-1460 / PAP-650: TV TDD component is ARCHIVED SOURCE ONLY.
 * Historical Center chooser remains in nonroutable source for audit;
 * its page must return notFound, BO host must deny /bo/tvs.
 * Additional or renamed workspace selectors in active modules fail CI. */
const LEGACY_PICKERS = new Map([
  ["app/bo/tvs/TvsTdd.tsx", "bo-tv-center"],
]);

const norm = path => path.split(sep).join("/");

function collect(root, dir) {
  const out = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const location = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(root, location));
    else if (entry.isFile() && entry.name.endsWith(".tsx")) out.push(location);
  }
  return out;
}

export function boCenterOwnershipViolations(root = ROOT) {
  const errors = [];
  const paths = collect(root, "app/bo");
  let mounts = 0;
  for (const file of paths) {
    const name = norm(file);
    const source = readFileSync(join(root, file), "utf8");
    const usesProvider = /<BoCenterSelectionProvider(?:\s|>)/g;
    const count = [...source.matchAll(usesProvider)].length;
    mounts += count;
    if (count && name !== SHELL) errors.push(name + ": BO Center provider mounted outside authenticated shell");
    if (name !== SHELL && name !== CENTER_OWNER && /\bBoCenterSelectionProvider\b/.test(source))
      errors.push(name + ": duplicate BO Center provider ownership");
    if (name !== CENTER_OWNER && /\bloadAuthorizedDirectoryCenters\s*\(/.test(source))
      errors.push(name + ": module-local Center discovery is prohibited");
    if (name !== CENTER_OWNER && /\/api\/bo\/(?:centers|workforce\/planning\/bootstrap)/.test(source) && /createBoTddAdapter\s*\(/.test(source))
      errors.push(name + ": TDD entrypoint must not discover workspace Centers");
    // Business-field selectors in domain detail tabs are not workspace pickers.
    // Legacy modules are explicit, exact-ID migration debt rather than silent exceptions.
    if (/\bcreateBoTddAdapter\s*\(/.test(source)) {
      const pickers = [...source.matchAll(/<select\b[^>]*(?:id|name|aria-label)=["'][^"']*(?:center|cơ sở)[^>]*>/gi)];
      const shells = [...source.matchAll(/className=["'][^"']*\btdd-[a-z0-9-]*-center\b/gi)];
      const legacyId = LEGACY_PICKERS.get(name);
      if (legacyId) {
        if (pickers.length !== 1 || !source.includes('<select id="' + legacyId + '"') || shells.length)
          errors.push(name + ": existing PAP-1460 picker baseline changed; migrate under PAP-1329");
      } else if (pickers.length || shells.length) {
        errors.push(name + ": TDD entrypoint embeds a workspace Center picker");
      }
    }
  }
  if (mounts !== 1) errors.push("Expected exactly one BO Center provider mount, found " + mounts);
  // PAP-1460: migrated Diary is a shell Center consumer, not a local selector.
  const diary = "app/bo/classroom-diaries/BoClassroomDiariesTdd.tsx";
  if (paths.some(file => norm(file) === diary)) {
    const source = readFileSync(join(root, diary), "utf8");
    if (!/useBoCenterSelection\s*\(/.test(source) || !/key=\{selected\+/.test(source) ||
        !/ready\?\.centerId\s*!==\s*selected/.test(source) || /\bboApi\.centers\s*\(/.test(source))
      errors.push(diary + ": migrated Diary must consume shell Center, remount scoped TDD and fence stale adapter");
  }
  // PAP-1460: the Open Studio Pass entrypoint has migrated from the legacy
  // local picker. Keep this preventive check alongside the generic scan.
  const openStudioPasses = "app/bo/open-studio-passes/BoOpenStudioPassesTdd.tsx";
  if (paths.some(file => norm(file) === openStudioPasses)) {
    const source = readFileSync(join(root, openStudioPasses), "utf8");
    if (!/useBoCenterSelection\s*\(/.test(source) ||
        !/key=\{selected\+/.test(source) ||
        !/ready\?\.centerId\s*!==\s*centerId/.test(source) ||
        /\bboApi\.centers\s*\(/.test(source) ||
        /<select\b[^>]*id=["']bo-open-studio-center/.test(source))
      errors.push(openStudioPasses + ": migrated Pass entrypoint must use BO shell Center and remount scoped TDD");
  }

  // PAP-1460: BO Mission Assignment must consume the BO master Center.
  const missions = "app/bo/missions/BoMissionsTdd.tsx";
  if (paths.some(file => norm(file) === missions)) {
    const source = readFileSync(join(root, missions), "utf8");
    if (!/useBoCenterSelection\s*\(/.test(source) ||
        !/key=\{selected\+/.test(source) ||
        !/ready\?\.centerId\s*===\s*centerId/.test(source) ||
        !/key=\{centerId\}/.test(source) ||
        !/setWriteLease\s*\(\{centerId,state:"pending"\}\)/.test(source) ||
        !/leaseBlocked/.test(source) ||
        /\bboApi\.centers\s*\(/.test(source) ||
        /<select\b[^>]*id=["']bo-mission-center/.test(source))
      errors.push(missions + ": BO Mission TDD must use shell Center and fence stale records");
  }

  // Retired TV source is allowed ONLY when it cannot be reached as a BO page.
  const retiredTvPage = "app/bo/tvs/page.tsx";
  if (paths.some(file => norm(file) === retiredTvPage)) {
    const page = readFileSync(join(root, retiredTvPage), "utf8");
    if (!/notFound\s*\(\s*\)/.test(page) || /import\s*\{\s*TvsTdd\s*\}/.test(page))
      errors.push(retiredTvPage + ": archived TV source must not remount BO management");
    const policy = readFileSync(join(root, "app/bo/architecture/bo-staging-route-policy.ts"),"utf8");
    if (/["']\/bo\/tvs["']/.test(policy))
      errors.push(retiredTvPage + ": archived TV route must not be admitted in BO Staging policy");
  }

  const selfFile = join(root, SELF);
  if (paths.some(file => norm(file) === SELF)) {
    const self = readFileSync(selfFile, "utf8");
    if (!/useBoCenterSelection\s*\(/.test(self) || !/key=\{selected\}/.test(self) ||
        !/ready\?\.centerId\s*===\s*selected/.test(self) || /\bsetSelected\s*\(/.test(self))
      errors.push(SELF + ": scoped TDD must consume shell Center, key remount and fence stale adapter");
  } else errors.push(SELF + ": canonical Center-scoped Self entrypoint missing");
  // A BO scaffolder may consume an authorized Center; it must never emit a second selector.
  const generator = join(root, "scripts/create-tdd-module.mjs");
  try {
    if (statSync(generator).isFile()) {
      const source = readFileSync(generator, "utf8");
      if (/<BoCenterSelectionProvider|loadAuthorizedDirectoryCenters\s*\(/.test(source))
        errors.push("scripts/create-tdd-module.mjs: scaffolder must not emit Center provider or discovery");
    }
  } catch (e) { if (e?.code !== "ENOENT") throw e; }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = boCenterOwnershipViolations();
  if (errors.length) {
    for (const error of errors) console.error("BO_CENTER_OWNER_FAIL " + error);
    process.exitCode = 1;
  } else {
    console.log("BO_CENTER_OWNER_PASS: one shell owner; no new module-local Center selector");
    console.warn("BO_TV_ARCHIVED_SOURCE_ONLY: one historical selector retained outside live BO routes (PAP-1460/PAP-650)");
  }
}
