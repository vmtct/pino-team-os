import {test,expect} from "@playwright/test";
import {build,type Plugin} from "esbuild";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import path from "node:path";
const host="https://pap2004-local-fixture.invalid";
const centerId="01912345-6789-7abc-8def-0123456789ab",roleId="01912345-6789-7abc-8def-0123456789ac";
const row={id:"01912345-6789-7abc-8def-0123456789ad",centerId,displayLabel:"QA Applicant Local Only",submittedAt:"2026-11-15T10:00:00Z",version:1};
const mocks:Plugin={name:"local-navigation-only",setup(b){
 b.onResolve({filter:/^next\/navigation$/},()=>({path:"nav",namespace:"local"}));
 b.onResolve({filter:/^next\/link$/},()=>({path:"link",namespace:"local"}));
 b.onLoad({filter:/.*/,namespace:"local"},args=>({loader:"jsx",resolveDir:process.cwd(),contents:args.path==="nav"?`export const useSearchParams=()=>new URLSearchParams(location.search);export const usePathname=()=>location.pathname;export const useRouter=()=>({push(){},replace(){},refresh(){},prefetch(){}});`:`import React from "react";export default function Link(p){return <a {...p}/>}`}));
}};
test.use({launchOptions:process.platform==="win32"?{executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"}:{}});
let html:string;
test.beforeAll(async()=>{
 const bundle=await build({stdin:{contents:`import React from "react";import{createRoot}from "react-dom/client";import{BoCenterSelectionProvider}from "./app/bo/components/registration/BoCenterSelection";import{StaffRegistrationSection}from "./app/bo/staff/StaffRegistrationSection";createRoot(document.getElementById("root")).render(<BoCenterSelectionProvider><StaffRegistrationSection/></BoCenterSelectionProvider>);`,resolveDir:process.cwd(),loader:"tsx"},bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",outdir:"fixture",plugins:[mocks],define:{"process.env.NODE_ENV":'"production"'}});
 const css=bundle.outputFiles.filter(f=>f.path.endsWith(".css")).map(f=>f.text).join("\n");
 const ds=readFileSync(createRequire(path.resolve("package.json")).resolve("@pino/design-system/components.css"),"utf8");
 const legacy=readFileSync("app/bo/design-system/foundation.css","utf8");
 html=`<!doctype html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${ds}\n${legacy}\n${css}</style><main id="root"></main><script>${bundle.outputFiles.find(f=>f.path.endsWith(".js"))!.text.replace(/<\/script/gi,"<\\/script")}</script>`;
});
for(const width of [320,390,768,1024,1440,1920])test(`PAP-2004 local actual Manager UI ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:900});
 let pending=true,attempts=0;const keys:string[]=[];const payloads:unknown[]=[];
 await page.route("**/*",async r=>{
  const req=r.request(),url=new URL(req.url());
  if(url.origin!==host)return r.abort();
  if(req.resourceType()==="document")return r.fulfill({contentType:"text/html",body:html});
  const send=(status:number,data:unknown)=>r.fulfill({status,contentType:"application/json",body:JSON.stringify(status===200?{data}:{error:{message:"QA controlled denial"}})});
  if(url.pathname==="/api/bo/centers")return send(200,[{id:centerId,displayName:"QA Center Local"}]);
  if(url.pathname.endsWith("/staff-registration-settings"))return send(403,null);
  if(url.pathname.endsWith("/staff-registration-eligible-roles")){expect(url.searchParams.get("centerId")).toBe(centerId);return send(200,[{id:roleId,displayName:"QA Staff Role"}]);}
  if(url.pathname.endsWith("/staff-registration-requests"))return send(200,pending?[row]:[]);
  if(url.pathname.endsWith("/"+row.id+"/approve")){
   attempts++;keys.push(req.headers()["idempotency-key"]!);payloads.push(req.postDataJSON());expect(url.searchParams.get("centerId")).toBe(centerId);
   if(attempts===1)return send(503,null);
   pending=false;return send(200,{registrationRequestId:row.id,status:"APPROVED"});
  }
  return send(404,null);
 });
 await page.goto(host+"/bo/staff?centerId="+centerId);
 const grid=page.getByRole("region",{name:"Hồ sơ nhân sự chờ duyệt"});
 await expect(grid.getByText(row.displayLabel,{exact:true})).toBeVisible();
 await grid.getByRole("button",{name:"Open Quick View for "+row.id}).click();
 const approve=page.getByRole("button",{name:"Duyệt hồ sơ",exact:true});
 const reject=page.getByRole("button",{name:"Từ chối",exact:true});
 await expect(approve).toBeDisabled();await expect(reject).toBeDisabled();
 await page.getByRole("combobox",{name:"Vai trò Staff"}).selectOption(roleId);
 await expect(approve).toBeEnabled();
 // Dirty close must preserve the current selection until the user accepts discard.
 page.once("dialog",d=>void d.dismiss());
 await page.keyboard.press("Escape");
 await expect(approve).toBeVisible();
 await expect(page.getByRole("combobox",{name:"Vai trò Staff"})).toHaveValue(roleId);
 page.once("dialog",d=>void d.accept());
 await page.keyboard.press("Escape");
 await expect(approve).toHaveCount(0);
 await expect(grid.getByRole("button",{name:"Open Quick View for "+row.id})).toBeFocused();
 await grid.getByRole("button",{name:"Open Quick View for "+row.id}).click();
 await expect(approve).toBeDisabled();
 await page.getByRole("combobox",{name:"Vai trò Staff"}).selectOption(roleId);
 await page.getByRole("textbox",{name:"Lý do từ chối"}).fill("QA reason");
 await expect(reject).toBeEnabled();
 await page.getByRole("textbox",{name:"Lý do từ chối"}).clear();
 await expect(reject).toBeDisabled();
 await page.screenshot({path:info.outputPath("drawer.png"),fullPage:true});
 await approve.evaluate((el:HTMLButtonElement)=>{el.click();el.click()});
 await expect(page.getByText("QA controlled denial").first()).toBeVisible();
 expect(attempts).toBe(1);
 // Closing and reopening the same review after an ambiguous response must not replace its key.
 page.once("dialog",d=>void d.accept());
 await page.getByRole("button",{name:"Đóng",exact:true}).click();
 await grid.getByRole("button",{name:"Open Quick View for "+row.id}).click();
 await page.getByRole("combobox",{name:"Vai trò Staff"}).selectOption(roleId);
 await approve.click();await expect(grid.getByText("Đã duyệt hồ sơ.")).toBeVisible();
 await expect(grid.getByText(row.displayLabel,{exact:true})).toHaveCount(0);
 expect(attempts).toBe(2);expect(keys[0]).toBe(keys[1]);expect(payloads[0]).toEqual(payloads[1]);
 expect(payloads[0]).toEqual({expectedVersion:1,assignments:[{roleId,scopeType:"CENTER",scopeId:centerId}],pinoriaIdentity:{mode:"CREATE_STAFF_ONLY_PERSON"}});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:info.outputPath("result.png"),fullPage:true});
});
