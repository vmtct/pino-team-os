import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");
test("PAP-1992 Team host metadata and client navigation preserve fixed surface titles", () => {
  const root = source("app/layout.tsx");
  assert.match(root, /HO_STAGING_HOSTNAME \? "HO - PINO"/);
  assert.match(root, /\[BO_HOSTNAME, BO_STAGING_HOSTNAME\].*\? "BO - PINO"/);
  assert.match(root, /\[TOS_HOSTNAME, TOS_STAGING_HOSTNAME\].*\? "TOS - PINO"/);
  assert.match(source("app/ho/layout.tsx"), /title: "HO - PINO"/);
  const workspace = source("app/bo/components/registration/BoRegistrationWorkspace.tsx");
  assert.equal(workspace.match(/document\.title = ho \? "HO - PINO" : "BO - PINO"/g)?.length, 2);
  assert.match(source("app/bo/parents/ParentDirectoryDsa.tsx"), /document.title="BO - PINO"/);
  assert.match(source("app/bo/pinoria-avatars/AvatarDirectoryDsa.tsx"), /document.title = "BO - PINO"/);
});
test("PAP-1992 legacy Piner shell has one fixed browser title", () => {
  assert.match(source("piner-shell/src/view.mjs"), /const title="Piner App - PINO";/);
});
