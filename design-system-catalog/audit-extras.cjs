const {chromium}=require("playwright"),fs=require("fs"),crypto=require("crypto"),path=require("path");
(async()=>{
const home="https://ds.staging.pinohouse.art",root=path.join(__dirname,"dist");
const files=["index.html","main.js","catalog.css","authority/styles.css","authority/playground.css","authority/playground-v22.css","authority/playground-v23.css","authority/full-detail-v24.css","authority/full-detail-v25.css"];
const integrity=[];for(const file of files){const response=await fetch(home+"/"+(file==="index.html"?"":file)),actual=Buffer.from(await response.arrayBuffer()),expected=fs.readFileSync(path.join(root,file));integrity.push({file,status:response.status,exact:actual.equals(expected),bytes:actual.length});}
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--no-sandbox"]});
const checks=[];
for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(home,{waitUntil:"networkidle",timeout:20000});
 await page.locator(".ds-toggle").click();
 await page.locator(".ds-guide select").selectOption("classes");
 await page.locator(".page-heading h1").filter({hasText:"Running Classes"}).waitFor();
 const rows=await page.locator(".grid-card tbody tr").count();
 await page.locator(".ds-toggle").click();
 await page.locator("#settings-btn").click();
 const settings=await page.locator("#settings-panel").isVisible();
 await page.locator("[data-settings=properties]").click();
 const properties=await page.locator(".property-item").count();
 await page.locator("#settings-close").click();
 checks.push({width,rows,settings,properties,errors});await page.close();
}
await browser.close();
const result={integrity,checks};
fs.writeFileSync(path.join(root,"audit-extras.json"),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
