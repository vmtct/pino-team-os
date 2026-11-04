// PAP-1447 / Epic PAP-1097 — BO homepage route-only Pinoria Self navigation.
import assert from "node:assert/strict";
import test from "node:test";
import { unifiedBoWorkspaceSource } from "../app/bo/architecture/bo-unified-workspace-source";
import { boNavigation } from "../app/bo/navigation";
import { BO_LEGACY_QUERY_MODULES } from "./bo-url-contract";

test("BO homepage registers canonical Pinoria Self link, not a legacy query module", () => {
  const entry = unifiedBoWorkspaceSource.modules["pinoria-avatars"];
  assert.ok(entry, "homepage sidebar must expose Self Directory");
  assert.equal(entry.label, "Self Directory");
  assert.equal(entry.group, "PINORIA");
  assert.equal(unifiedBoWorkspaceSource.routeForModule?.("pinoria-avatars"), "/bo/pinoria-avatars");
  assert.ok(!BO_LEGACY_QUERY_MODULES.some(module => module === "pinoria-avatars"));
  assert.equal(
    boNavigation.find(group => group.label === "Pinoria")?.items.find(item => item.label === "Self Directory")?.href,
    "/bo/pinoria-avatars",
    "legacy shell and staging shell must agree on href",
  );
});

test("Self Directory cannot fall through the generic school data loader", async () => {
  await assert.rejects(
    () => unifiedBoWorkspaceSource.load("pinoria-avatars", fetch, {}),
    /authenticated TDD provider/,
  );
});
