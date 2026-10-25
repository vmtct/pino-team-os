import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import type { AdoptionStory, OwnershipModule } from "./ownership-registry";

interface NavItem { href?: string; label: string; children?: readonly NavItem[] }
interface NavGroup { label: string; items: readonly NavItem[] }
const sorted = (values: Iterable<string>) => [...values].sort();
export function navigationInventory(groups: readonly NavGroup[]) {
  const rows: { href: string; location: string }[] = [];
  function visit(items: readonly NavItem[], parent: string) {
    for (const item of items) {
      const location = `${parent} / ${item.label}`;
      if (item.href) rows.push({ href: item.href, location });
      if (item.children) visit(item.children, location);
    }
  }
  for (const group of groups) visit(group.items, group.label);
  return rows;
}
export function boPageFiles(root: string): string[] {
  function walk(directory: string): string[] {
    return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory() ? walk(path) : /^page\.(tsx?|jsx?)$/.test(entry.name) ? [path] : [];
    });
  }
  return walk("app/bo").sort();
}

/** Fail closed on malformed design metadata. This is NOT an authorization engine. */
export function validateOwnership(modules: readonly OwnershipModule[], stories: readonly AdoptionStory[], navHrefs: readonly string[], pages: readonly string[]): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  const hrefOwners = new Map<string, string>();
  const pageOwners = new Map<string, string>();
  const masterOwners = new Map<string, string>();
  const storyKeys = new Set<string>();
  for (const story of stories) {
    if (!/^PAP-\d+$/.test(story.key) || storyKeys.has(story.key)) errors.push(`Invalid/duplicate story ${story.key}`);
    if (!["PILOT_ONLY", "FOUNDER_APPROVAL_GATED", "EXCLUDED_FROM_UI_ADOPTION"].includes(story.admission)) errors.push(`Invalid admission ${story.key}`);
    storyKeys.add(story.key);
  }
  for (const row of modules) {
    const fail = (message: string) => errors.push(`${row.moduleKey}: ${message}`);
    if (!/^[a-z][a-z0-9-]*$/.test(row.moduleKey) || keys.has(row.moduleKey)) fail("invalid/duplicate moduleKey");
    keys.add(row.moduleKey);
    if (!["HO_GLOBAL_MASTER", "BO_CENTER_OPERATION", "SHARED_ENTITY_SPLIT", "SHARED_READ"].includes(row.ownership)) fail("invalid ownership");
    if (row.dataOwner?.repository !== "pino-core" || !row.dataOwner.domain.trim()) fail("invalid canonical owner");
    if (!row.oldBoHrefs.length || !row.sourcePages.length) fail("missing legacy source disposition");
    if (!["MOVE_AUTHOR_TO_HO", "RETAIN_CENTER_ROUTE", "SPLIT_BEFORE_CUTOVER", "RETAIN_SCOPED_READ", "RETIRE_PROTOTYPE"].includes(row.legacyDisposition)) fail("invalid legacy disposition");
    if (!row.specializedSlot?.purpose.trim() || !["DETAIL", "EDITOR", "TIMELINE", "MATRIX", "DASHBOARD"].includes(row.specializedSlot.kind)) fail("missing specialized slot");
    if (!row.boConsumption.trim() || row.contractStatus !== "OWNER_API_PERMISSION_TABLE_RECONCILE_REQUIRED") fail("missing contract/consumption boundary");
    for (const href of row.oldBoHrefs) {
      if (!/^\/bo(?:\/[a-z0-9-]+)*$/.test(href)) fail(`invalid old href ${href}`);
      if (hrefOwners.has(href)) fail(`duplicate href owner ${href}`);
      hrefOwners.set(href, row.moduleKey);
      if (!row.sourcePages.includes(`app${href}/page.tsx`)) fail(`nav stub has no explicit source disposition ${href}`);
    }
    for (const page of row.sourcePages) {
      if (!/^app\/bo\/(?:[a-zA-Z0-9[\]-]+\/)*page\.tsx$/.test(page)) fail(`invalid source page ${page}`);
      if (pageOwners.has(page)) fail(`duplicate page owner ${page}`);
      pageOwners.set(page, row.moduleKey);
    }
    for (const story of row.adoptionStories) if (!storyKeys.has(story)) fail(`unknown adoption story ${story}`);
    if (!row.targets.length) fail("missing target route");
    const targets = new Set<string>();
    for (const target of row.targets) {
      if (!["HO", "BO"].includes(target.surface) || !["GLOBAL", "CENTER"].includes(target.scope)) fail("invalid surface/scope");
      const prefix = target.surface === "HO" ? "/ho" : "/bo";
      if (!/^\/(ho|bo)(?:\/[a-z0-9-]+)*$/.test(target.route) || !(target.route === prefix || target.route.startsWith(`${prefix}/`))) fail(`malformed target route ${target.route}`);
      if (targets.has(target.route)) fail(`duplicate target ${target.route}`);
      targets.add(target.route);
      if (target.availability !== "PLANNED_CONTRACT_REQUIRED") fail("target cannot claim runtime readiness");
      if (target.routeDisposition !== (target.surface === "HO" ? "MISSING_PLANNED_HO_ROUTE" : "EXISTING_BO_PATH_SCOPE_NOT_PROVEN")) fail("invalid missing/existing target disposition");
      if (target.surface === "BO" && !pages.includes(`app${target.route}/page.tsx`)) fail(`target BO path has no source page ${target.route}`);
      if (!target.actions.length || new Set(target.actions).size !== target.actions.length || target.actions.some(action => !["create", "update", "assign", "operate", "read"].includes(action))) fail("invalid actions");
      if (!target.resources.length || target.resources.some(resource => !/^[a-z][a-z0-9-]*$/.test(resource))) fail("invalid resource declaration");
      if (target.surface === "BO" && target.scope !== "CENTER") fail("BO cannot have GLOBAL authority");
      if (target.surface === "HO" && target.scope !== "GLOBAL") fail("HO must declare GLOBAL scope");
      if (row.ownership === "SHARED_READ" && target.actions.some(action => action !== "read")) fail("SHARED_READ cannot write");
      if (row.ownership === "HO_GLOBAL_MASTER" && target.actions.some(action => action !== "read") && target.surface !== "HO") fail("global author write in BO");
      if (row.ownership === "BO_CENTER_OPERATION" && target.actions.some(action => action !== "read") && target.surface !== "BO") fail("center operation write in HO");
      if (target.surface === "HO" && target.actions.some(action => action !== "read")) {
        for (const resource of target.resources) {
          if (masterOwners.has(resource)) fail(`duplicate global author for ${resource}`);
          masterOwners.set(resource, row.moduleKey);
        }
      }
    }
    if (row.ownership === "SHARED_ENTITY_SPLIT" && (!row.targets.some(t => t.surface === "HO") || !row.targets.some(t => t.surface === "BO"))) fail("split needs both surfaces");
    if (row.ownership === "SHARED_ENTITY_SPLIT" && row.legacyDisposition !== "SPLIT_BEFORE_CUTOVER") fail("split missing cutover disposition");
    if (row.ownership === "HO_GLOBAL_MASTER" && !row.targets.some(t => t.surface === "HO" && t.actions.some(action => action !== "read"))) fail("global master needs HO author");
  }
  // A global master may be READ in BO, but can never be authored through a local relation.
  for (const row of modules) for (const target of row.targets) {
    if (target.surface === "BO" && target.actions.some(action => action !== "read")) {
      for (const resource of target.resources) if (masterOwners.has(resource)) errors.push(`${row.moduleKey}: global author write in BO for ${resource}`);
    }
  }
  for (const href of new Set(navHrefs)) if (!hrefOwners.has(href)) errors.push(`Omitted nav ${href}`);
  for (const page of pages) if (!pageOwners.has(page)) errors.push(`Omitted page ${page}`);
  for (const page of pageOwners.keys()) if (!pages.includes(page)) errors.push(`Missing/legacy source route ${page}`);
  for (const story of storyKeys) if (!modules.some(row => row.adoptionStories.includes(story as AdoptionStory["key"]))) errors.push(`Orphan adoption story ${story}`);
  return errors.sort();
}

