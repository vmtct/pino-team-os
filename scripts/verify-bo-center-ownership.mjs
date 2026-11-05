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
/** PAP-1460 / PAP-1329: bounded grandfathered UI debt, not acceptance.
 * One exact existing workspace selector per file may remain until its own
 * Core-scoped domain rollout. Additional or renamed selectors fail CI. */
const LEGACY_PICKERS = new Map([
  ["app/bo/missions/BoMissionsTdd.tsx", "bo-mission-center"],
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
    console.warn("BO_CENTER_LEGACY_DEBT: two exact selectors tracked in PAP-1460/PAP-1329 (not STAGING_ACCEPTED)");
  }
}
