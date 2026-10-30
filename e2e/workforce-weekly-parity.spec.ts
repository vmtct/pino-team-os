import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
test.use(
  process.env.PLAYWRIGHT_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_CHANNEL }
    : {},
);
let html: string;
test.beforeAll(async () => {
  const mock = `
 const data={centerId:'center',termWeekId:'week',startDate:'2026-11-16',endDate:'2026-11-22',staff:[{id:'an',displayLabel:'Nguyễn Hoài An'},{id:'binh',displayLabel:'Trần Quốc Bình'},{id:'hang',displayLabel:'Lê Thùy Hằng'}],templates:[{id:'morning',displayLabel:'Ca sáng',code:'AM',status:'ACTIVE',startLocalTime:'09:00',endLocalTime:'12:00'}],availability:[{id:'av1',staffMemberId:'binh',status:'SUBMITTED',items:[{workDate:'2026-11-17',shiftTemplateId:'morning'}]},{id:'draft',staffMemberId:'hang',status:'DRAFT',items:[{workDate:'2026-11-18',shiftTemplateId:'morning'}]}],availabilityHistory:[],assignments:[{id:'shift',staffMemberId:'an',workDate:'2026-11-16',shiftTemplateId:'morning',status:'ACTIVE',coverageMode:'FULL_SHIFT',timeBasis:'SHIFT_TEMPLATE'}],roleAssignments:[],sessions:[],windows:{availability:{state:'OPEN',availabilityRegistrationOpen:true},planning:{state:'OPEN'}}};
 const center={id:'center',displayName:'PINO Cần Thơ',status:'active',canManageShiftTemplates:true,canEditPlanning:true};
 const week={id:'week',code:'W47',startDate:data.startDate,endDate:data.endDate};
 export class BoApiError extends Error{}
 export const boApi={workforcePlanningBootstrap:async()=>({centers:[center],termWeeks:[week]}),workforcePlanning:async()=>data,workforceShiftTemplates:async()=>data.templates,calendarScope:async()=>({classes:[]})};
 export const workforceRead={globalWeeks:async()=>({termWeeks:[week]})};`;
  const output = await build({
    stdin: {
      contents: `import React from 'react';import{createRoot}from'react-dom/client';import{WorkforcePlanningView}from'./app/bo/workforce/WorkforcePlanningView';createRoot(document.getElementById('root')).render(<WorkforcePlanningView embedded scope={{centerId:'center',termWeekId:'week'}}/>);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    outdir: "out",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "isolated-core-fixture",
        setup(b) {
          b.onResolve(
            { filter: /^@\/app\/bo\/components\/data-grid$/ },
            () => ({
              path: resolve("app/bo/components/data-grid/BoDataGrid.tsx"),
            }),
          );
          b.onResolve(
            {
              filter:
                /^@\/(lib\/bo-api|app\/bo\/architecture\/workforce-read-client)$/,
            },
            () => ({ path: "fixture", namespace: "mock" }),
          );
          b.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
            contents: mock,
            loader: "js",
          }));
        },
      },
    ],
  });
  const js = output.outputFiles.find((f) => f.path.endsWith(".js"))!.text,
    css = output.outputFiles.find((f) => f.path.endsWith(".css"))!.text;
  const authority = readFileSync(
    resolve("public/bo-authority-source/styles.css"),
    "utf8",
  );
  html = `<!doctype html><meta charset="utf-8"><style>${authority}\n${css}\nbody{margin:0;background:white}.fixture{margin-left:278px;padding:30px;min-width:0}@media(max-width:760px){.fixture{margin-left:0;padding:12px}}</style><div class="fixture"><div id="root"></div></div><script>${js}</script>`;
  mkdirSync("work/pap1185-preview", { recursive: true });
  writeFileSync("work/pap1185-preview/index.html", html);
});
for (const width of [1440, 1024, 768, 390, 320])
  test(`PAP-1185 weekly layout and Monday navigation at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.setContent(html);
    const calendar = page.getByRole("region", {
      name: "Lịch phân ca tuần",
      exact: true,
    });
    await expect(calendar).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const table = page.getByRole("table", {
        name: "Weekly Workforce planning matrix",
      }),
      side = page.getByRole("complementary", { name: "Công cụ phân công ca" });
    const tableRect = await table.boundingBox(),
      sideRect = await side.boundingBox();
    if (width > 1100) expect(sideRect!.x).toBeGreaterThan(tableRect!.x);
    else expect(sideRect!.y).toBeGreaterThan(tableRect!.y);
    await page.getByRole("button", { name: "CN 22/11", exact: true }).click();
    await page.getByRole("button", { name: "T2 16/11", exact: true }).click();
    await expect
      .poll(async () =>
        table
          .locator("thead th")
          .nth(1)
          .evaluate((e) => {
            const staff = e.previousElementSibling!.getBoundingClientRect();
            return e.getBoundingClientRect().left - staff.right;
          }),
      )
      .toBeGreaterThanOrEqual(-1);
    await page
      .getByRole("button", {
        name: "Trần Quốc Bình · T2 16/11/2026 · Chưa có ca",
        exact: true,
      })
      .click();
    await expect(
      side.getByText("Trần Quốc Bình", { exact: true }),
    ).toBeVisible();
    await side.getByRole("combobox").selectOption("morning");
    await expect(
      side.getByRole("checkbox", { name: "Giáo viên", exact: true }),
    ).toBeVisible();
    await expect(
      side.getByRole("button", { name: "Xác nhận ca & phân công" }),
    ).toBeDisabled();
    await side.getByRole("checkbox", { name: /Tiếp tân/ }).check();
    await expect(
      side.getByRole("button", { name: "Xác nhận ca & phân công" }),
    ).toBeEnabled();
    await side.getByRole("checkbox", { name: "Giáo viên", exact: true }).check();
    await expect(
      side.getByRole("button", { name: "Xác nhận ca & phân công" }),
    ).toBeDisabled();
    const checkbox = await side
      .getByRole("checkbox", { name: "Giáo viên", exact: true })
      .boundingBox();
    expect(checkbox!.width).toBeLessThanOrEqual(20);
    await page.screenshot({
      path: `work/pap1185-preview/weekly-${width}.png`,
      fullPage: true,
    });
  });
test("PAP-1185 search and submitted filters distinguish draft availability", async ({
  page,
}) => {
  await page.setContent(html);
  await page
    .getByRole("combobox", { name: "Hiển thị", exact: true })
    .selectOption("SUBMITTED");
  const table = page.getByRole("table", {
    name: "Weekly Workforce planning matrix",
  });
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.getByText("Trần Quốc Bình")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Hiển thị", exact: true })
    .selectOption("ALL");
  await page
    .getByRole("searchbox", { name: "Tìm nhân sự trong lịch tuần" })
    .fill("không tồn tại");
  await expect(page.getByText("Không có nhân sự phù hợp.")).toBeVisible();
});