/** Reproducible lexical evidence: page + immediate BO implementation imports only.
 * Dynamic dispatch, imported clients, ACL, Core tables and deployed availability remain unverified.
 */
export function collectSourceInventory(root: string, modules: readonly OwnershipModule[], groups: readonly NavGroup[]) {
  const navigation = navigationInventory(groups);
  const pages = boPageFiles(root).map(file => {
    const owner = modules.find(row => row.sourcePages.includes(file));
    const route = `/${file.slice(4).replace(/\/page\.tsx$/, "")}`;
    const pageSource = readFileSync(join(root, file), "utf8");
    const implementationFiles = new Set([file]);
    for (const match of pageSource.matchAll(/from\s+["']([^"']+)["']/g)) {
      const specifier = match[1];
      const base = specifier.startsWith(".") ? join(dirname(file), specifier) : specifier.startsWith("@/") ? specifier.slice(2) : null;
      if (!base) continue;
      const candidate = [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx")].find(path => existsSync(join(root, path)) && /\.[jt]sx?$/.test(path));
      if (candidate) implementationFiles.add(posix.normalize(relative(root, join(root, candidate)).replaceAll("\\", "/")));
    }
    const apiLiterals = new Set<string>();
    const clientImports = new Set<string>();
    for (const path of implementationFiles) {
      const source = readFileSync(join(root, path), "utf8");
      for (const match of source.matchAll(/["'`]((?:\/api\/)[^"'`\r\n]*)["'`]/g)) apiLiterals.add(match[1]);
      for (const match of source.matchAll(/from\s+["'](@\/lib\/[^"']+)["']/g)) clientImports.add(match[1]);
    }
    return { route, file, moduleKey: owner?.moduleKey ?? null,
      navigationLocations: navigation.filter(row => row.href === route).map(row => row.location),
      sourceKind: route.endsWith("/prototype") ? "PROTOTYPE_PAGE" : "FILE_ROUTE",
      implementationFiles: sorted(implementationFiles), observedApiLiterals: sorted(apiLiterals), importedClients: sorted(clientImports) };
  });
  return { evidenceClass: "SOURCE_ONLY_NOT_SERVING_TRUTH", evidenceLimit: "Page and immediate implementation imports, lexical API hints only; not a transitive API/permission audit. Empty hints do not mean no API. Core table mapping and effective permissions UNVERIFIED; owner reconciliation required before runtime.", navigation, pages };
}
