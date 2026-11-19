import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { checkTdd } from "./tdd.mjs";

// Local M1 only. No profile or credential is borrowed from a live role session.
export async function runPreview(surface, feature, contract) {
  const path = process.env.PINO_QA_PREVIEW_FIXTURES;
  if (!path || !contract.tdd) return "NOT_RUN";
  const fixtures = JSON.parse(await readFile(path, "utf8"));
  const fixture = fixtures[surface + "/" + feature];
  if (!fixture || !["url", "row", "drawer", "detail"].every(k => typeof fixture[k] === "string" && fixture[k].trim())) return "NOT_RUN";
  const url = new URL(fixture.url);
  if (url.protocol !== "http:" || !["127.0.0.1", "192.168.1.6"].includes(url.hostname) ||
      !url.port || ["8800","8799","3562","3593"].includes(url.port) || url.username || url.password) {
    throw Error("Expected an isolated native M1 preview URL");
  }
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({serviceWorkers: "block"});
    await context.route("**/*", route => {
      const request = route.request();
      const allowed = new URL(request.url()).origin === url.origin && ["GET","HEAD"].includes(request.method());
      return allowed ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    await page.goto(url.href);
    await checkTdd(page, fixture);
    return "PASS";
  } catch (error) {
    console.error(error.message);
    return "FAIL";
  } finally {
    await browser.close();
  }
}
