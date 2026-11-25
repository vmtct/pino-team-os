import {test} from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {chromium,expect} from "@playwright/test";

test("PAP-2373 isolated native Role Detail typed metadata editor",async()=>{
 const id="01a17d3f-8697-7080-bdf1-33e939758059";
 const original={id,roleKey:"custom-fixture",roleType:"custom",status:"active",displayName:"QA Role",description:"QA Description",permissionKeys:["access.role.view"],permissionCount:1,assignmentCount:0,createdAt:"2026-11-24T09:00:00.000Z",updatedAt:"2026-11-24T10:00:00.000Z"};
 const built=await build({stdin:{contents:
 'import React from "react";import {createRoot} from "react-dom/client";import {HoRoleEditor} from "./app/ho/system/roles/HoRoleEditor";'+
 'const q=new URLSearchParams(location.search);createRoot(document.querySelector("main")).render(<HoRoleEditor roleId="'+id+'" assignmentCount={0} authorized={q.get("mode")!=="denied"} metadataAuthorized={true} activeTab="overview" onSaved={()=>{document.body.dataset.saved=String(Number(document.body.dataset.saved||0)+1)}}/>);',
 resolveDir:process.cwd(),loader:"tsx"},jsx:"automatic",bundle:true,write:false,outdir:"out",loader:{".css":"empty"},define:{"process.env":"{}","process.env.NODE_ENV":'"production"'}});
 const js=built.outputFiles.find(f=>f.path.endsWith(".js")).text;
 const browser=await chromium.launch();
 try{
  for(const mode of ["saved","uncertain","protected","denied"]){
   const context=await browser.newContext({viewport:{width:mode==="uncertain"?390:1440,height:900},serviceWorkers:"block"});
   try{
    const page=await context.newPage();
    let current={...original,permissionKeys:[...original.permissionKeys]},posts=0,reads=0;
    if(mode==="protected")current={...current,roleType:"system"};
    const errors=[],unexpected=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.route("**/*",async route=>{
     const req=route.request(),url=new URL(req.url());
     if(url.origin!=="https://fixture.invalid"){unexpected.push(req.url());return route.abort();}
     if(url.pathname==="/role-component"&&req.method()==="GET")return route.fulfill({contentType:"text/html",body:"<main></main>"});
     if(url.pathname==="/api/bo/access/roles/"+id&&req.method()==="GET"){reads++;return route.fulfill({json:{data:current}});}
     if(url.pathname==="/api/bo/access/permissions"&&req.method()==="GET")return route.fulfill({json:{data:[{key:"access.role.view",domain:"access",displayLabel:"View Role",description:"Synthetic",accessKind:"read",surfaceApplicability:"BO",applicablePlatforms:["HO"]}]}});
     if(url.pathname==="/api/ho/system/roles/"+id+"/update"&&req.method()==="POST"&&(mode==="saved"||mode==="uncertain")){
      posts++;
      const wanted={id,expectedVersion:original.updatedAt,patch:{name:"QA Renamed"}};
      try{assert.deepEqual(req.postDataJSON(),wanted);}catch(e){errors.push(String(e));return route.fulfill({status:400,json:{}});}
      if(mode==="uncertain")return route.fulfill({status:503,json:{}});
      await new Promise(r=>setTimeout(r,150));
      current={...current,displayName:"QA Renamed",updatedAt:"2026-11-24T10:00:01.000Z"};
      return route.fulfill({json:{data:current}});
     }
     unexpected.push(req.method()+" "+url.pathname);return route.abort();
    });
    await page.goto("https://fixture.invalid/role-component?mode="+mode);
    await page.addScriptTag({content:js});
    const name=page.locator('[data-pds-field="name"]');
    await expect(name).toContainText("QA Role");
    if(mode==="protected"||mode==="denied"){
     await expect(name.locator("button")).toHaveCount(0);
     assert.equal(posts,0);
    }else{
     await name.locator("button").click();
     const editor=page.locator(".pds-property-editor");
     await expect(editor).toBeVisible();
     await editor.locator("input").fill("QA Renamed");
     await editor.locator('button[type="submit"]').click();
     if(mode==="saved"){
      await expect(name).toContainText("QA Renamed");
      await expect(editor).toHaveCount(0);
      await expect(page.locator("body")).toHaveAttribute("data-saved","1");
      assert.ok(reads>=3);
     }else{
      await expect(name.locator("button")).toHaveCount(0);
      await expect(name).toContainText("QA Role");
      await expect(page.locator("body")).not.toHaveAttribute("data-saved","1");
      assert.equal(reads,2);
     }
     assert.equal(posts,1);
     assert.deepEqual(current.permissionKeys,original.permissionKeys);
    }
    assert.deepEqual(errors,[]);
    assert.deepEqual(unexpected,[]);
    console.log("PAP2373_SYNTHETIC",mode,"PASS",JSON.stringify({reads,posts}));
   }finally{await context.close();}
  }
 }finally{await browser.close();}
});
