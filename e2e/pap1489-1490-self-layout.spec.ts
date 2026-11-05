import {test,expect,type Page} from "@playwright/test";
import {buildSync} from "esbuild";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {resolve} from "node:path";
const require=createRequire(resolve("package.json"));
const files=buildSync({outfile:"fixture.js",entryPoints:["e2e/fixtures/pap1489-1490-self.tsx"],bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"'},logLevel:"silent"}).outputFiles;
const script=files.find(f=>f.path.endsWith(".js"))!.text;
const css=["public/bo-authority-source/bo-scoped.css",require.resolve("@pino/design-system/bo-tokens.css"),require.resolve("@pino/design-system/components.css")].map(p=>readFileSync(p,"utf8")).join("\n")+files.filter(f=>f.path.endsWith(".css")).map(f=>f.text).join("\n");
const selfId="01a18140-10b8-70d3-ad6b-3e747a0cddea";
const items=Array.from({length:4},(_,i)=>({itemId:`01a18140-10b8-70d3-ad6b-3e747a0cdde${i}`,key:`fixture-${i}`,displayName:`Synthetic Item ${i}`,type:"WEARABLE",slot:"HAIR",itemStatus:"PUBLISHED",owned:true,ownershipStatus:"ACTIVE",ownership:{status:"ACTIVE",revision:1,provenance:"FE fixture",firstGrantedAt:"2026-11-05",revokedAt:null,updatedAt:"2026-11-05"}}));
async function open(page:Page){
  const writes:string[]=[];
  await page.route("**/*",route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()!=="GET")writes.push(request.url());
    if(url.pathname.startsWith("/api/bo/")){
      expect(url.searchParams.get("centerId")).toBe("center-fixture");
      const data=url.pathname.endsWith("/loadout")?{selfId,version:1,ready:false,slots:Object.fromEntries(["AURA_GROUND","AURA_BACK","BACK","OUTFIT","HAIR","FACE","HEADWEAR","PATH_MARK"].map(s=>[s,null])),renderStack:[],updatedAt:null}:{selfId,selfVersion:1,items};
      return route.fulfill({json:{data}});
    }
    if(url.hostname!=="pap1489.test")return route.abort();
    return route.fulfill({contentType:"text/html",body:`<!doctype html><html data-surface="bo" data-bo-ui-authority="v25"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}#root{padding:16px;max-width:1100px;margin:auto}</style><style>${css}</style></head><body><main id="root" data-surface="bo"></main><script>${script.replaceAll('</script>','<\\/script>')}</script></body></html>`});
  });
  await page.goto("https://pap1489.test/");
  return writes;
}
for(const width of [320,390,768,1024,1440])test(`PAP-1489/PAP-1490 actual Self detail layout ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:1000});
  const writes=await open(page);
  await page.getByRole("tab",{name:"Loadout",exact:true}).click();
  await expect(page.locator("#self-loadout-set")).toBeDisabled();
  await expect(page.getByRole("form")).toBeVisible();
  const canvas=page.locator("canvas");
  const bounds=await canvas.evaluate(e=>{
    const r=e.getBoundingClientRect(),figure=e.closest("figure")!.getBoundingClientRect(),panel=e.closest(".detail-panel")!.getBoundingClientRect();
    return {x:r.x,right:r.right,width:r.width,height:r.height,figureRight:figure.right,panelRight:panel.right,clientRight:document.documentElement.clientWidth,backing:[e.width,e.height]};
  });
  expect(bounds.backing).toEqual([270,480]);
  expect(bounds.width).toBeGreaterThan(0);
  expect(bounds.width).toBeLessThanOrEqual(270);
  expect(bounds.width/bounds.height).toBeCloseTo(9/16,2);
  for(const right of [bounds.figureRight,bounds.panelRight,bounds.clientRight])expect(bounds.right).toBeLessThanOrEqual(right+1);
  await page.screenshot({path:info.outputPath(`loadout-${width}.png`),fullPage:true});
  await page.getByRole("tab",{name:"Tủ đồ",exact:true}).click();
  const cards=page.locator("article.grid-card");
  await expect(cards).toHaveCount(4);
  const first=(await cards.nth(0).boundingBox())!,second=(await cards.nth(1).boundingBox())!;
  if(width>840){expect(first.y).toBeCloseTo(second.y,1);expect(second.x).toBeGreaterThan(first.x+first.width);expect(first.width).toBeCloseTo(second.width,1);}
  else{expect(first.x).toBeCloseTo(second.x,1);expect(second.y).toBeGreaterThan(first.y+first.height);}
  await expect(cards.first().getByRole("button",{name:"Thu hồi"})).toBeVisible();
  await page.getByRole("button",{name:"Thư Viện Đồ Pinoria"}).click();
  await expect(cards).toHaveCount(4);
  await page.getByRole("textbox",{name:"Tìm Item"}).fill("no-match");
  await expect(page.getByRole("status").filter({hasText:"Chưa có Item phù hợp"})).toBeVisible();
  await page.getByRole("textbox",{name:"Tìm Item"}).fill("");
  await page.screenshot({path:info.outputPath(`wardrobe-${width}.png`),fullPage:true});
  expect(writes).toEqual([]);
});
