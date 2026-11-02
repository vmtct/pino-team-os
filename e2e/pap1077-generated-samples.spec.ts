import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Generate into a temporary filesystem; never add routes, fixtures or admission
// to the actual application. Each bundle consumes the emitted schema/JSON.
async function sample(surface: "bo" | "ho") {
  const root = mkdtempSync(join(tmpdir(), "pap1077-browser-"));
  const temporary = relative(resolve(tmpdir()), resolve(root));
  if (!temporary || temporary.startsWith("..") || isAbsolute(temporary) || !basename(root).startsWith("pap1077-browser-")) throw Error("Unsafe temporary sample path");
  try {
    for (const dir of ["config", "app/bo", "app/ho", "lib"]) mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, "config/tdd-admission.json"), JSON.stringify({ version: 1, modules: [], approvals: [] }));
    writeFileSync(join(root, "app/bo/navigation.ts"), 'export const nav=[{items: [{ href: "/bo", label: "Hôm nay" }]}];');
    for (const authority of ["ho-routes.ts", "bo-url-contract.ts", "host-boundary.ts"]) writeFileSync(join(root, "lib", authority), readFileSync(join("lib", authority), "utf8"));
    // Native Node keeps the CLI's ESM/import.meta behavior outside Playwright's TS transform.
    const invocation = `import { scaffoldTddModule } from ${JSON.stringify(pathToFileURL(resolve("scripts/create-tdd-module.mjs")).href)};scaffoldTddModule(${JSON.stringify({ root, surface, key: "sample-records", label: "Synthetic sample", permission: "synthetic.sample.read" })});`;
    const generated = spawnSync(process.execPath, ["--input-type=module", "-e", invocation], { encoding: "utf8", env: { ...process.env, NODE_TEST_CONTEXT: undefined } });
    if (generated.status !== 0) throw Error("Generated sample failed: " + generated.stderr);
    const base = join(root, "app", surface, "sample-records");
    const code = `import { SampleRecordsDefinition, SampleRecordsQuery } from ${JSON.stringify(join(base, "schema.ts"))}; import fixture from ${JSON.stringify(join(base, "acceptance.fixture.json"))}; import { mountGeneratedSample } from "./e2e/fixtures/pap1077-generated-sample"; void mountGeneratedSample(SampleRecordsDefinition, SampleRecordsQuery, fixture.rows);`;
    return (await build({ stdin: { contents: code, resolveDir: process.cwd(), loader: "tsx" }, alias: { "@": resolve(".") }, outfile: "fixture.js", bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, banner: { js: "var process={env:{NODE_ENV:'production'}};" }, plugins: [{name: "generated-route-authorities", setup(build) {
      build.onLoad({filter: /[\\/]lib[\\/](?:ho-routes|bo-url-contract|host-boundary)\.ts$/}, args => {
        const filename = args.path.split(/[\\/]/).at(-1)!;
        return {contents: readFileSync(join(root, "lib", filename), "utf8"), loader: "ts", resolveDir: resolve("lib")};
      });
    }}], logLevel: "silent" })).outputFiles[0].text;
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const bundles = { bo: "", ho: "" }; test.beforeAll(async () => { bundles.bo = await sample("bo"); bundles.ho = await sample("ho"); });
test.use({ launchOptions: process.platform === "win32" ? { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" } : {} });

async function fixture(page: Page, surface: "bo" | "ho", scenario = "ready") {
  const network: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) network.push(request.method()); });
  const css = readFileSync(surface === "bo" ? "public/bo-authority-source/bo-scoped.css" : "public/ho-authority-source/ho-scoped.css", "utf8");
  await page.route("**/*", route => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="vi" data-surface="${surface}" data-bo-ui-authority="v25"><head><style>*{box-sizing:border-box}body{margin:0}${css}</style></head><body><div id="root"></div><script>${bundles[surface]}</script></body></html>` })
    : route.fulfill({ status: 403, body: "Synthetic fixture denies outbound requests" }));
  await page.goto(`https://${surface}.staging.pinohouse.art/${surface}/sample-records?scenario=${scenario}`);
  return network;
}

for (const surface of ["bo", "ho"] as const) {
  test(`PAP1077 generated ${surface} route authorities stay exact and Staging-only`, async ({ page }) => {
    await fixture(page, surface);
    await expect(page.getByRole("button", { name: "Quick View SYNTHETIC DEMO 001", exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__pap1077HostMatrix)).toEqual({ own: "next", head: "next", post: "not_found", child: "not_found", other: "not_found", production: "not_found" });
  });
  for (const width of [1440, 1024, 768, 390, 320]) test(`PAP1077 generated ${surface} schema journey and business variant ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const network = await fixture(page, surface);
    const opener = page.getByRole("button", { name: "Quick View SYNTHETIC DEMO 001", exact: true });
    await expect(opener).toBeVisible(); await opener.press("Enter");
    await expect(page.locator('[data-tdd-shell="drawer"]')).toBeVisible(); await expect(page.getByRole("button", { name: /Full Detail/ })).toBeEnabled();
    const controls = await page.locator('[data-tdd-properties="drawer"] .property-control').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
    expect(controls.length).toBeGreaterThan(0); expect(Math.min(...controls)).toBeGreaterThanOrEqual(105);
    await page.getByRole("button", { name: /Full Detail/ }).click();
    await expect(page.getByRole("tab", { name: "Tổng quan", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Thông tin bổ sung", exact: true }).click(); await expect(page.getByRole("tabpanel")).toContainText("SYNTHETIC DEMO 001");
    await page.getByRole("tab", { name: "Thông tin bổ sung", exact: true }).press("End");
    await expect(page.getByRole("tab", { name: "Lịch sử", exact: true })).toBeFocused();
    await expect(page.getByRole("tabpanel")).toContainText("Chưa có nguồn lịch sử được phê duyệt.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
    await page.reload(); await expect(page.getByRole("tab", { name: "Lịch sử", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Quay lại bảng", exact: true }).click(); await expect(opener).toBeFocused();
    expect(network).toEqual([]);
  });
  for (const scenario of ["denied", "forged-principal", "wrong-surface", "record-scope", ...(surface === "bo" ? ["unauthorized-center"] : [])]) test(`PAP1077 generated ${surface} denies ${scenario}`, async ({ page }) => {
    const network = await fixture(page, surface, scenario);
    if (scenario === "record-scope") await expect(page.getByRole("status")).toHaveText("Không có quyền xem bản ghi.");
    else await expect(page.getByRole("alert")).toHaveText("Synthetic adapter denied: " + (scenario === "wrong-surface" ? "404" : "403"));
    await expect(page.getByRole("button", { name: /^Quick View SYNTHETIC/ })).toHaveCount(0);
    await expect(page.locator('[data-tdd-shell="detail"]')).toHaveCount(0);
    expect(network).toEqual([]);
  });
}
