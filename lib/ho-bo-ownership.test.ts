import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boNavigation } from "../app/bo/navigation";
import { adoptionStories, ownershipRegistry, type OwnershipModule } from "./ho-bo/ownership-registry";
import { boPageFiles, collectSourceInventory, navigationInventory, validateOwnership } from "./ho-bo/validate-ownership";

const root = process.cwd();
const pages = boPageFiles(root);
const navigation = navigationInventory(boNavigation);
const check = (rows: readonly OwnershipModule[] = ownershipRegistry, nav = navigation.map(row => row.href), files = pages) => validateOwnership(rows, adoptionStories, nav, files);
const copy = () => structuredClone(ownershipRegistry) as OwnershipModule[];

test("PAP-991: all current BO nav occurrences and nested source pages have exactly one owner", () => {
  assert.equal(navigation.length, 47);
  assert.equal(new Set(navigation.map(row => row.href)).size, 41);
  assert.equal(pages.length, 47);
  assert.deepEqual(check(), []);
  const saved = JSON.parse(readFileSync("lib/ho-bo/source-inventory.json", "utf8"));
  assert.deepEqual(collectSourceInventory(root, ownershipRegistry, boNavigation), saved);
  assert.equal(saved.pages.filter((page: { navigationLocations: string[] }) => !page.navigationLocations.length).length, 6);
});
test("PAP-991: 31 adoption stories include two pilots and preserve four excluded ownership rows", () => {
  assert.equal(adoptionStories.length, 35);
  assert.equal(adoptionStories.filter(row => row.admission === "FOUNDER_APPROVAL_GATED").length, 29);
  assert.deepEqual(adoptionStories.filter(row => row.admission === "PILOT_ONLY").map(row => row.key).sort(), ["PAP-891", "PAP-893"]);
  assert.deepEqual(adoptionStories.filter(row => row.admission === "EXCLUDED_FROM_UI_ADOPTION").map(row => row.key).sort(), ["PAP-890", "PAP-894", "PAP-896", "PAP-898"]);
});
test("PAP-991: duplicate keys, global author owners and orphan stories fail", () => {
  const rows = copy();
  rows.push(rows.find(row => row.moduleKey === "missions")!);
  assert.ok(check(rows).some(error => error.includes("duplicate moduleKey")));
  assert.ok(check(rows).some(error => error.includes("duplicate global author")));
  assert.ok(check(rows.filter(row => row.moduleKey !== "missions")).some(error => error.includes("Orphan adoption story PAP-899")));
});
test("PAP-991: new/orphan nav, nested files and deleted source routes fail", () => {
  assert.ok(check(undefined, [...navigation.map(row => row.href), "/bo/unowned"]).includes("Omitted nav /bo/unowned"));
  assert.ok(check(undefined, undefined, [...pages, "app/bo/unowned/page.tsx"]).includes("Omitted page app/bo/unowned/page.tsx"));
  assert.ok(check(undefined, undefined, pages.filter(page => page !== "app/bo/staff/[staffId]/page.tsx")).some(error => error.includes("Missing/legacy source route")));
});
test("PAP-991: malformed scope, owner, target route and action fail", () => {
  for (const mutate of [
    (row: OwnershipModule) => { row.dataOwner = { repository: "local-db", domain: "" } as unknown as OwnershipModule["dataOwner"]; },
    (row: OwnershipModule) => { row.targets = [{ ...row.targets[0], scope: "HOUSE" as never }]; },
    (row: OwnershipModule) => { row.targets = [{ ...row.targets[0], route: "/ho/../bo" }]; },
    (row: OwnershipModule) => { row.targets = [{ ...row.targets[0], actions: ["delete" as never] }]; },
  ]) {
    const rows = copy(); mutate(rows[0]); assert.notDeepEqual(check(rows), []);
  }
});
test("PAP-991: BO GLOBAL scope and global author writes disguised as local actions fail", () => {
  const rows = copy();
  const local = rows.find(row => row.moduleKey === "leads")!;
  local.targets = [{ ...local.targets[0], scope: "GLOBAL" }];
  assert.ok(check(rows).some(error => error.includes("BO cannot have GLOBAL")));
  local.targets = [{ ...local.targets[0], scope: "CENTER", resources: ["mission-definition"] }];
  assert.ok(check(rows).some(error => error.includes("global author write in BO")));
  const master = rows.find(row => row.moduleKey === "missions")!;
  master.targets = [{ ...master.targets[0], surface: "BO", scope: "CENTER", route: "/bo/missions" }];
  assert.ok(check(rows).some(error => error.includes("global author write in BO")));
});
test("PAP-991: split surfaces, immutable read projections and planned-only readiness are enforced", () => {
  const rows = copy();
  const split = rows.find(row => row.moduleKey === "students")!;
  split.targets = split.targets.filter(target => target.surface === "BO");
  assert.ok(check(rows).some(error => error.includes("split needs both")));
  rows[0].targets = [{ ...rows[0].targets[0], actions: ["update"], availability: "LIVE" as never }];
  assert.ok(check(rows).some(error => error.includes("SHARED_READ cannot write")));
  assert.ok(check(rows).some(error => error.includes("cannot claim runtime readiness")));
});
