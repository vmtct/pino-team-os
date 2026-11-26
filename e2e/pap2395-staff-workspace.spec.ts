import {test,expect,type Page} from "@playwright/test";
import {buildSync} from "esbuild";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {resolve} from "node:path";
const req=createRequire(resolve("package.json"));
const bundle=buildSync({outfile:"fixture.js",entryPoints:["e2e/fixtures/pap2395-staff-workspace.tsx"],bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",loader:{".css":"empty"},banner:{js:"var process={env:{NODE_ENV:'production'}};"},define:{"process.env.NODE_ENV":'"production"'},logLevel:"silent"}).outputFiles[0].text;
const css=["public/ho-authority-source/ho-scoped.css",req.resolve("@pino/design-system/bo-tokens.css"),req.resolve("@pino/design-system/components.css")].map(p=>readFileSync(p,"utf8")).join("\n");
test.use({serviceWorkers:"block",launchOptions:process.platform==="win32"?{executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"}:{}});
const origin="https://ho.staging.pinohouse.art",root="/api/ho/staff/create",directory="/api/ho/staff/directory";
const id=(n:number)=>"019a0000-0000-7000-8000-"+String(n).padStart(12,"0");
const center=id(1),staff=id(3),person=id(4);
const row={id:staff,displayLabel:"QA New Staff",status:"inactive",roleLabel:null,createdAt:"2026-11-26T00:00:00Z",updatedAt:"2026-11-26T00:00:00Z",createdByUserId:null,updatedByUserId:null};
const detail={...row,mobile:"0900000000",email:"qa@example.invalid",gender:null,birthDate:null,loginEmail:null,centers:[{id:center,label:"QA Center"}]};
async function fixture(page:Page,denied=false){
 const errors:string[]=[],unexpected:string[]=[],writes:unknown[]=[];let created=false;
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",async route=>{
  const r=route.request(),u=new URL(r.url()),p=u.pathname,m=r.method();
  const reply=(data:unknown,status=200)=>route.fulfill({status,json:{data}});
  if(u.origin!==origin){unexpected.push(r.url());return route.abort();}
  if(r.isNavigationRequest()&&p==="/ho/staff")return route.fulfill({contentType:"text/html",body:'<!doctype html><html lang="vi" data-surface="ho" data-bo-ui-authority="v25"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><main id="root" data-surface="ho"></main><script>'+bundle.replaceAll("</script>","<\\/script>")+'</script></body></html>'});
  if(p==="/api/bo/context"&&m==="GET")return reply({surface:"BO",entitled:true,userId:"synthetic-founder",permissionKeys:denied?[]:["team.bo.access"]});
  if(p==="/api/bo/centers"&&m==="GET")return reply([{id:center,displayName:"QA Center",status:"active"}]);
  if(p===directory&&m==="GET")return reply(created?[row]:[]);
  if(p===directory+"/"+staff&&m==="GET")return reply(created?detail:null);
  if(p===root&&m==="POST"){expect(r.headers()["x-pino-expected-staff-principal"]).toBe("synthetic-founder");writes.push(r.postDataJSON());created=true;return reply({staffMemberId:staff,personId:person,membershipId:id(5),centerId:center,initialStaffStatus:"inactive",accessState:"NOT_PROVISIONED"},201);}
  unexpected.push(m+" "+p);return route.abort();
 });
 await page.goto(origin+"/ho/staff");
 return {writes,errors,unexpected};
}
for(const width of [1440,390])test("PAP-2395 actual native adapter Create Table Drawer Full Detail "+width,async({page})=>{
 await page.setViewportSize({width,height:900});const f=await fixture(page);
 await page.getByRole("button",{name:/Tạo nhân sự/}).click();
 await page.locator("#staff-create-name").fill("QA New Staff");
 await page.locator("#staff-create-phone").fill("0900000000");await page.locator("#staff-create-email").fill("qa@example.invalid");
 await page.locator("#staff-create-center").selectOption(center);await expect(page.locator("#staff-create-login")).toBeDisabled();
 await page.locator("#create-save").click();await expect(page.getByRole("dialog",{name:"Tạo nhân sự"})).toHaveCount(0);
 const opener=page.getByRole("row",{name:"Mở Quick View QA New Staff",exact:true});await expect(opener).toBeVisible();await expect(opener).toContainText("Ngưng");await opener.press("Enter");
 await expect(page.locator('[data-tdd-shell="drawer"]')).toContainText("QA Center");await expect(page.locator('[data-tdd-shell="drawer"]')).toContainText("qa@example.invalid");
 await page.getByRole("button",{name:/Full Detail/}).click();await expect(page.locator('[data-tdd-shell="detail"]')).toContainText("QA Center");await expect(page.locator('[data-tdd-shell="detail"]')).toContainText("Ngưng");
 expect(new URL(page.url()).searchParams.get("record")).toBe(staff);
 await page.reload();await expect(page.locator('[data-tdd-shell="detail"],[data-tdd-shell="drawer"]').first()).toContainText("QA Center");
 expect(f.writes).toHaveLength(1);expect(f.writes[0]).not.toHaveProperty("login");expect(f.errors).toEqual([]);expect(f.unexpected).toEqual([]);
});
test("PAP-2395 actual native adapter denies missing permission before directory or command",async({page})=>{
 const f=await fixture(page,true);await expect(page.getByRole("alert")).toBeVisible();await expect(page.getByRole("button",{name:/Tạo nhân sự/})).toHaveCount(0);
 expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);expect(f.unexpected).toEqual([]);
});