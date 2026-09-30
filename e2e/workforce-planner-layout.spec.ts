import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "app/bo/bo.module.css"), "utf8");
const shellCss = readFileSync(resolve(process.cwd(), "app/components/tos-shell/bo-shell.module.css"), "utf8");
const globalCss = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
const days = ["Thứ 2, 28/09", "Thứ 3, 29/09", "Thứ 4, 30/09", "Thứ 5, 01/10", "Thứ 6, 02/10", "Thứ 7, 03/10", "CN, 04/10"];

function fixture() {
  const header = days.map((day) => `<th>${day}</th>`).join("");
  const rows = Array.from({ length: 17 }, (_, index) =>
    `<tr><th>Staff ${index + 1}</th>${days.map((_, day) =>
      `<td><button class="plannerCell"><strong>${day % 3 === 0 ? "Đã xếp" : "Có thể"}</strong><span>Ca Tối 18:00–21:00</span></button></td>`
    ).join("")}</tr>`
  ).join("");
  return `<!doctype html><style>${globalCss}\n${shellCss}\n${css}</style><div class="shell"><aside class="sidebar"></aside><div class="workspace"><header class="topbar"></header><main class="main"><main class="page plannerPage"><div class="plannerLayout"><section class="panel"><div class="plannerTableWrap"><table><thead><tr><th>Staff</th>${header}</tr></thead><tbody>${rows}</tbody></table></div></section><aside class="plannerSide">Action panel</aside></div></main></main></div></div>`;
}

async function metrics(page: Page) {
  return page.locator(".plannerTableWrap").evaluate((wrap) => {
    const rect = wrap.getBoundingClientRect();
    const headers = [...wrap.querySelectorAll("thead th")].map((node) => ({
      text: node.textContent ?? "",
      rect: node.getBoundingClientRect().toJSON(),
      position: getComputedStyle(node).position,
    }));
    const firstBodyHeader = wrap.querySelector("tbody th")!;
    return {
      clientWidth: wrap.clientWidth,
      scrollWidth: wrap.scrollWidth,
      rect: rect.toJSON(),
      headers,
      firstBodyHeader: {
        position: getComputedStyle(firstBodyHeader).position,
        left: getComputedStyle(firstBodyHeader).left,
      },
    };
  });
}

test("WFMUX-001/002 desktop keeps Staff and Monday-Sunday visible with action panel", async ({ page }) => {
  await page.setViewportSize({ width: 1450, height: 800 });
  await page.setContent(fixture());
  const grid = await metrics(page);
  expect(grid.scrollWidth).toBeLessThanOrEqual(grid.clientWidth + 1);
  for (const label of ["Thứ 7, 03/10", "CN, 04/10"]) {
    const header = grid.headers.find((item) => item.text === label);
    expect(header).toBeTruthy();
    expect(header!.rect.x).toBeGreaterThanOrEqual(grid.rect.x - 1);
    expect(header!.rect.x + header!.rect.width).toBeLessThanOrEqual(grid.rect.x + grid.rect.width + 1);
  }
  await expect(page.locator(".plannerSide")).toBeVisible();
});
test("WFMUX-003 preserves header and Staff context while grid scrolls vertically", async ({ page }) => {
  await page.setViewportSize({ width: 1450, height: 800 });
  await page.setContent(fixture());
  const grid = await metrics(page);
  expect(grid.headers.every((item) => item.position === "sticky")).toBe(true);
  expect(grid.firstBodyHeader.position).toBe("sticky");
  expect(grid.firstBodyHeader.left).toBe("0px");
  const wrap = page.locator(".plannerTableWrap");
  await wrap.evaluate((node) => { node.scrollTop = 300; });
  const top = await page.locator(".plannerTableWrap thead th").first().evaluate((node) => node.getBoundingClientRect().top);
  const wrapTop = await wrap.evaluate((node) => node.getBoundingClientRect().top);
  expect(Math.abs(top - wrapTop)).toBeLessThanOrEqual(2);
});

test("WFMUX-004 1366px BoShell stacks the action panel before the week clips", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 800 });
  await page.setContent(fixture());
  const columns = await page.locator(".plannerLayout").evaluate((node) => getComputedStyle(node).gridTemplateColumns);
  expect(columns.trim().split(/\s+/)).toHaveLength(1);
  const grid = await metrics(page);
  expect(grid.scrollWidth).toBeLessThanOrEqual(grid.clientWidth + 1);
});
