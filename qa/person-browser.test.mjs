import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { checkTdd } from "./tdd.mjs";

test("PAP-2198 shared TDD reads the selected native HO Person", async () => {
  const fixture = {row: "QA Person Two", drawer: "QA Person Two", detail: "QA Person Two"};
  const code = await build({
    stdin: {contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import {HoPersonDirectory} from "./app/ho/system/people/HoPersonDirectory";
      const rows = ["QA Person One", "QA Person Two"].map((name, index) => ({
        id: "fixture-" + index, name, roles: [], avatarState: "", identityState: "",
        student: null, staff: null, parent: null, guest: null, avatarId: null, nickname: null
      }));
      createRoot(document.querySelector("main")).render(<HoPersonDirectory rows={rows}/>);
    `, resolveDir:process.cwd(), loader:"tsx"},
    jsx:"automatic", bundle:true, write:false, outdir:"out", loader:{".css":"empty"},
    define:{"process.env":"{}", "process.env.NODE_ENV":'"production"'}
  });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route("**/*", route => route.fulfill({contentType:"text/html",body:"<main></main>"}));
    const open = async () => {
      await page.goto("http://fixture.invalid/ho/system/people");
      await page.addScriptTag({content:code.outputFiles.find(f => f.path.endsWith(".js")).text});
    };
    await open();
    await checkTdd(page, fixture);
    assert.equal(new URL(page.url()).searchParams.get("record"), "fixture-1");
    await open();
    await assert.rejects(checkTdd(page, {...fixture, drawer:"Wrong fixture"}), /visible/i);
  } finally {
    await browser.close();
  }
});
