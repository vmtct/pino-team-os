import { expect, test } from "@playwright/test";
import { build, type Plugin } from "esbuild";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const HOST="https://pap410-component.test";
const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const C="33333333-3333-4333-8333-333333333333";
const D="44444444-4444-4444-8444-444444444444";

function summary(id:string,purpose:string,status:"PENDING_APPROVAL"|"APPLYING"|"APPLIED"|"REJECTED"|"OUTCOME_UNKNOWN",index:number){
  const at=new Date(Date.UTC(2026,9,11,10,0,index)).toISOString();
  return {id,status,source:"GPT" as const,purpose,schemaVersion:"v1" as const,planHash:`hash-${id}-${index}`,preview:{operationCount:1,destructiveOperationCount:0,destinationTables:[{table:"terms",creates:1}]},submittedAt:at,updatedAt:at,approvedAt:null,rejectedAt:null,appliedAt:null,version:1};
}
function detail(item:ReturnType<typeof summary>){return {...item,idempotencyKey:`idem-${item.id}`,plan:{schemaVersion:"v1",operations:[{ref:"op-1",resource:"operating_term",op:"create",targetTable:"terms",recordId:item.id,data:{name:item.purpose}}]},validation:{valid:true},approvedByUserId:null,rejectedByUserId:null,rejectionReason:null,applyAttemptId:null,applyStartedAt:null,applyReceipt:null,reconcile:null};}
const core=[summary(A,"Proposal A pending","PENDING_APPROVAL",1),summary(B,"Proposal B applied","APPLIED",2),summary(C,"Proposal C missing detail","PENDING_APPROVAL",3),summary(D,"Proposal D pending mutation","PENDING_APPROVAL",4)];
const list=[...core,...Array.from({length:26},(_,i)=>summary(`50000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,`Filler ${i+1}`,"APPLIED",i+5))];

function resolveSource(specifier:string){
  const base=path.resolve(process.cwd(),specifier.slice(2));
  for(const candidate of [base,`${base}.ts`,`${base}.tsx`,`${base}.js`,path.join(base,"index.ts"),path.join(base,"index.tsx"),path.join(base,"index.js") ])if(existsSync(candidate)&&statSync(candidate).isFile())return candidate;
  return base;
}

const navMock=`
import {useEffect,useState} from "react";
function useUrl(){const [url,setUrl]=useState(()=>window.location.href);useEffect(()=>{const sync=()=>setUrl(window.location.href);window.addEventListener("popstate",sync);window.addEventListener("pino-nav",sync);return()=>{window.removeEventListener("popstate",sync);window.removeEventListener("pino-nav",sync);};},[]);return url;}
function go(kind,href){window.history[kind+"State"]({},"",href);window.dispatchEvent(new Event("pino-nav"));}
export function usePathname(){useUrl();return window.location.pathname;}
export function useSearchParams(){useUrl();return new URLSearchParams(window.location.search);}
export function useRouter(){useUrl();return {push:(href)=>go("push",href),replace:(href)=>go("replace",href)};}
`;

async function actualComponentBundle(){
  const mockPlugin:Plugin={name:"pap410-component-harness",setup(builder){
    builder.onResolve({filter:/^next\/navigation$/},()=>({path:"next-navigation",namespace:"pap410-nav"}));
    builder.onLoad({filter:/.*/,namespace:"pap410-nav"},()=>({contents:navMock,loader:"js",resolveDir:process.cwd()}));
    builder.onResolve({filter:/^@\//},args=>{const resolved=resolveSource(args.path);return resolved.endsWith(".css")?{path:resolved,namespace:"pap410-css"}:{path:resolved};});
    builder.onResolve({filter:/\.css$/},args=>({path:path.resolve(args.resolveDir,args.path),namespace:"pap410-css"}));
    builder.onLoad({filter:/.*/,namespace:"pap410-css"},()=>({contents:'export default new Proxy({}, {get:(_target,key)=>String(key)});',loader:"js"}));
  }};
  const result=await build({stdin:{contents:`import React from "react";import {createRoot} from "react-dom/client";import {AiDataInboxView} from "./app/bo/system/ai-data/AiDataInboxView";createRoot(document.getElementById("root")).render(React.createElement(AiDataInboxView));`,resolveDir:process.cwd(),loader:"tsx"},bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",plugins:[mockPlugin]});
  return result.outputFiles[0]!.text;
}
function navigateSelection(id:string){return `(function(){const p=new URLSearchParams(location.search);${id?`p.set("changeSet","${id}");`:'p.delete("changeSet");'}history.pushState({},"",location.pathname+"?"+p.toString());dispatchEvent(new Event("pino-nav"));})()`;}

test("PAP-410 actual AiDataInboxView rejects stale detail/mutation responses and preserves valid bookmarked page",async({page})=>{
  const bundle=await actualComponentBundle();
  let approvedD=false;
  await page.route(`${HOST}/**`,async route=>{
    const request=route.request();const url=new URL(request.url());
    if(request.resourceType()==="document")return route.fulfill({status:200,contentType:"text/html",body:`<html><body><div id="root"></div><script>${bundle}</script></body></html>`});
    if(url.pathname==="/api/founder/ai/change-sets"&&request.method()==="GET"){await new Promise(r=>setTimeout(r,180));return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:list})});}
    const match=url.pathname.match(/^\/api\/founder\/ai\/change-sets\/([^/]+)(?:\/(approve|reject|reconcile))?$/);
    if(match){const [,id,action]=match;
      if(id===C&&!action){await new Promise(r=>setTimeout(r,40));return route.fulfill({status:404,contentType:"application/json",body:JSON.stringify({error:{message:"missing"}})});}
      const item=list.find(row=>row.id===id);if(!item)return route.fulfill({status:404,contentType:"application/json",body:JSON.stringify({error:{message:"missing"}})});
      if(action){if(id===D&&action==="approve"){await new Promise(r=>setTimeout(r,260));approvedD=true;return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:{...detail(item),status:"APPLIED"}})});}return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:detail(item)})});}
      await new Promise(r=>setTimeout(r,id===A?500:id===B?35:20));return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:detail(item)})});
    }
    return route.fulfill({status:404,body:"not found"});
  });

  await page.goto(`${HOST}/bo/system/ai-data?page=2&changeSet=${A}`);
  await page.waitForTimeout(70);
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Loading exact proposal…")).toBeVisible();
  await page.waitForTimeout(180);
  await expect(page).toHaveURL(/page=2/);

  await page.evaluate(navigateSelection(B));
  await expect(page.getByRole("heading",{name:"Proposal B applied"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Approve & Apply"})).toHaveCount(0);
  await page.waitForTimeout(520);
  await expect(page.getByRole("heading",{name:"Proposal B applied"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Proposal A pending"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Approve & Apply"})).toHaveCount(0);

  await page.evaluate(navigateSelection(C));
  await expect(page.getByText("Change Set detail is unavailable.")).toBeVisible();
  await expect(page.getByRole("button",{name:"Approve & Apply"})).toHaveCount(0);

  await page.evaluate(navigateSelection(D));
  await expect(page.getByRole("heading",{name:"Proposal D pending mutation"})).toBeVisible();
  page.once("dialog",dialog=>void dialog.accept());
  await page.getByRole("button",{name:"Approve & Apply"}).click();
  await page.waitForTimeout(30);
  await page.evaluate(navigateSelection(B));
  await expect(page.getByRole("heading",{name:"Proposal B applied"})).toBeVisible();
  await page.waitForTimeout(300);
  expect(approvedD).toBe(true);
  await expect(page.getByRole("heading",{name:"Proposal B applied"})).toBeVisible();
  await expect(page.getByText("Applied with Founder authority.")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Approve & Apply"})).toHaveCount(0);
});
