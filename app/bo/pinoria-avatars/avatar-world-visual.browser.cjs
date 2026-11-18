/** PAP-2153 isolated browser, all requests intercepted, no live data. */
const {build}=require("esbuild"),{chromium}=require("playwright"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict");
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),"pap2153-world-"));let browser;try{
 await build({entryPoints:[path.join(__dirname,"avatar-world-visual.fixture.tsx")],bundle:true,jsx:"automatic",platform:"browser",outdir:dir,entryNames:"fixture",loader:{".css":"local-css"},define:{"process.env.NODE_ENV":'"production"',"process.env.__NEXT_IMAGE_OPTS":'{"deviceSizes":[640,750,828,1080,1200,1920],"imageSizes":[16,32,48,64,96,128,256,384],"path":"/_next/image","loader":"default","dangerouslyAllowSVG":false,"unoptimized":true}'}});
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[],unexpected=[];
 const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement("canvas");c.width=32;c.height=32;const x=c.getContext("2d");x.fillStyle="#ff4040";x.fillRect(8,8,16,16);return c.toDataURL().split(",")[1]}),"base64");
 const gif=Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7","base64");
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",async r=>{const u=new URL(r.request().url());requests.push(u.href);
 if(u.origin==="https://fixture.invalid"&&u.pathname==="/")return r.fulfill({contentType:"text/html",body:'<main id="root"></main>'});
 if(u.origin==="https://fixture.invalid"&&/^\/api\/bo\/pinoria\/selfs\/01a194f0-9bd0-7896-89a0-000000000001\/set\/media\/[0-2]$/.test(u.pathname)&&u.search==="?centerId=01a194f0-9bd0-7896-89a0-000000000002")return r.fulfill({contentType:"image/png",body:png});
 if(u.origin==="https://assets.pinohouse.art"&&u.pathname==="/pinoria/char-base.png")return r.fulfill({contentType:"image/png",body:png,headers:{"access-control-allow-origin":"*"}});
 if(u.origin==="https://assets.pinohouse.art"&&u.pathname==="/pinoria/world/uploads/"+"a".repeat(64)+".gif")return r.fulfill({contentType:"image/gif",body:gif});
 if(u.origin==="https://assets.pinohouse.art"&&u.pathname==="/pinoria/world/uploads/"+"c".repeat(64)+".png")return r.fulfill({contentType:"image/png",body:png});
 unexpected.push(u.href);return r.abort();});
 await page.goto("https://fixture.invalid/");await page.addStyleTag({path:path.join(dir,"fixture.css")});await page.addScriptTag({path:path.join(dir,"fixture.js")});
 await page.locator("#valid canvas").waitFor();await page.waitForFunction(()=>[...document.querySelectorAll("#valid img")].every(i=>i.complete&&i.naturalWidth>0));await page.waitForFunction(()=>performance.getEntriesByType("resource").filter(x=>x.name.includes("/set/media/")).length===3);
 assert.equal(await page.locator("#foreign canvas").count(),0);assert.match(await page.locator("#foreign").innerText(),/Cảnh chưa khả dụng/);
 assert.equal(await page.locator("#valid [data-world-avatar-composite]").count(),0);
 assert.equal(await page.locator('#valid [data-layer-id="01a194f0-9bd0-7896-89a0-00000000000d"]').count(),0);
 assert.deepEqual(await page.locator("#valid g[data-layer-kind]").evaluateAll(xs=>xs.map(x=>x.getAttribute("data-layer-kind"))),["MEDIA","CHARACTER"]);
 assert.match(await page.locator('#valid g[data-layer-kind="MEDIA"]').getAttribute("transform"),/rotate\(35\) scale\(1.3\)/);
 for(const width of [390,1440]){await page.setViewportSize({width,height:900});const rect=await page.locator("#valid [data-world-stage]").boundingBox();assert.ok(rect.width>0&&rect.width<=width&&rect.height>0);assert.ok(Math.abs(rect.width/rect.height-16/9)<.03);}
 assert.equal(requests.filter(x=>x.includes("/set/media/")).length,3);assert.equal(requests.filter(x=>x.includes("/loadout/media/")).length,0);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);console.log("PAP2153_WORLD_VISUAL_PASS",JSON.stringify({viewport:[390,1440],activeSetMedia:3,lockedLayerAbsent:true,foreignScopeAbsent:true,rotation:35,errors:0,unexpected:0}));
 }finally{if(browser)await browser.close();fs.rmSync(dir,{recursive:true,force:true});console.log("PAP2153_WORLD_VISUAL_CLEANUP");}})().catch(e=>{console.error(e);process.exitCode=1});
