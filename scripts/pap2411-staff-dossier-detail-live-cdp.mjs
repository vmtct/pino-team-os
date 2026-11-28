/** PAP-2411/PAP-1912: authorized existing global intake fixture, read-only G4. Never run in CI. */
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {chromium} from "@playwright/test";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const tabs=["T\u1ed5ng quan","L\u1ecbch s\u1eed"];
export function validate(env){
 if(env.CI||env.PAP1912_DETAIL_G4!=="1")throw Error("G4_NOT_AUTHORIZED");
 if(!/^[0-9a-f]{40}$/.test(env.PAP1912_SERVED_SHA??"")||!env.PAP1912_DEPLOYMENT_ID?.trim()||!env.PAP2411_QA_RECEIPT?.trim())throw Error("EXACT_SERVING_AND_LEASE_REQUIRED");
 const port=Number(env.PAP2411_QA_PORT);if(![9342,9343,9344].includes(port))throw Error("I3_QA_PORT_REQUIRED");
 const {PAP2411_ACTOR:actor,PAP2411_CENTER:center,PAP2411_RECORD:record,PAP2411_ROW_LABEL:label}=env;
 if(![actor,center,record].every(v=>uuid.test(v??""))||!label?.trim())throw Error("EXACT_EXISTING_FIXTURE_REQUIRED");
 return {port,actor,center,record,label};
}
export async function run(env){
 const {port,actor,center,record,label}=validate(env),writes=[],errors=[];
 const origin="https://bo.staging.pinohouse.art",browser=await chromium.connectOverCDP("http://127.0.0.1:"+port,{timeout:12000});let page;
 try{
  page=await browser.contexts()[0].newPage();page.setDefaultTimeout(15000);
  await page.route("**/*",async route=>{const req=route.request(),url=new URL(req.url());if(!["GET","HEAD","OPTIONS"].includes(req.method())){if(url.pathname!=="/cdn-cgi/rum")writes.push(req.method());return route.abort();}return route.continue();});
  page.on("pageerror",()=>errors.push("PAGE_ERROR"));
  await page.goto(origin+"/bo/workforce/staffs?view=register&centerId="+encodeURIComponent(center),{waitUntil:"domcontentloaded"});
  assert.equal(new URL(page.url()).origin,origin);assert.equal(new URL(page.url()).searchParams.get("centerId"),center);
  const proof=await page.evaluate(async ({actor,center})=>{const c=await fetch("/api/bo/context",{cache:"no-store"});if(!c.ok)return false;const d=(await c.json()).data;if(d?.surface!=="BO"||d.entitled!==true||d.userId!==actor||!d.permissionKeys?.includes("team.bo.access"))return false;const settings=await fetch("/api/bo/workforce/staff-registration-settings",{cache:"no-store"});if(!settings.ok)return false;const rows=await fetch("/api/bo/centers",{cache:"no-store"});if(!rows.ok)return false;const data=(await rows.json()).data;return Array.isArray(data)&&data.some(r=>r.id===center);},{actor,center});assert.equal(proof,true,"EXACT_ACTOR_CENTER_GLOBAL_INTAKE_REQUIRED");
  const root=page.locator("#staff-registration-review"),quick=root.getByRole("button",{name:"Open Quick View for "+record,exact:true});await quick.waitFor();assert.equal(await quick.count(),1);await quick.click();
  const dialog=page.getByRole("dialog");await dialog.waitFor();assert.equal(await dialog.getByText(label,{exact:true}).count()>=1,true);await dialog.getByRole("button",{name:"M\u1edf chi ti\u1ebft",exact:true}).click();
  const detail=root.locator("#detail-screen");await detail.waitFor();assert.equal(await detail.getByText(label,{exact:true}).count()>=1,true);
  const verify=async selected=>{const shape=await detail.evaluate(root=>{const bar=root.querySelector("[role=tablist]"),panel=root.querySelector("[role=tabpanel]"),list=[...(bar?.querySelectorAll("[role=tab]")??[])],active=list.filter(t=>t.getAttribute("aria-selected")==="true");return {names:list.map(t=>t.textContent.trim()),selected:active[0]?.textContent.trim(),linked:active.length===1&&!!panel&&document.getElementById(active[0].getAttribute("aria-controls"))===panel&&panel.getAttribute("aria-labelledby")===active[0].id,hero:!!root.querySelector(".detail-hero"),overflow:document.documentElement.scrollWidth-innerWidth,details:document.querySelectorAll("#detail-screen").length};});assert.deepEqual(shape.names,tabs);assert.equal(shape.selected,selected);assert.ok(shape.linked&&shape.hero&&shape.details===1&&shape.overflow<=1,"DETAIL_GEOMETRY_OR_ARIA");};
  for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:900});await verify(tabs[0]);}
  for(const name of tabs){await detail.getByRole("tab",{name,exact:true}).click();await verify(name);}
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);console.log("STAFF_DOSSIER_DETAIL_G4_READ_ONLY_PASS");
 }finally{if(page)await page.close();await browser.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run(process.env).catch(()=>{console.error("STAFF_DOSSIER_G4_FAILED_OR_NOT_AUTHORIZED");process.exitCode=1;});
