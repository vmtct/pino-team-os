import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const codePromise=build({entryPoints:["e2e/fixtures/pap1471-detail-inline.tsx"],write:false,bundle:true,format:"iife",platform:"browser",jsx:"automatic",plugins:[{name:"css-module-stub",setup(build){build.onLoad({filter:/\.module\.css$/},()=>({contents:"export default {};",loader:"js"}));}}],banner:{js:"var process={env:{NODE_ENV:'production'}};"},define:{"process.env.NODE_ENV":'"production"'},logLevel:"silent"}).then(result=>result.outputFiles[0].text);
test.use({launchOptions:process.platform==="win32"?{executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"}:{}});
async function setup(page: import("@playwright/test").Page, surface:"BO"|"HO", scenario:string){
 const css=readFileSync(resolve(surface==="BO"?"public/bo-authority-source/styles.css":"public/ho-authority-source/ho-scoped.css"),"utf8");
 const code=await codePromise;
 await page.route("**/*", route=>route.fulfill({contentType:"text/html",body:'<!doctype html><html lang="vi" data-surface="'+surface.toLowerCase()+'" data-bo-ui-authority="v25"><head><style>'+css+'</style></head><body><div id="root"></div><script>'+code+'</script></body></html>'}));
 await page.goto((surface==="BO"?"https://bo.staging.pinohouse.art/bo":"https://ho.staging.pinohouse.art/ho")+'?scenario='+scenario);
 await expect(page.locator('[data-tdd-shell="detail"]')).toBeVisible();
}
for(const surface of ["BO","HO"] as const){
 test(surface+" PAP-1471 direct field click + cancel + versioned Save",async({page})=>{
  await setup(page,surface,"editable");
  const edit=page.getByRole("button",{name:"Sửa Họ và tên",exact:true});
  await expect(edit).toBeVisible();
  await expect(page.getByRole("button",{name:"Chỉnh sửa",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Tải lại",exact:true})).toBeVisible();
  await edit.click();
  const dialog=page.getByRole("dialog",{name:"Sửa Họ và tên"});
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox",{name:"Họ và tên"}).fill("Không lưu");
  await dialog.getByRole("button",{name:"Hủy"}).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>window.__pap1471Writes)).toBe(0);
  await edit.click();
  await dialog.getByRole("textbox",{name:"Họ và tên"}).fill("Học viên đã sửa");
  await dialog.getByRole("button",{name:"Lưu"}).click();
  await expect(dialog).toHaveCount(0);
  await expect(edit).toContainText("Học viên đã sửa");
  expect(await page.evaluate(()=>window.__pap1471Writes)).toBe(1);
 });
 for(const scenario of ["readonly","no-writer"]){
  test(surface+" PAP-1471 "+scenario+" denies inline editing",async({page})=>{
   await setup(page,surface,scenario);
   await expect(page.getByRole("button",{name:"Sửa Họ và tên"})).toHaveCount(0);
   await expect(page.getByRole("button",{name:"Sửa ID"})).toHaveCount(0);
   expect(await page.evaluate(()=>window.__pap1471Writes)).toBe(0);
  });
 }
}
