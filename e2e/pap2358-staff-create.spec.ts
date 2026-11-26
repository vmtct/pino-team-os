import {test,expect,type Page} from "@playwright/test";
import {buildSync} from "esbuild";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {resolve} from "node:path";
const packageRequire=createRequire(resolve("package.json"));
const bundle=buildSync({outfile:"fixture.js",entryPoints:["e2e/fixtures/pap2358-staff-create.tsx"],bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",loader:{".css":"empty"},banner:{js:"var process = { env: { NODE_ENV: 'production' } };"},define:{"process.env.NODE_ENV":'"production"'},logLevel:"silent"}).outputFiles[0].text;
const styles=["public/ho-authority-source/ho-scoped.css",packageRequire.resolve("@pino/design-system/bo-tokens.css"),packageRequire.resolve("@pino/design-system/components.css")].map(path=>readFileSync(path,"utf8")).join("\n");
test.use({launchOptions:process.platform==="win32"?{executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"}:{}});
const origin="https://staff-create-test.invalid",center="019a0000-0000-7000-8000-000000000001",person="019a0000-0000-7000-8000-000000000002";
const id=(n:number)=>"019a0000-0000-7000-8000-"+String(n).padStart(12,"0");
const candidate={id:person,displayName:"QA Person",roles:[],avatar:{id:null,status:"SELF_MISSING",selfStatus:null,nickname:null},createdAt:"2026-11-25T00:00:00Z",updatedAt:"2026-11-25T00:00:00Z",createdBy:null,updatedBy:null,version:1};
const linked={...candidate,id:id(8),displayName:"Already Staff",roles:[{kind:"STAFF",id:id(9),displayName:"Already Staff",status:"active"}]};
const root="/api/ho/staff/create";
type Command={name:string;phone:string;email:string;centerId:string;existingPersonId?:string};
async function fixture(page:Page,options:{lost?:boolean;committed?:boolean;missingDetailOnce?:boolean}={}){
 const writes:{key:string;body:Command}[]=[],reads:{key:string;body:unknown}[]=[],errors:string[]=[];
 let receipt:Record<string,unknown>|null=null;let detailReads=0;const directoryReads:string[]=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  const reply=(data:unknown,status=200)=>route.fulfill({status,json:{data}});
  if(url.origin!==origin)return route.abort();
  if(req.isNavigationRequest())return route.fulfill({contentType:"text/html",body:'<!doctype html><html lang="vi" data-surface="ho" data-bo-ui-authority="v25"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+styles+'</style></head><body><main id="root" data-surface="ho"></main><script>'+bundle.replaceAll("</script>","<\\/script>")+'</script></body></html>'});
  if(path==="/api/ho/identity/persons"&&req.method()==="GET")return reply({items:[candidate,linked],nextAfter:null});
  if(path==="/api/ho/identity/persons/"+person&&req.method()==="GET")return reply(candidate);
  if(req.method()==="GET"&&(path==="/api/ho/staff/directory"||path==="/api/ho/staff/directory/"+id(3))){
   directoryReads.push(path);const row={id:id(3),displayLabel:"QA Person",status:"inactive",roleLabel:null,createdAt:"2026-11-25T00:00:00Z",updatedAt:"2026-11-25T00:00:00Z",createdByUserId:null,updatedByUserId:null};
   if(path.endsWith(id(3))){if(options.missingDetailOnce&&++detailReads===1)return reply(null,503);return reply(receipt?{...row,mobile:"0900000000",email:"qa@example.invalid",gender:null,birthDate:null,loginEmail:null,centers:[{id:center,label:"QA Center"}]}:null);}
   return reply(receipt?[row]:[]);
  }
  if(path===root+"/receipt"&&req.method()==="POST"){
   expect(req.headers()["x-pino-expected-staff-principal"]).toBe("qa-principal");
   reads.push({key:req.headers()["idempotency-key"]??"",body:req.postDataJSON()});
   return reply(receipt?{state:"COMMITTED",receipt}:{state:"NOT_OBSERVED"});
  }
  if(path===root&&req.method()==="POST"){
   expect(req.headers()["x-pino-expected-staff-principal"]).toBe("qa-principal");
   const body=req.postDataJSON() as Command,key=req.headers()["idempotency-key"]??"";
   writes.push({key,body});
   if(!options.lost||options.committed||writes.length>1)receipt={staffMemberId:id(3),personId:body.existingPersonId??id(4),membershipId:id(5),centerId:center,initialStaffStatus:"inactive",accessState:"NOT_PROVISIONED"};
   if(options.lost&&writes.length===1)return reply(null,503);
   return reply(receipt,201);
  }
  return route.abort();
 });
 await page.goto(origin+"/ho/staff");
 return {writes,reads,errors,directoryReads};
}
const drawer=(p:Page)=>p.getByRole("dialog",{name:"Tạo nhân sự"});
async function open(p:Page){await p.getByRole("button",{name:"Tạo nhân sự",exact:true}).click();await expect(drawer(p)).toBeVisible();}
async function fill(p:Page){
 await p.locator("#staff-create-name").fill("QA Person");
 await p.locator("#staff-create-phone").fill("0900000000");
 await p.locator("#staff-create-email").fill("qa@example.invalid");
 await p.locator("#staff-create-center").selectOption(center);
}
async function choose(p:Page){
 await p.locator("#staff-create-person-search").fill("QA");
 await p.getByRole("button",{name:"Tìm Person",exact:true}).click();
 await expect(p.getByRole("button",{name:/Chọn Already Staff/})).toHaveCount(0);
 await p.getByRole("button",{name:/Chọn QA Person/}).click();
 await expect(p.getByText("Person đã chọn: QA Person · "+person)).toBeVisible();
}
test("PAP-2358 explicit Person and record-only create",async({page})=>{
 const f=await fixture(page);await open(page);await fill(page);
 await expect(page.locator("#staff-create-login")).toBeDisabled();
 await choose(page);await page.locator("#create-save").click();
 await expect(drawer(page)).toHaveCount(0);
 expect(f.writes).toHaveLength(1);expect(f.writes[0]?.body).toMatchObject({centerId:center,existingPersonId:person});expect(f.writes[0]?.body).not.toHaveProperty("login");expect(f.errors).toEqual([]);
});
test("PAP-2358 disabled provisioning and original committed receipt after reload",async({page})=>{
 const f=await fixture(page,{lost:true,committed:true});await open(page);await fill(page);
 await expect(page.locator("#staff-create-login")).toBeDisabled();await expect(page.locator("#staff-create-login")).not.toBeChecked();
 await expect(page.locator("#staff-create-password")).toHaveCount(0);
 await page.locator("#create-save").click();await expect(page.getByRole("button",{name:"Kiểm tra kết quả"})).toBeVisible();
 await expect(page.locator("#staff-create-password")).toHaveCount(0);await expect(page.locator("#staff-create-center")).toBeDisabled();
 await expect(page.locator("#create-save")).toBeDisabled();
 await page.reload();await page.getByRole("button",{name:"Khôi phục yêu cầu tạo Staff"}).click();
 await expect(page.locator("#create-save")).toBeDisabled();expect(f.writes).toHaveLength(1);
 await page.getByRole("button",{name:"Kiểm tra kết quả"}).click();await expect(drawer(page)).toHaveCount(0);
 expect(f.writes).toHaveLength(1);expect(f.reads).toEqual([{key:f.writes[0]?.key,body:{centerId:center}}]);expect(f.errors).toEqual([]);
});
test("PAP-2358 restored NOT_OBSERVED remains readback-only",async({page})=>{
 const f=await fixture(page,{lost:true});await open(page);await fill(page);await choose(page);
 await page.locator("#create-save").click();await expect(page.getByRole("button",{name:"Kiểm tra kết quả"})).toBeVisible();
 await page.reload();await page.getByRole("button",{name:"Khôi phục yêu cầu tạo Staff"}).click();
 await page.getByRole("button",{name:"Kiểm tra kết quả"}).click();
 await expect(page.locator("#staff-create-center")).toBeDisabled();
 await expect(page.locator("#create-save")).toBeDisabled();
 await expect(page.getByRole("alert")).toContainText("chỉ kiểm tra lại");
 expect(f.writes).toHaveLength(1);expect(f.reads).toEqual([{key:f.writes[0]?.key,body:{centerId:center}}]);expect(f.errors).toEqual([]);
});
test("PAP-2358 same-session NOT_OBSERVED permits same original request only",async({page})=>{
 const f=await fixture(page,{lost:true});await open(page);await fill(page);await choose(page);
 await page.locator("#create-save").click();await page.getByRole("button",{name:"Kiểm tra kết quả"}).click();
 await expect(page.locator("#staff-create-center")).toBeDisabled();await expect(page.locator("#create-save")).toBeEnabled();
 await page.locator("#create-save").click();await expect(drawer(page)).toHaveCount(0);
 expect(f.writes).toHaveLength(2);expect(f.writes[0]).toEqual(f.writes[1]);expect(f.errors).toEqual([]);
});

test("PAP-2395 committed Create with missing Detail can only recheck, no second create",async({page})=>{
 const f=await fixture(page,{missingDetailOnce:true});await open(page);await fill(page);await choose(page);
 await page.locator("#create-save").click();await expect(page.getByRole("alert")).toContainText("Đã ghi nhận tạo Staff");
 await expect(page.locator("#create-save")).toBeDisabled();await expect(page.getByRole("button",{name:"Kiểm tra kết quả"})).toBeVisible();
 await page.getByRole("button",{name:"Kiểm tra kết quả"}).click();await expect(drawer(page)).toHaveCount(0);
 expect(f.writes).toHaveLength(1);expect(f.reads).toEqual([]);expect(f.directoryReads).toEqual(["/api/ho/staff/directory/"+id(3),"/api/ho/staff/directory/"+id(3),"/api/ho/staff/directory"]);expect(f.errors).toEqual([]);
});
