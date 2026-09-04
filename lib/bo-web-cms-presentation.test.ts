import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Website CMS is presented in the canonical BO Content navigation", async () => {
  const navigation = await readFile("app/bo/navigation.ts", "utf8");
  assert.match(navigation, /label:\s*["']Content["']/);
  assert.match(navigation, /href:\s*["']\/bo\/content["'],\s*label:\s*["']Website CMS["']/);
});

test("Website CMS page covers approved editorial workflow without a page builder or URL field", async () => {
  const source = `${await readFile("app/bo/content/WebsiteCmsView.tsx", "utf8")}\n${await readFile("lib/bo-web-cms-model.ts", "utf8")}`;
  for (const label of ["PINO House", "Toppi", "Afterwork", "Published", "Current draft", "Save Draft", "Publish", "HISTORY", "Canonical media asset ID", "Alt text · VI", "Alt text · EN"]) assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /boWebCmsApi\.rollback/);
  assert.doesNotMatch(source, /type=["']url["']|manifest.*sync|page builder/i);
});
