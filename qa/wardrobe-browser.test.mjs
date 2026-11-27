import {test} from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {chromium,expect} from "@playwright/test";

test("PAP-2200 native Wardrobe canonical Create action and cancel/focus, synthetic only",async()=>{
 const bundle=await build({stdin:{contents:`
  import React from "react";
  import {createRoot} from "react-dom/client";
  import {HoItemsTdd} from "./app/ho/pinoria/wardrobe/HoItemsTdd";
  import "./public/bo-authority-source/bo-scoped.css";
  import "./public/ho-authority-source/ho-scoped.css";
  import "./app/bo/design-system/foundation.css";
  import "./app/components/workspace-renderer/tdd-detail-layout.css";
  import "./app/components/workspace-renderer/tdd-table-geometry.css";
  import "./app/components/workspace-renderer/tdd-freeze.css";
  createRoot(document.getElementById("root")).render(<HoItemsTdd/>);
 `,resolveDir:process.cwd(),loader:"tsx"},jsx:"automatic",bundle:true,write:false,outdir:"out",loader:{".png":"dataurl",".svg":"dataurl",".woff2":"dataurl"},external:["https://*","http://*"],define:{"process.env.NODE_ENV":'"production"', "process.env":'{}'}});
 const js=bundle.outputFiles.find(f=>f.path.endsWith(".js")).text;
 const css=bundle.outputFiles.find(f=>f.path.endsWith(".css"))?.text??"";
 const origin="https://ho.staging.pinohouse.art",path="/ho/pinoria/wardrobe";
 const sample={id:"019b1126-0001-7000-8000-000000000001",key:"qa-wardrobe",displayName:"QA Item Only",type:"WEARABLE",slot:"HEADWEAR",status:"UNPUBLISHED",revision:6,asset:{key:"pinoria/item/uploads/"+"a".repeat(64)+".png",mimeType:"image/png",byteSize:6,sha256:"a".repeat(64)},positionX:0,positionY:0,scale:1,rotationDegrees:null,checkInItem:false,rarity:3,createdAt:"2026-11-08T09:30:00.000Z",updatedAt:"2026-11-08T09:42:00.000Z",publishedAt:null,unpublishedAt:null};
 const browser=await chromium.launch({channel:"chrome",headless:true});
 try{
  for(const [width,manage] of [[320,true],[390,true],[768,true],[1440,true],[1440,false]]){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"});
   const errors=[],writes=[];
   try{
    const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
    // Offline test only: even the canonical host is intercepted. Never forward a request.
    await page.route("**/*",async route=>{
     const r=route.request(),url=new URL(r.url());
     if(r.method()!=="GET"){writes.push(r.method()+" "+url.pathname);return route.fulfill({status:403,body:"blocked fixture mutation"});}
     if(url.origin!==origin)return route.fulfill({status:404,body:"offline"});
     if(url.pathname===path)return route.fulfill({contentType:"text/html",body:"<!doctype html><html lang=vi><head></head><body><div id=root></div></body></html>"});
     if(url.pathname==="/api/bo/context")return route.fulfill({json:{data:{surface:"BO",entitled:true,userId:"qa-wardrobe",displayName:"QA Founder",permissionKeys:["team.bo.access","pinoria.item.view",...(manage?["pinoria.item.manage"]:[])]}}});
     if(url.pathname==="/api/ho/pinoria/items")return route.fulfill({json:{data:[sample]}});
     if(url.pathname==="/api/ho/pinoria/items/"+sample.id)return route.fulfill({json:{data:sample}});
     return route.fulfill({status:404,contentType:"application/json",body:"{}"});
    });
    await page.goto(origin+path);await page.addStyleTag({content:css});await page.addScriptTag({content:js});
    await expect(page.getByText(sample.displayName,{exact:true}).first()).toBeVisible({timeout:15000});
    const add=page.locator('#list-screen .page-heading [data-tdd-action-slot="table.header"]').getByRole("button",{name:"Thêm",exact:true});
    const drawer=page.locator('[data-tdd-shell="drawer"]');
    await expect(add).toHaveCount(manage?1:0);
    if(manage){
     await expect(add).toBeVisible();
     await expect(page.getByRole("button",{name:"Thêm",exact:true})).toHaveCount(1);
     await add.focus();await page.keyboard.press("Enter");await expect(drawer).toBeVisible();
     await expect(drawer.getByRole("checkbox",{name:"Check-in Item"})).not.toBeChecked();
     await drawer.getByRole("checkbox",{name:"Check-in Item"}).check();
     await page.keyboard.press("Escape");await expect(drawer).toHaveCount(0);await expect(add).toBeFocused();
     await add.click();await expect(drawer.getByRole("checkbox",{name:"Check-in Item"})).not.toBeChecked();
     await drawer.getByRole("button",{name:"Hủy",exact:true}).click();await expect(drawer).toHaveCount(0);
     const row=page.getByRole("row").filter({has:page.getByText(sample.displayName,{exact:true})});
     await row.getByRole("button",{name:/Quick View/i}).first().click();
     await expect(drawer).toHaveCount(1);
     await drawer.getByRole("button",{name:/full detail/i}).click();
     await expect(page.locator('[data-tdd-shell="detail"]')).toBeVisible();
     await expect(add).not.toBeVisible();
    }
    assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
    console.log("WARDROBE_NATIVE_PASS",width,manage?"manage":"view-only");
   }finally{await context.close();}
  }
 }finally{await browser.close();}
});