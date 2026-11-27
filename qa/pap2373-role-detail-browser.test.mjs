import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
import {build} from "esbuild";
import {chromium,expect} from "@playwright/test";

test("PAP-2373 isolated native Role Detail typed metadata editor",async()=>{
 const id="01a17d3f-8697-7080-bdf1-33e939758059";
 const original={id,roleKey:"custom-fixture",roleType:"custom",status:"active",displayName:"QA Role",description:"QA Description",permissionKeys:["access.role.view"],permissionCount:1,assignmentCount:0,createdAt:"2026-11-24T09:00:00.000Z",updatedAt:"2026-11-24T10:00:00.000Z"};
 const fixtureOverview={record:{id,name:original.displayName,description:original.description,roleKey:original.roleKey,roleType:original.roleType,status:original.status,permissionCount:1,assignmentCount:0,createdAt:original.createdAt,createdBy:"—",updatedAt:original.updatedAt,updatedBy:"—"},fields:[["name","Tên vai trò","text"],["roleKey","Role Key","text"],["description","Mô tả","textarea"],["roleType","Loại","text"],["status","Trạng thái","text"],["permissionCount","Số quyền","number"],["assignmentCount","Số phân công","number"],["id","Role ID","id"],["createdAt","Created Time","datetime"],["createdBy","Created By","text"],["updatedAt","Last Modified Time","datetime"],["updatedBy","Last Modified By","text"]].map(([key,label,type])=>({key,label,type,icon:"Aa",w:180,readonly:true})),sections:[{id:"role-info",label:"Thông tin Role",fields:["name","roleKey","description","roleType","status","permissionCount","assignmentCount","id"]},{id:"audit",label:"Thông tin hệ thống",fields:["createdAt","createdBy","updatedAt","updatedBy"]}]};
 const built=await build({stdin:{contents:
 'import React from "react";import {createRoot} from "react-dom/client";import {HoRoleEditor} from "./app/ho/system/roles/HoRoleEditor";'+
 'const q=new URLSearchParams(location.search);const root=createRoot(document.querySelector("main"));const nativeOverview=q.get("native")==="1"?'+JSON.stringify(fixtureOverview)+':undefined;function render(tab){root.render(<HoRoleEditor roleId="'+id+'" assignmentCount={0} authorized={q.get("mode")!=="denied"} metadataAuthorized={true} archiveAuthorized={true} nativeOverview={nativeOverview} activeTab={tab} onSaved={()=>{document.body.dataset.saved=String(Number(document.body.dataset.saved||0)+1)}}/>)};window.changeTab=render;render("overview");',
 resolveDir:process.cwd(),loader:"tsx"},jsx:"automatic",bundle:true,write:false,outdir:"out",loader:{".css":"empty"},define:{"process.env":"{}","process.env.NODE_ENV":'"production"'}});
 const js=built.outputFiles.find(f=>f.path.endsWith(".js")).text;
 const browser=await chromium.launch();
 try{
  for(const native of [false,true])for(const mode of ["saved","uncertain","protected","denied"]){
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
    await page.goto("https://fixture.invalid/role-component?mode="+mode+"&native="+Number(native));
    await page.addScriptTag({content:js});
    const name=native?page.locator(".v24-prop-item").filter({has:page.locator(".v24-prop-key").filter({hasText:"Tên vai trò"})}):page.locator('[data-pds-field="name"]');
    await expect(name).toContainText("QA Role");
    if(native){
      await expect(page.locator(".ho-role-technical")).toHaveCount(0);
      await expect(page.locator('[data-pds-field="name"]')).toHaveCount(0);
      await expect(page.locator(".v24-prop-item")).toHaveCount(12);
      await expect(page.locator(".v24-section-heading h4").filter({hasText:"Thông tin Role"})).toHaveCount(1);
      await expect(page.locator(".v24-prop-key").filter({hasText:"Role ID"})).toHaveCount(1);
      await expect(page.locator(".v24-prop-key").filter({hasText:"Last Modified Time"})).toHaveCount(1);
      await expect(page.getByRole("button",{name:"Lưu trữ vai trò",exact:true})).toBeVisible();
      await page.evaluate(()=>window.changeTab("permissions"));
      await expect(page.getByRole("heading",{name:"Quyền truy cập"})).toBeVisible();
      await expect(name).not.toBeVisible();
      await page.evaluate(()=>window.changeTab("overview"));
      await expect(name).toBeVisible();
      await expect(page.getByRole("heading",{name:"Quyền truy cập"})).not.toBeVisible();
    }
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
    if(native&&mode==="protected"){
      // Actual HO authority/DS CSS; no fake geometry or authenticated data.
      await page.evaluate(()=>{document.documentElement.dataset.surface="ho";});
      for(const css of ["public/ho-authority-source/ho-scoped.css","app/ho/ho-theme.css","app/components/workspace-renderer/tdd-detail-layout.css",require.resolve("@pino/design-system/bo-tokens.css"),require.resolve("@pino/design-system/components.css")])await page.addStyleTag({content:readFileSync(css,"utf8")});
      for(const width of [320,390,768,1024,1440,1920]){
        await page.setViewportSize({width,height:900});
        const geometry=await page.locator(".dsa-detail-group-grid").evaluate(grid=>{const box=grid.getBoundingClientRect();const root=grid.closest(".ho-role-editor").getBoundingClientRect();const children=[...grid.children].map(x=>x.getBoundingClientRect());return {width:box.width,rootWidth:root.width,columns:getComputedStyle(grid).gridTemplateColumns.split(" ").length,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,children:children.map(x=>({left:x.left,right:x.right,top:x.top,bottom:x.bottom})),right:box.right,left:box.left}});
        assert.ok(Math.abs(geometry.width-geometry.rootWidth)<=2,JSON.stringify(geometry));
        assert.equal(geometry.columns,geometry.width>=760?2:1,JSON.stringify(geometry));
        assert.ok(geometry.pageWidth<=geometry.viewport+1,JSON.stringify(geometry));
        assert.ok(geometry.children.every(x=>x.left>=geometry.left-1&&x.right<=geometry.right+1),JSON.stringify(geometry));
        console.log("PAP2408_NATIVE_DSA_GEOMETRY",width,JSON.stringify(geometry));
      }
    }
    assert.deepEqual(errors,[]);
    assert.deepEqual(unexpected,[]);
    console.log(native?"PAP2408_NATIVE_SYNTHETIC":"PAP2373_SYNTHETIC",mode,"PASS",JSON.stringify({reads,posts}));
   }finally{await context.close();}
  }
 }finally{await browser.close();}
});
