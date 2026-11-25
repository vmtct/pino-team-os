import {test,expect,type Page} from "@playwright/test";
import {buildSync} from "esbuild";
const bundle=buildSync({outfile:"fixture.js",entryPoints:["e2e/fixtures/pap2371-learning-space.tsx"],bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",loader:{".css":"empty"},banner:{js:"var process = { env: { NODE_ENV: 'production' } };"},define:{"process.env.NODE_ENV":'"production"'},logLevel:"silent"}).outputFiles[0].text;
test.use({launchOptions:process.platform==="win32"?{executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"}:{}});
const origin="https://learning-space-test.invalid",root="/api/ho/learning-spaces",center="019a0000-0000-7000-8000-000000000001",id="019a0000-0000-7000-8000-000000000002",created="019a0000-0000-7000-8000-000000000003";
const seed={id,centerId:center,centerName:"Test Center",code:"studio",displayName:"Test Studio",optimalConcurrentCapacity:8,hardConcurrentCapacity:12,status:"ACTIVE",version:1,createdAt:"2026-11-25T00:00:00Z",updatedAt:"2026-11-25T00:00:00Z",createdBy:null,updatedBy:null,activeClassCount:0,referenceCount:0};
type Row=typeof seed;
async function fixture(page:Page,options:{uncertain?:boolean;referenced?:boolean;query?:string}={}){
 const records=new Map<string,Row>([[id,{...seed,referenceCount:options.referenced?1:0}]]);
 const writes:{method:string;key:string|null;body:Record<string,unknown>}[]=[],errors:string[]=[];
 page.on("pageerror",e=>{errors.push(e.message);console.error("PAP2371 browser error:",e.message);});
 await page.route("**/*",async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
  const reply=(data:unknown,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify({data})});
  if(url.origin!==origin)return route.abort();
  if(req.isNavigationRequest())return route.fulfill({contentType:"text/html",body:'<!doctype html><html lang="vi"><body><div id="root"></div><script>'+bundle+'</script></body></html>'});
  if(path==="/api/bo/centers"&&method==="GET")return reply([{id:center,key:"test",displayName:"Test Center",timeZone:"Asia/Ho_Chi_Minh",status:"active"}]);
  if(path!==root&&!path.startsWith(root+"/"))return route.abort();
  const target=path.slice(root.length+1).split("/")[0],row=records.get(target);
  if(method==="GET"){
   if(path===root)return reply({items:[...records.values()],nextAfter:null});
   if(path.endsWith("/history")||path.endsWith("/classes"))return reply({items:[],nextAfter:null});
   return row?reply(row):reply(null,404);
  }
  const b=req.postDataJSON() as Record<string,unknown>,key=req.headers()["idempotency-key"]??null;
  writes.push({method,key,body:b});
  if(method==="POST"){
   if(options.uncertain&&writes.length===1)return reply(null,503);
   const next={...seed,...b,id:created,version:1} as Row;records.set(created,next);return reply(next,201);
  }
  if(!row||b.expectedVersion!==row.version)return reply(null,409);
  if(method==="PATCH"){const next={...row,...b,version:row.version+1} as Row;records.set(target,next);return reply(next);}
  if(method==="DELETE"){if(row.referenceCount)return reply(null,409);records.delete(target);return reply({id:target,deleted:true});}
  return route.abort();
 });
 await page.goto(origin+"/ho/learning-spaces"+(options.query??""));
 return {records,writes,errors};
}
const createButton=(page:Page)=>page.getByRole("button",{name:/Tạo không gian học/});
async function fillCreate(page:Page){await createButton(page).first().click();await page.locator("#space-create-name").fill("Created Studio");await page.locator("#space-create-code").fill("created");await page.locator("#space-create-center").selectOption(center);await page.locator("#space-create-optimalCapacity").fill("8");await page.locator("#space-create-hardCapacity").fill("12");}
test("PAP-2371 mounted native create uses canonical Center and confirmed list readback",async({page})=>{
 const f=await fixture(page);await expect(page.getByRole("row",{name:"Mở Quick View Test Studio"})).toBeVisible();await fillCreate(page);await createButton(page).last().click();await expect(page.getByRole("row",{name:"Mở Quick View Created Studio"})).toBeVisible();expect(f.writes).toHaveLength(1);expect(f.writes[0]?.body.centerId).toBe(center);expect(f.writes[0]?.key).toBeTruthy();expect(f.errors).toEqual([]);
});
test("PAP-2371 uncertain create fences new commands and retries same body and key",async({page})=>{
 const f=await fixture(page,{uncertain:true});await fillCreate(page);await createButton(page).last().click();await expect(page.getByRole("button",{name:"Kiểm tra lại cùng lệnh"})).toBeVisible();await expect(createButton(page).last()).toBeDisabled();expect(f.writes).toHaveLength(1);await page.getByRole("button",{name:"Kiểm tra lại cùng lệnh"}).click();await expect(page.getByRole("row",{name:"Mở Quick View Created Studio"})).toBeVisible();expect(f.writes).toHaveLength(2);expect(f.writes[0]).toEqual(f.writes[1]);expect(f.errors).toEqual([]);
});
test("PAP-2371 mounted native detail clears capacity and deletes only unused record",async({page})=>{
 const f=await fixture(page,{query:"?record="+id});await expect(page.getByRole("tab",{name:"Tổng quan"})).toBeVisible();await page.getByRole("button",{name:"Bỏ giới hạn tối đa",exact:true}).click();await expect.poll(()=>f.records.get(id)?.hardConcurrentCapacity).toBe(null);await expect(page.getByRole("button",{name:"Xóa không gian học",exact:true})).toBeEnabled();await page.getByRole("button",{name:"Xóa không gian học",exact:true}).click();await page.getByRole("button",{name:"Xác nhận xóa",exact:true}).click();await expect.poll(()=>f.records.has(id)).toBe(false);await expect(page.getByRole("row",{name:"Mở Quick View Test Studio"})).toHaveCount(0);expect(f.writes.map(w=>[w.method,w.body.expectedVersion])).toEqual([["PATCH",1],["DELETE",2]]);expect(f.errors).toEqual([]);
});
test("PAP-2371 referenced delete stays disabled and denied read never renders records",async({page})=>{
 const f=await fixture(page,{referenced:true,query:"?record="+id});await expect(page.getByRole("button",{name:"Xóa không gian học",exact:true})).toBeDisabled();expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);
});
test("PAP-2371 read-only mode exposes no create or lifecycle write",async({page})=>{
 const f=await fixture(page,{query:"?readonly=1&record="+id});await expect(page.getByRole("tab",{name:"Tổng quan"})).toBeVisible();await expect(createButton(page)).toHaveCount(0);await expect(page.getByRole("button",{name:"Xóa không gian học",exact:true})).toHaveCount(0);expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);
});
