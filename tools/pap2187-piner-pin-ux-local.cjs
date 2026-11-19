/* PAP-2187: local-only browser UX of real components, mock API, never live authentication. */
const assert = require("node:assert/strict");
const http = require("node:http");
const esbuild = require("esbuild");
const { chromium } = require("playwright");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

(async () => {
  const root = process.cwd();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pap2187-pin-"));
  let server, browser;
  const receipts = [];
  try {
    await esbuild.build({
      stdin: {
        contents: [
          'import React from "react";',
          'import { createRoot } from "react-dom/client";',
          'import Form from "./app/piner-space/afterschool/login/AfterschoolPinForm";',
          'import { PinerAuthShell } from "./app/piner-space/afterschool/login/PinerAuthShell";',
          'createRoot(document.getElementById("root")).render(<PinerAuthShell><Form /></PinerAuthShell>);'
        ].join("\n"), resolveDir: root, loader: "tsx"
      },
      bundle: true, jsx: "automatic", outdir: temp, entryNames: "ui", external: ["/piner_mobile_shell_background.png"],
      loader: { ".module.css": "local-css" }, write: true
    });
    let authenticated = false, restricted = false, failLogout = true;
    const calls = [];
    const mockCsrf = "A".repeat(22);
    const session = (authState) => ({ authState, expiresAt: "2027-01-01T00:00:00.000Z", csrfToken: mockCsrf });
    server = http.createServer((req, res) => {
      const endpoint = req.url;
      if (endpoint === "/") { res.setHeader("Content-Type","text/html; charset=utf-8"); return res.end('<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/ui.css"><div id="root"></div><script src="/ui.js"></script>'); }
      if (endpoint === "/ui.js" || endpoint === "/ui.css") { res.setHeader("Content-Type", endpoint.endsWith(".js") ? "text/javascript" : "text/css"); return res.end(fs.readFileSync(path.join(temp, endpoint.slice(1)))); }
      const answer = (status,data) => { res.statusCode=status; res.setHeader("Content-Type","application/json"); res.end(data === undefined ? "" : JSON.stringify({data})); };
      if (!endpoint.startsWith("/api/piner/afterschool/")) {res.statusCode=404;return res.end();}
      calls.push({ endpoint, method:req.method, csrf:req.headers["x-pino-csrf"] === mockCsrf });
      req.resume();
      req.on("end", () => {
        if (endpoint.endsWith("/session")) return authenticated ? answer(200,{authenticated:true,...session("AUTHENTICATED")}) : answer(401);
        if (endpoint.endsWith("/pin/login")) { restricted=true;return answer(200,session("PIN_CHANGE_REQUIRED")); }
        if (endpoint.endsWith("/pin/change") && restricted && req.headers["x-pino-csrf"]===mockCsrf) { restricted=false;authenticated=true;return answer(200,session("AUTHENTICATED")); }
        if (endpoint.endsWith("/students") && authenticated) return answer(200,[{id:"fixture-student",displayName:"QA local learner",centers:[{id:"fixture-center",displayName:"QA local center"}]}]);
        if (endpoint.endsWith("/logout") && req.method==="POST" && req.headers["x-pino-csrf"]===mockCsrf) {
          if(failLogout){ failLogout=false;return answer(503); }
          authenticated=false;return answer(204);
        }
        return answer(401);
      });
    });
    await new Promise(r=>server.listen(0,"127.0.0.1",r));
    const url="http://127.0.0.1:"+server.address().port;
    browser=await chromium.launch({channel:"chrome",headless:true});
    for (const width of [320,390,768,1024,1440,1920]) {
      const page=await browser.newPage({viewport:{width,height:850}});
      await page.route("**/*",route=>route.request().url().startsWith(url+"/") ? route.continue() : route.abort());
      const errors=[];page.on("pageerror",e=>errors.push(e.message));
      try {
        authenticated=false;restricted=false;failLogout=true;calls.length=0;
        await page.goto(url);
        const phone=page.getByRole("textbox",{name:"Số điện thoại"});
        await phone.waitFor();
        assert.equal(await page.locator('input[name=pin]').count(),0);
        await phone.fill("0900000000");
        await page.getByRole("button",{name:"Tiếp tục",exact:true}).click();
        const pin=page.locator('input[name=pin]');
        await pin.waitFor();
        assert.equal(await phone.count(),0);
        assert.equal(await page.locator('[data-filled=false]').count(),6);
        assert.equal(await pin.evaluate(el=>document.activeElement===el),true);
        assert.equal(await pin.getAttribute("type"),"password");
        assert.equal(await pin.getAttribute("inputmode"),"numeric");
        const geometry=await page.locator('[data-filled]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,right:r.right};}));
        assert.equal(geometry.length,6);
        for(let i=0;i<geometry.length;i++){assert.ok(geometry[i].w>=30);assert.ok(geometry[i].x>=0&&geometry[i].right<=width+1);if(i)assert.ok(geometry[i].x>geometry[i-1].right&&Math.abs(geometry[i].y-geometry[0].y)<1);}
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
        await pin.pressSequentially("000000");
        assert.equal(await page.locator('[data-filled=true]').count(),6);
        await pin.press("Backspace");
        assert.equal(await page.locator('[data-filled=true]').count(),5);
        await pin.evaluate(el=>{const dt=new DataTransfer();dt.setData("text","000 000");el.dispatchEvent(new ClipboardEvent("paste",{bubbles:true,cancelable:true,clipboardData:dt}));});
        assert.equal(await page.locator('[data-filled=true]').count(),6);
        await page.getByRole("button",{name:"Đổi số điện thoại"}).click();
        await phone.waitFor();
        assert.equal(await phone.inputValue(),"0900000000");
        await page.getByRole("button",{name:"Tiếp tục",exact:true}).click();
        assert.equal(await page.locator('[data-filled=false]').count(),6);
        assert.equal(calls.filter(c=>c.method==="POST").length,0);
        if(width===390){
          await pin.fill("000000");
          await page.getByRole("button",{name:"Đăng nhập",exact:true}).click();
          await page.getByRole("heading",{name:"Tạo PIN mới"}).waitFor();
          assert.equal(await page.locator('[data-filled=false]').count(),12);
          await pin.fill("111111");
          await page.locator('input[name=confirm]').fill("222222");
          await page.getByRole("button",{name:"Lưu PIN mới"}).click();
          await page.getByRole("alert").filter({hasText:"chưa khớp"}).waitFor();
          await page.locator('input[name=confirm]').fill("111111");
          await page.getByRole("button",{name:"Lưu PIN mới"}).click();
          await page.getByText("QA local learner").waitFor({state:"attached"});
          await page.getByRole("button",{name:"Đăng xuất",exact:true}).click();
          await page.getByRole("alert").filter({hasText:"Chưa thể đăng xuất"}).waitFor();
          await page.getByRole("button",{name:"Đăng xuất",exact:true}).click();
          await phone.waitFor();
          assert.equal(await phone.inputValue(),"");
          assert.equal(authenticated,false);
          assert.deepEqual(calls.filter(c=>c.endpoint.endsWith("/logout")).map(c=>[c.method,c.csrf]),[["POST",true],["POST",true]]);
          await page.reload(); await phone.waitFor();
          assert.equal(await page.getByRole("heading",{name:"Chọn học viên"}).count(),0);
        }
        assert.deepEqual(errors,[]);
        receipts.push({width,phoneStep:true,pinCells:6,maskFocusPasteBackspace:true,layout:true,fullMockLifecycle:width===390});
      }finally{await page.close();}
    }
    console.log(JSON.stringify({scope:"LOCAL_MOCK_ONLY",receipts}));
  }finally{await browser?.close();if(server)await new Promise(r=>server.close(r));fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
