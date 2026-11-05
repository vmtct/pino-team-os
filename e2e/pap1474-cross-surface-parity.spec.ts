import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
type Surface = "BO" | "HO";
const widths=[1440,1024,768,390,320] as const;
test.use({launchOptions:process.platform==="win32"?{executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"}:{}});
async function load(page:import("@playwright/test").Page,surface:Surface) {
 const html=readFileSync(resolve("node_modules/.cache/pap1073",surface+"-table.html"),"utf8");
 await page.setContent(html,{waitUntil:"load"});
 return page.evaluate(()=>{
   const heads=[...document.querySelectorAll<HTMLTableCellElement>("#typed-table thead th[data-column]")];
   const rows=[...document.querySelectorAll<HTMLTableCellElement>("#typed-table tbody tr:first-child td")];
   const extent=(node:Element)=>Number(node.getBoundingClientRect().width.toFixed(1));
   const toolbar=document.querySelector<HTMLElement>('[data-tdd-shell="table"] .toolbar');
   const table=document.querySelector<HTMLElement>("#typed-table");
   return {
     columns:heads.map(node=>({key:node.dataset.column,width:extent(node),identity:node.hasAttribute("data-tdd-identity-column")})),
     rows:rows.map(extent),
     table:extent(table!),layout:getComputedStyle(table!).tableLayout,
     toolbarHeight:Math.round(toolbar!.getBoundingClientRect().height),
     opener:document.querySelectorAll(".first-quick-cell,.quick-open-th,.row-open").length,
     hiddenActions:[...document.querySelectorAll<HTMLElement>('[data-tdd-shell="table"] .toolbar-button,[data-tdd-shell="table"] .view-add')].filter(node=>getComputedStyle(node).display==="none").length,
     pageOverflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth
   };
 });
}
for(const width of widths) {
 test("PAP-1474 same BO/HO geometry @ "+width+"px",async({browser})=>{
   const a=await browser.newPage({viewport:{width,height:900}});
   const b=await browser.newPage({viewport:{width,height:900}});
   try{
     const bo=await load(a,"BO"),ho=await load(b,"HO");
     const expectedIdentity=width<=760?158:width<=980?187:225;
     expect(bo.opener,"PAP-1437 must not resurrect opener").toBe(0);
     expect(ho.opener,"PAP-1437 must not resurrect opener").toBe(0);
     expect(bo.columns.filter(c=>c.identity),"BO exactly one identity").toHaveLength(1);
     expect(ho.columns.filter(c=>c.identity),"HO exactly one identity").toHaveLength(1);
     expect(bo.columns.find(c=>c.identity)?.width).toBeCloseTo(expectedIdentity,0);
     expect(ho.columns.find(c=>c.identity)?.width).toBeCloseTo(expectedIdentity,0);
     expect(bo.layout).toBe("fixed"); expect(ho.layout).toBe("fixed");
     expect(bo.hiddenActions).toBe(0);expect(ho.hiddenActions).toBe(0);
     expect(bo.toolbarHeight).toBe(ho.toolbarHeight);
     expect(Math.abs(bo.table-ho.table)).toBeLessThanOrEqual(1);
     expect(bo.columns.map(c=>c.key)).toEqual(ho.columns.map(c=>c.key));
     expect(bo.columns.map(c=>c.width)).toEqual(ho.columns.map(c=>c.width));
     expect(bo.rows).toEqual(ho.rows);
     expect(bo.pageOverflow).toBeLessThanOrEqual(1);
     expect(ho.pageOverflow).toBeLessThanOrEqual(1);
   }finally{await Promise.all([a.close(),b.close()]);}
 });
}
test("PAP-1474 negative: a theme-specific identity width change is detected",async({browser})=>{
 const bo=await browser.newPage({viewport:{width:1440,height:900}});
 const ho=await browser.newPage({viewport:{width:1440,height:900}});
 try{
  await Promise.all([load(bo,"BO"),load(ho,"HO")]);
  await bo.addStyleTag({content:'[data-tdd-shell="table"] #typed-table th[data-tdd-identity-column], [data-tdd-shell="table"] #typed-table td[data-tdd-identity-column] {width:300px!important;min-width:300px!important;max-width:300px!important}'});
  const width=async(page:import("@playwright/test").Page)=>page.locator("#typed-table th[data-tdd-identity-column]").evaluate(x=>x.getBoundingClientRect().width);
  expect(Math.abs((await width(bo))-(await width(ho)))).toBeGreaterThan(50);
 }finally{await Promise.all([bo.close(),ho.close()]);}
});
