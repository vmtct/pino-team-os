import { expect, test, type Page } from "@playwright/test";
import { buildSync } from "esbuild";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const packageRequire = createRequire(resolve("package.json"));
const bundle = buildSync({ outfile: "fixture.js", entryPoints: ["e2e/fixtures/pap1117-staff.tsx"], bundle: true, write: false, banner: { js: "var process = { env: { NODE_ENV: 'production' } };" }, format: "iife", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent" }).outputFiles;
const script = bundle.find(file => file.path.endsWith(".js"))!.text;
const styles = ["public/ho-authority-source/ho-scoped.css", packageRequire.resolve("@pino/design-system/bo-tokens.css"), packageRequire.resolve("@pino/design-system/components.css")].map(path => readFileSync(path, "utf8")).join("\n") + bundle.filter(file => file.path.endsWith(".css")).map(file => file.text).join("\n");
const old = { assignmentId: "assignment-a", roleId: "role-a", roleName: "Reception", roleKey: "reception", scopeType: "CENTER", scopeId: "center-a" };
const roles = [{ id: "role-a", displayName: "Reception", roleKey: "reception", status: "active" }, { id: "role-b", displayName: "Teacher", roleKey: "teacher", status: "active" }, { id: "founder", displayName: "Founder", roleKey: "founder", status: "active" }];
async function open(page: Page, scenario = "normal") {
  page.on("pageerror", error => console.error("FIXTURE_BROWSER_ERROR", error.message));
  let assignments = [{ ...old }]; const writes: object[] = [];
  await page.route("https://pap1117.test/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON(); writes.push(body);
        if (scenario === "denied") return route.fulfill({ status: 403, json: {} });
        if (body.action === "assign") assignments.push({ ...old, assignmentId: "assignment-b", roleId: "role-b", roleName: "Teacher", roleKey: "teacher" });
        if (body.action === "remove") {
          if (scenario === "partial") return route.fulfill({ status: 500, json: {} });
          assignments = assignments.filter(assignment => assignment.assignmentId !== body.assignmentId);
        }
        return route.fulfill({ json: {} });
      }
      if (scenario === "load-error") return route.fulfill({ status: 503, json: {} });
      if (url.pathname.endsWith("/roles")) return route.fulfill({ json: { data: roles } });
      const user = { id: "user-a", staffMemberId: "staff-a", status: "active", assignments: scenario === "multi" ? [old, old] : scenario === "founder" ? [{ ...old, roleKey: "founder" }] : assignments };
      return route.fulfill({ json: { data: scenario === "ambiguous" ? [user, user] : [user] } });
    }
    return route.fulfill({ contentType: "text/html", body: '<!doctype html><html data-surface="ho" data-bo-ui-authority="v25"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}#root{padding:16px;max-width:1100px;margin:auto}</style><style>' + styles + '</style></head><body><main id="root" data-surface="ho"></main><script>' + script.replaceAll("</script>", "<\\/script>") + '</script></body></html>' });
  });
  await page.goto("https://pap1117.test/?scenario=" + scenario);
  await expect(page.locator('[data-pds-field="role"]')).not.toContainText("Đang tải…");
  return writes;
}
for (const width of [1440, 1024, 768, 390, 320]) test("PAP-1117 shared HO properties and editor at " + width, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 }); const writes = await open(page);
  await expect(page.locator(".pds-property-section")).toHaveCount(1);
  await expect(page.locator("[data-pds-field]")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const boxes = await page.locator(".pds-property-value").evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, right: r.right, width: r.width }; }));
  expect(boxes[2].x).toBeCloseTo(boxes[0].x, 0); expect(Math.min(...boxes.map(box => box.width))).toBeGreaterThan(80);
  const trigger = page.getByRole("button", { name: "Sửa Vai trò", exact: true }); await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Sửa vai trò", exact: true }); await expect(dialog).toBeVisible();
  if ([1440, 390].includes(width)) await page.screenshot({ path: testInfo.outputPath("ho-staff-editor-" + width + ".png"), fullPage: true });
  const box = await dialog.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
  await expect(dialog.getByRole("option", { name: "Founder" })).toHaveCount(0);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused(); expect(writes).toHaveLength(0);
});
for (const scenario of ["self", "founder", "inactive", "ambiguous", "multi", "load-error"]) test("PAP-1117 readonly " + scenario, async ({ page }) => {
  const writes = await open(page, scenario); await expect(page.getByRole("button", { name: "Sửa Vai trò", exact: true })).toHaveCount(0); expect(writes).toHaveLength(0);
});
for (const scenario of ["normal", "denied", "partial"]) test("PAP-1117 mock commit " + scenario, async ({ page }) => {
  const writes = await open(page, scenario); await page.getByRole("button", { name: "Sửa Vai trò", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sửa vai trò", exact: true }); await dialog.getByRole("combobox").selectOption("role-b"); await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
  if (scenario === "normal") { await expect(dialog).toHaveCount(0); await expect(page.locator('[data-pds-field="role"]')).toContainText("Teacher"); await expect(page.getByRole("status")).toContainText("Đã lưu."); }
  else if (scenario === "partial") { await expect(page.getByText("Đã gán vai trò mới nhưng chưa gỡ được vai trò cũ. Cần kiểm tra ACL.")).toBeVisible(); await expect(page.locator('[data-pds-field="role"]')).toContainText("Nhiều vai trò"); }
  else { await expect(dialog).toBeVisible(); await expect(page.getByText("Không có quyền sửa vai trò.", { exact: true })).toBeVisible(); }
  expect(writes).toHaveLength(scenario === "denied" ? 1 : 2);
});
test("PAP-1117 changing staff dismisses old editor", async ({ page }) => {
  await open(page); await page.getByRole("button", { name: "Sửa Vai trò", exact: true }).click(); await page.getByRole("button", { name: "Đổi hồ sơ thử nghiệm" }).click(); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(page.locator('[data-pds-field="role"]')).toContainText("—");
});
