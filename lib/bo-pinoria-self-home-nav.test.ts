// PAP-1447 / Epic PAP-1097 — canonical route-only Self Directory link on BO homepage.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { boNavigation } from "../app/bo/navigation";
import { BO_LEGACY_QUERY_MODULES } from "./bo-url-contract";

const shell = readFileSync(new URL("../app/bo/components/registration/BoRegistrationWorkspace.tsx", import.meta.url), "utf8");
const self = readFileSync(new URL("../app/bo/pinoria-avatars/SelfDirectoryTdd.tsx", import.meta.url), "utf8");

test("Pinoria Self stays a dedicated BO TDD route, never a legacy query module", () => {
  const entry = boNavigation.find(group => group.label === "Pinoria")?.items.find(item => item.label === "Self Directory");
  assert.equal(entry?.href, "/bo/pinoria-avatars");
  assert.ok(!BO_LEGACY_QUERY_MODULES.some(module => module === "pinoria-avatars"));
});

test("BO staging shared shell exposes canonical route-only nav without generic data loading", () => {
  assert.match(shell, /boNavigation\.find\(group => group\.label === "Pinoria"\)/);
  assert.match(shell, /!ho && !Object\.hasOwn\(source\.modules, "pinoria-avatars"\)/);
  assert.match(shell, /navModules\)/);
  assert.match(shell, /selfNav && key === "pinoria-avatars" \? selfNav\.href/);
  assert.match(self, /source=\{selfDirectoryNavSource\}/);
  assert.match(self, /"pinoria-avatars": \{ label: "Self Directory", group: "PINORIA"/);
});
