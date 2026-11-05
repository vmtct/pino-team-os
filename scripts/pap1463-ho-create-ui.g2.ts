import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {createServer} from "node:http";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {chromium} from "@playwright/test";

// G2 only: isolated component with explicit transport fault fixtures. This is
// neither authoritative Core data nor G3 prototype/G4 authenticated acceptance.
test("PAP-1463 actual controlled drawer preserves unknown draft, focus and identical retry",async()=>{
 const bundle=await build({bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",alias:{"@":process.cwd()},stdin:{
  resolveDir:process.cwd(),loader:"tsx",contents:`
   import React,{useState} from "react";
   import {createRoot} from "react-dom/client";
   import {HoShiftTemplateEditor} from "./app/ho/workforce/shift-templates/HoShiftTemplateEditor";
   function Harness(){const [open,setOpen]=useState(false),[saved,setSaved]=useState(0),[center,setCenter]=useState("ALL");
    return <><p>G2 isolated transport fault test</p><button onClick={()=>setOpen(true)}>Open QA</button>
      <button onClick={()=>setCenter("018e6b98-fcc3-7ef2-a1e1-63fbadc82130")}>Change list scope</button>
      <output aria-label="saved">{saved}</output><HoShiftTemplateEditor mode="create" centerId={center} authorized
      centers={[{id:"018e6b98-fcc3-7ef2-a1e1-63fbadc82130",name:"QA Center"}]} createOpen={open} onCreateClose={()=>setOpen(false)} onSaved={()=>setSaved(n=>n+1)}/></>;
   }createRoot(document.getElementById("root")!).render(<Harness/>);`,
 }});
 const css=readFileSync(resolve("node_modules/@pino/design-system/dist/0.3.0/components.css"),"utf8");
 const server=createServer((req,res)=>{
  if(req.url==="/bundle.js"){res.setHeader("content-type","text/javascript");res.end(bundle.outputFiles[0]!.text);}
  else if(req.url==="/ds.css"){res.setHeader("content-type","text/css");res.end(css);}
  else res.end('<!doctype html><link rel="stylesheet" href="/ds.css"><div id="root"></div><script src="/bundle.js"></script>');
 });
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
 const address=server.address();assert.ok(address&&typeof address!=="string");
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  let read:"absent"|"unavailable"|"committed"="unavailable";
  let definite=false;
  let releasePost! :()=>void;
  let posts=0;const requests:Array<{key:string;body:string|null}>=[];
  const payload={scopeType:"GLOBAL",centerId:null,displayLabel:"G2 QA",code:"G2-QA",startLocalTime:"13:00",endLocalTime:"17:00",status:"ACTIVE"};
  const row={...payload,id:"018e6b98-fcc3-7ef2-a1e1-63fbadc82132",createdAt:"2026-11-04T00:00:00.000Z",updatedAt:"2026-11-04T00:00:00.000Z"};
  await page.route("**/api/ho/workforce/shift-templates**",async route=>{
   const req=route.request();
   if(req.method()==="POST"){
    posts++;requests.push({key:req.headers()["idempotency-key"]!,body:req.postData()});
    if(posts===1)await new Promise<void>(resolve=>{releasePost=resolve;});
    await route.fulfill(definite?{status:400,json:{error:{code:"PLATFORM_INVALID_INPUT"}}}:{status:503,json:{error:{code:"HO_SHIFT_TEMPLATE_UNAVAILABLE"}}});
   }else{
    assert.match(req.url(),/centerId=GLOBAL$/);
    await route.fulfill(read==="unavailable"?{status:403,json:{error:{code:"ACCESS_PERMISSION_DENIED"}}}:{status:200,json:{data:read==="absent"?[]:[row]}});
   }
  });
  await page.goto(`http://127.0.0.1:${address.port}`);
  const open=page.getByRole("button",{name:"Open QA"});
  const recovery=page.getByRole("button",{name:"Kiểm tra từ Core"});
  await open.click();
  await page.getByLabel("Tên mẫu ca",{exact:true}).fill(payload.displayLabel);
  await page.getByLabel("Mã mẫu ca",{exact:true}).fill(payload.code);
  await page.getByLabel("Bắt đầu",{exact:true}).fill(payload.startLocalTime);
  await page.getByLabel("Kết thúc",{exact:true}).fill(payload.endLocalTime);
  await page.getByRole("button",{name:"Tạo",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('form[aria-busy="true"]'));
  assert.equal(await page.getByRole("button",{name:"Hủy",exact:true}).isDisabled(),true);
  await page.keyboard.press("Escape");assert.equal(await page.getByRole("dialog").isVisible(),true);
  assert.equal(await page.getByLabel("Mã mẫu ca",{exact:true}).isDisabled(),true);
  releasePost();await page.getByRole("alert").waitFor();
  await page.keyboard.press("Escape");await page.getByRole("dialog").waitFor({state:"hidden"});
  assert.equal(await open.evaluate(el=>el===document.activeElement),true);
  await page.getByRole("button",{name:"Change list scope"}).click();
  await open.click();assert.equal(await page.getByLabel("Mã mẫu ca",{exact:true}).inputValue(),payload.code);
  assert.equal(await page.getByRole("button",{name:"Tạo",exact:true}).isDisabled(),true);
  assert.equal(await page.getByLabel("Phạm vi / Center").inputValue(),"GLOBAL");
  await recovery.waitFor();
  await page.waitForFunction(()=>document.activeElement?.textContent==="Kiểm tra từ Core");
  await recovery.click();await page.getByRole("status").filter({hasText:"GET 403"}).waitFor();
  assert.equal(posts,1);
  read="absent";await recovery.click();
  const retry=page.getByRole("button",{name:"Thử lại cùng yêu cầu"});await retry.waitFor();
  assert.equal(await page.getByLabel("Mã mẫu ca",{exact:true}).isDisabled(),true);
  await retry.click();await recovery.waitFor();assert.equal(posts,2);assert.deepEqual(requests[0],requests[1]);
  read="committed";await recovery.click();await page.getByRole("dialog").waitFor({state:"hidden"});
  assert.equal(await page.getByLabel("saved").innerText(),"1");assert.equal(posts,2);
  await open.click();assert.equal(await page.getByLabel("Mã mẫu ca",{exact:true}).inputValue(),"");
  // Once verified and reset, the next clean Create adopts the current selected Center.
  assert.equal(await page.getByLabel("Phạm vi / Center").inputValue(),"018e6b98-fcc3-7ef2-a1e1-63fbadc82130");
  definite=true;
  await page.getByLabel("Tên mẫu ca",{exact:true}).fill(payload.displayLabel);
  await page.getByLabel("Mã mẫu ca",{exact:true}).fill(payload.code);
  await page.getByLabel("Bắt đầu",{exact:true}).fill(payload.startLocalTime);
  await page.getByLabel("Kết thúc",{exact:true}).fill(payload.endLocalTime);
  await page.getByRole("button",{name:"Tạo",exact:true}).click();
  await page.getByRole("alert").filter({hasText:"Core từ chối"}).waitFor();
  assert.equal(await page.getByLabel("Mã mẫu ca",{exact:true}).isDisabled(),false);
  await page.keyboard.press("Escape");await open.click();
  assert.equal(await page.getByRole("button",{name:"Tạo",exact:true}).isDisabled(),false);
  assert.equal(posts,3);
  await page.close();
 }finally{await browser.close();await new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}
});