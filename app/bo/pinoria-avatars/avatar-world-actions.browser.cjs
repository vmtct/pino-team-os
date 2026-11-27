/** PAP-2153 synthetic browser test; local bundle, no external services. */
const {build}=require("esbuild"),{chromium}=require("playwright"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict");
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"pap2153-fixture-"));let browser;
 try{
  const out=path.join(tmp,"fixture.js");
  await build({entryPoints:[path.join(__dirname,"avatar-world-actions.fixture.tsx")],bundle:true,jsx:"automatic",platform:"browser",outfile:out,define:{"process.env.NODE_ENV":'"production"'}});
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];
  page.on("pageerror",e=>errors.push(e.message));await page.route("**/*",r=>{requests.push(r.request().url());return r.abort();});
  await page.setContent('<main id="root"></main>');await page.addScriptTag({path:out});
  const grant=page.getByRole("button",{name:"Cấp World · World QA",exact:true}),confirm=page.getByRole("button",{name:"Xác nhận",exact:true}),calls=page.getByTestId("calls");
  await grant.click();await page.getByRole("textbox",{name:"Tên World"}).fill("QA Custom");
  await page.getByRole("button",{name:"Refresh fixture"}).click();
  await page.getByRole("alert").waitFor();assert.equal(await confirm.count(),0);assert.equal(await calls.textContent(),"[]");
  await grant.click();await page.getByRole("textbox",{name:"Tên World"}).fill("QA Custom");await confirm.click();
  assert.equal(JSON.parse(await calls.textContent()).length,1);assert.equal(JSON.parse(await calls.textContent())[0].label,"QA Custom");
  await grant.click();await page.getByRole("button",{name:"Hủy",exact:true}).click();assert.equal(await confirm.count(),0);
  await grant.click();await page.getByRole("button",{name:"Toggle busy"}).click();assert.equal(await confirm.isDisabled(),true);await page.getByRole("button",{name:"Toggle busy"}).click();
  await page.getByRole("button",{name:"Toggle permission"}).click();assert.equal(await grant.count(),0);assert.equal(await confirm.count(),0);
  await page.getByRole("button",{name:"Toggle permission"}).click();assert.equal(await confirm.count(),0);await page.getByRole("alert").waitFor();await grant.click();
  await page.getByRole("button",{name:"Toggle Center"}).click();assert.equal(await grant.count(),0);await page.getByRole("button",{name:"Toggle Center"}).click();assert.equal(await confirm.count(),0);
  assert.equal(JSON.parse(await calls.textContent()).length,1);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log("PAP2153_SYNTHETIC_ACTION_BROWSER_PASS",JSON.stringify({versionDrift:true,customLabel:true,cancel:true,busy:true,permission:true,permissionRestoreRequiresNewChoice:true,center:true,callbacks:1,requests:0,errors:0}));
 }finally{if(browser)await browser.close();fs.rmSync(tmp,{recursive:true,force:true});console.log("PAP2153_SYNTHETIC_CLEANUP");}
})().catch(e=>{console.error(e);process.exitCode=1});
