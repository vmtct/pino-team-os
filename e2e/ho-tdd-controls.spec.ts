import {expect,test} from "@playwright/test";
import {readFileSync} from "node:fs";
const css=readFileSync("public/ho-authority-source/ho-scoped.css","utf8");
const controls=()=>`<div class="toolbar"><button class="toolbar-button" id="filter-toggle">Filter</button><button class="toolbar-button" id="visible-columns">Columns</button><button class="toolbar-button" id="group-shortcut">Group</button><button class="toolbar-button" id="reset-all">Reset</button><button class="toolbar-button" id="undo-v22">Undo</button></div><button class="view-add" aria-label="Custom View">+</button>`;
test.use({launchOptions:process.platform==="win32"?{executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"}:{}});
for(const width of [1440,1024,768,390,320])test(`PAP1229 TDD controls visible; legacy controls hidden ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.setContent(`<!doctype html><html data-surface="ho"><head><style>*{box-sizing:border-box}body{margin:0}${css}</style></head><body><section id="legacy">${controls()}</section><section id="canonical" data-tdd-shell="table">${controls()}</section></body></html>`);
 for(const selector of ["#filter-toggle","#visible-columns","#group-shortcut","#reset-all","#undo-v22",".view-add"]){await expect(page.locator("#canonical "+selector)).toBeVisible();await expect(page.locator("#legacy "+selector)).toBeHidden();}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
