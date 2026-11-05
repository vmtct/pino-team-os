import {test,expect,type Page} from "@playwright/test";
import {buildSync} from "esbuild";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {resolve} from "node:path";
const require=createRequire(resolve("package.json"));
const files=buildSync({outfile:"fixture.js",entryPoints:["e2e/fixtures/pap1170-self.tsx"],bundle:true,write:false,banner:{js:"var process = { env: { NODE_ENV: 'production' } };"},format:"iife",platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"'},logLevel:"silent"}).outputFiles;
const script=files.find(f=>f.path.endsWith(".js"))!.text;
const css=["public/bo-authority-source/bo-scoped.css",require.resolve("@pino/design-system/bo-tokens.css"),require.resolve("@pino/design-system/components.css")].map(p=>readFileSync(p,"utf8")).join("\n")+files.filter(f=>f.path.endsWith(".css")).map(f=>f.text).join("\n");
async function open(page:Page,denied=false){
 const writes:string[]=[];page.on("pageerror",error=>console.error("PAP1170_PAGE_ERROR",error.message));
 await page.route("https://pap1170.test/**",route=>{
  if(route.request().method()!=="GET")writes.push(route.request().url());
  return route.fulfill({contentType:"text/html",body:'<!doctype html><html data-surface="bo" data-bo-ui-authority="v25"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}#root{padding:16px;max-width:1100px;margin:auto}</style><style>'+css+'</style></head><body><main id="root" data-surface="bo"></main><script>'+script.replaceAll('</script>','<\\/script>')+'</script></body></html>'});
 });
 await page.goto("https://pap1170.test/"+(denied?"?denied":""));return writes;
}
for(const width of [1440,1024,768,390,320])test("PAP-1170 BO projected readonly properties "+width,async({page},info)=>{
 await page.setViewportSize({width,height:1000});const writes=await open(page);
 await expect(page.locator('[data-pds-field="avatarStatus"]')).toContainText("READY");
 await expect(page.locator('[data-pds-field]')).toHaveCount(12);
 await expect(page.locator('[data-pds-field="secret"]')).toHaveCount(0);
 await expect(page.locator('.pds-property-section button')).toHaveCount(0);
 await expect(page.locator('.pds-property-section select')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 const box=await page.locator('.pds-property-section').first().boundingBox();expect(box!.width).toBeGreaterThan(200);
 await page.screenshot({path:info.outputPath('bo-properties-'+width+'.png'),fullPage:true});
 expect(writes).toEqual([]);
});
test("PAP-1170 denied projection never reaches shared properties",async({page})=>{
 const writes=await open(page,true);await expect(page.getByText("Không có quyền xem bản ghi.",{exact:true})).toBeVisible();await expect(page.locator('[data-pds-field]')).toHaveCount(0);await expect(page.getByText("An Reception",{exact:true})).toHaveCount(0);expect(writes).toEqual([]);
});
