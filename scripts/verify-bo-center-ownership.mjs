/**
 * PAP-1459 / Epic PAP-1316 — guard the single BO workspace Center owner.
 * Only BO shell can mount the provider or discover authorized workspace Centers.
 * Business-tab Center fields are allowed; Core remains the authorization authority.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SHELL = "app/bo/components/registration/BoRuntimeBoundary.tsx";
const CENTER_OWNER = "app/bo/components/registration/BoCenterSelection.tsx";
const SELF = "app/bo/pinoria-avatars/SelfDirectoryTdd.tsx";
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
    // Inspect only TDD entrypoints, not domain business fields in detail tabs.
    if (/\bcreateBoTddAdapter\s*\(/.test(source) &&
        (/<select\b[^>]*(?:id|name|aria-label)=["'][^"']*(?:center|cơ sở)/i.test(source) ||
         /className=["'][^"']*\btdd-[a-z0-9-]*-center\b/i.test(source)))
      errors.push(name + ": TDD entrypoint embeds a workspace Center picker");
  }
  if (mounts !== 1) errors.push("Expected exactly one BO Center provider mount, found " + mounts);
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
  } else console.log("BO_CENTER_OWNER_PASS: single shell owner, Pinoria Self consumes Active Center");
}
