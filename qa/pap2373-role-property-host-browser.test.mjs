import {test} from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {chromium,expect} from "@playwright/test";

test("PAP-2373 isolated native typed Table/Drawer editor host",async()=>{
 const id="01a17d3f-8697-7080-bdf1-33e939758059",version="2026-11-25T04:00:00.000Z";
 const built=await build({stdin:{contents:
  'import React,{useState} from "react";import {createRoot} from "react-dom/client";'+
  'import {roleDefinition} from "./app/ho/system/roles/schema";'+
  'import {RoleMetadataPropertyHost,roleHostSelection} from "./app/components/workspace-renderer/RoleMetadataPropertyHost";'+
  'import {ROLE_METADATA_COMMAND} from "./lib/workspace-adapters/ho-inline-command-contract";'+
  'const mode=new URLSearchParams(location.search).get("mode");const host=mode==="drawer"?"drawer":"table";const field=host==="drawer"?"description":"name";'+
  'const id="'+id+'",version="'+version+'";const row={id,roleKey:"custom-example",roleType:mode==="protected"?"system":"custom",status:"active",updatedAt:version,name:"Original",description:"Original description",permissionCount:1};'+
  'const context={surface:"HO",authorize:p=>p==="access.role.view"||(p==="access.role.edit"&&mode!=="denied")};'+
  'const binding={command:ROLE_METADATA_COMMAND,commit:async(request,signal)=>{document.body.dataset.request=JSON.stringify(request);document.body.dataset.calls=String(Number(document.body.dataset.calls||0)+1);await new Promise(r=>setTimeout(r,70));if(signal.aborted)return {status:"uncertain"};if(mode==="conflict")return {status:"conflict"};if(mode==="uncertain")return {status:"uncertain"};return {status:"saved",receipt:{id:mode==="wrong"?"wrong":id,roleKey:row.roleKey,roleType:"custom",status:"active",displayName:request.patch.name??row.name,description:request.patch.description??row.description,updatedAt:"2026-11-25T04:00:01.000Z",permissionKeys:["access.role.view"],permissionCount:1}}}};'+
  'const input={host,schema:roleDefinition,context,row,version,field,binding};function App(){const [anchor,setAnchor]=useState(null);return <><button id="anchor" disabled={!roleHostSelection(input)} onClick={e=>setAnchor(e.currentTarget)}>{row[field]}</button>{anchor&&<RoleMetadataPropertyHost {...input} anchor={anchor} onClose={()=>setAnchor(null)} onSaved={()=>{document.body.dataset.saved="1"}}/>}</>};createRoot(document.querySelector("main")).render(<App/>);',
  resolveDir:process.cwd(),loader:"tsx"},jsx:"automatic",bundle:true,write:false,outdir:"out",loader:{".css":"empty"},define:{"process.env":"{}","process.env.NODE_ENV":'"production"'}});
 const js=built.outputFiles.find(f=>f.path.endsWith(".js")).text;
 const browser=await chromium.launch();
 try{
  for(const mode of ["table","drawer","protected","denied","conflict","uncertain","wrong","cancel"]){
   const context=await browser.newContext({viewport:{width:mode==="drawer"?390:1440,height:900},serviceWorkers:"block"});
   try{
    const page=await context.newPage(),errors=[],unexpected=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.route("**/*",route=>{const req=route.request();if(req.url().startsWith("https://fixture.invalid/host?")&&req.method()==="GET")return route.fulfill({contentType:"text/html",body:"<main></main>"});unexpected.push(req.url());return route.abort();});
    await page.goto("https://fixture.invalid/host?mode="+mode);
    await page.addScriptTag({content:js});
    const anchor=page.locator("#anchor"),editor=page.locator(".pds-property-editor");
    await expect(anchor).toBeVisible();
    if(mode==="protected"||mode==="denied"){await expect(anchor).toBeDisabled();await expect(editor).toHaveCount(0);}
    else{
     await anchor.click();await expect(editor).toBeVisible();
     if(mode==="cancel"){await editor.locator("input").press("Escape");await expect(editor).toHaveCount(0);}
     else{
      const field=mode==="drawer"?"description":"name";
      await editor.locator(field==="description"?"textarea":"input").fill("Updated");
      await editor.locator('button[type="submit"]').click();
      await expect(page.locator("body")).toHaveAttribute("data-calls","1");
      assert.deepEqual(JSON.parse(await page.locator("body").getAttribute("data-request")),{id,expectedVersion:version,patch:{[field]:"Updated"}});
      if(mode==="table"||mode==="drawer"){
       await expect(page.locator("body")).toHaveAttribute("data-saved","1");await expect(editor).toHaveCount(0);
      }else{
       await expect(editor.locator("input")).toBeDisabled();
       await expect(page.locator("body")).not.toHaveAttribute("data-saved","1");
      }
     }
    }
    assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
    console.log("PAP2373_ROLE_HOST",mode,"PASS");
   }finally{await context.close();}
  }
 }finally{await browser.close();}
});
