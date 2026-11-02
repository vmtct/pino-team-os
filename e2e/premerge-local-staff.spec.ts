import { test, expect, type Page } from "@playwright/test";

/**
 * PAP-781 local UI E2E: real Next.js StaffManagementView + /bo/staff/[staffId],
 * temporary local-only BO layout fixture and intercepted API. NOT auth/Core integration.
 */
const STAFF = [
  { id: "staff-01", displayLabel: "Nguyễn Hằng", status: "active", roleLabel: "Operations", department: "School", email: "hang@example.test", salary: "PRIVATE_SALARY_NEVER_RENDER" },
  { id: "staff-02", displayLabel: "Trần Hân", status: "active", roleLabel: "Marketing", department: "Growth", email: "han@example.test", governmentId: "PRIVATE_CCCD_NEVER_RENDER" },
];
const USERS = [
  { id: "access-01", staffMemberId: "staff-01", status: "active", email: "hang@example.test", assignments: [] },
  { id: "access-02", staffMemberId: "staff-02", status: "suspended", email: "han@example.test", assignments: [] },
];
const ACTOR = {
  userId: "local-ui-fixture", staffMemberId: null, email: "fixture@example.test",
  surface: "BO", entitled: true, permissionKeys: [],
};
const PROFILE = (id: string) => ({
  ...(STAFF.find(x => x.id === id) ?? { id, displayLabel: "Unknown", status: "inactive" }),
  mobile: null, employmentType: null, startDate: null,
});

async function mockStaffApi(page: Page) {
  let privateReads = 0;
  const requests: string[] = [];
  await page.route("**/api/bo/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/bo\//, "");
    requests.push(path);
    let status = 200;
    let data: unknown = null;
    if (route.request().method() !== "GET") status = 405;
    else if (path === "context") data = ACTOR;
    else if (path === "workforce/staff-records") data = STAFF;
    else if (path === "access/users") data = USERS;
    else if (path === "access/roles") data = [];
    else if (path === "delivery/bootstrap-state") data = { centers: [], paths: [], runningClasses: [] };
    else if (/^workforce\/staff-records\/[^/]+$/.test(path)) {
      const staffId = decodeURIComponent(path.split("/").at(-1) ?? "");
      if (STAFF.some(item => item.id === staffId)) data = PROFILE(staffId);
      else status = 404;
    } else if (path.endsWith("/pinoria")) status = 503;
    else if (path.includes("/private")) { privateReads++; status = 403; }
    else status = 404;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(status === 200 ? { data } : { error: { message: status === 403 ? "Access denied" : "Fixture unavailable" } }),
    });
  });
  return { requests, countPrivate: () => privateReads };
}

for (const width of [390, 768, 1440]) {
  test("PAP-781 real Staff component local navigation UI — " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const mock = await mockStaffApi(page);
    await page.context().addCookies([{
      name: "pino_staff_password_session", value: "LOCAL_UI_ONLY_NOT_AUTH",
      url: "http://127.0.0.1:3109",
    }]);
    await page.goto("/bo/staff?q=H%C3%A2n&f_staffStatus=active&f_accessStatus=all");
    await expect(page.getByText("Trần Hân", { exact: true })).toBeVisible();
    await expect(page.getByText("Nguyễn Hằng", { exact: true })).toHaveCount(0);
    await page.getByRole("row", { name: /Trần Hân/ }).click();
    await expect(page.getByTestId("staff-quick-peek")).toBeVisible();
    await expect(page).toHaveURL(/staff=staff-02/);
    await expect(page.getByTestId("staff-quick-peek")).not.toContainText("PRIVATE_");
    await page.screenshot({ path: "test-results/pap781-local-quick-" + width + ".png", fullPage: true });
    expect(mock.countPrivate()).toBe(0);
    await page.getByTestId("staff-open-full-detail").click();
    await expect(page).toHaveURL(/\/bo\/staff\/staff-02\?from=/, {timeout: 45000});
    await expect(page.getByTestId("staff-full-detail")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trần Hân" }).first()).toBeVisible();
    await page.screenshot({ path: "test-results/pap781-local-full-" + width + ".png", fullPage: true });
    expect(mock.countPrivate()).toBe(0);
    await page.getByRole("link", { name: /Trở về danh sách/ }).click();
    await expect(page).toHaveURL(/\/bo\/staff\?q=H%C3%A2n/);
    await expect(page).not.toHaveURL(/staff=staff-02/);
    await expect(page.getByText("Trần Hân", { exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/pap781-local-staff-" + width + ".png", fullPage: true });
    expect(mock.requests.every(item => !item.includes("private"))).toBe(true);
  });
}

test("PAP-781 unknown deep-linked Staff surfaces an error, never another person's profile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 840 });
  const mock = await mockStaffApi(page);
  await page.context().addCookies([{
    name: "pino_staff_password_session", value: "LOCAL_UI_ONLY_NOT_AUTH", url: "http://127.0.0.1:3109",
  }]);
  await page.goto("/bo/staff/unknown-staff");
  await expect(page.getByTestId("staff-full-detail")).toBeVisible();
  await expect(page.getByTestId("staff-full-detail").getByRole("alert")).toContainText("Không thể tải hồ sơ Staff");
  await expect(page.getByText("Trần Hân", { exact: true })).toHaveCount(0);
  expect(mock.countPrivate()).toBe(0);
});

test("PAP-782 Staff full-detail tab routing, browser history and no private auto-reveal", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 900 });
  const mock = await mockStaffApi(page);
  await page.context().addCookies([{
    name: "pino_staff_password_session", value: "LOCAL_UI_ONLY_NOT_AUTH", url: "http://127.0.0.1:3109",
  }]);
  await page.goto("/bo/staff/staff-02?from=q%3DHan");
  const workspace = page.getByTestId("staff-full-detail");
  await expect(workspace).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Staff detail sections" }).getByRole("link")).toHaveCount(8);
  await expect(page.getByTestId("staff-v2-overview")).toContainText("Access status");
  await expect(page.getByTestId("staff-v2-overview")).toContainText("suspended");
  const rail = page.getByTestId("staff-v2-rail");
  await expect(rail).toBeVisible();
  await expect(rail).toContainText("Staff active nhưng Access chưa sẵn sàng.");
  await expect(rail.getByRole("link", { name: "Kiểm tra Access" })).toHaveAttribute("href", /tab=access/);
  await page.screenshot({ path: "test-results/pap782-overview-with-rail-390.png", fullPage: true });
  expect(mock.countPrivate()).toBe(0);
  await page.getByRole("navigation", { name: "Staff detail sections" }).getByRole("link", {name: "Thu nhập"}).click();
  await expect(page).toHaveURL(/tab=income/, {timeout:30000});
  await expect(page.getByTestId("staff-v2-unavailable")).toContainText("Chưa có dữ liệu được xác minh");
  await expect(page.getByTestId("staff-v2-overview")).toHaveCount(0);
  await page.goBack();
  await expect(page.getByTestId("staff-v2-overview")).toBeVisible();
  await page.getByRole("navigation", { name: "Staff detail sections" }).getByRole("link", {name: "Hồ sơ"}).click();
  await expect(page).toHaveURL(/tab=profile/, {timeout:30000});
  await expect(workspace.getByRole("heading", {name: "Trần Hân"}).last()).toBeVisible();
  expect(mock.countPrivate()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
