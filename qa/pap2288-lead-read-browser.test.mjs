/** PAP-2288 / PLT-LEAD — mounted native Lead TDD, synthetic read API only. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {chromium} from "@playwright/test";
const a="01a03c6e-cc58-7d81-ac8e-123456789abc",b="01a03c6e-cc58-7d81-ac8e-123456789abd",c="01a03c6e-cc58-7d81-ac8e-123456789abe";
const navigation=`
import {useSyncExternalStore} from "react";
const event="lead-test-nav";
function subscribe(fn){window.addEventListener(event,fn);window.addEventListener("popstate",fn);return()=>{window.removeEventListener(event,fn);window.removeEventListener("popstate",fn)}}
const snapshot=()=>location.search;
export const usePathname=()=>location.pathname;
export function useSearchParams(){return new URLSearchParams(useSyncExternalStore(subscribe,snapshot,snapshot))}
function change(href,replace){const u=new URL(href,location.href);if(u.origin!==location.origin||u.pathname!=="/bo/sales/leads")throw Error("fixture route only");history[replace?"replaceState":"pushState"]({},"",u.pathname+u.search);window.dispatchEvent(new Event(event))}
export const useRouter=()=>({push:href=>change(href,false),replace:href=>change(href,true),back:()=>history.back(),refresh:()=>window.dispatchEvent(new Event(event))});
export const redirect=()=>{throw Error("unexpected redirect")};
`;
const shims={"next/navigation":navigation,"next/link":`import {useRouter} from "next/navigation";export default function Link({href,children,prefetch,...p}){const r=useRouter();return <a {...p} href={href} onClick={e=>{p.onClick?.(e);if(!e.defaultPrevented){e.preventDefault();r.push(href)}}}>{children}</a>}`,"next/image":`export default function Image({alt}){return <span>{alt}</span>}`,"next/dynamic":`export default function dynamic(){return ()=>null}`};
const code=await build({stdin:{contents:`
import {createRoot} from "react-dom/client";
import {LeadHouseholdM1Preview} from "./app/bo/sales/leads/LeadHouseholdM1Preview";
import {LeadApiError} from "./lib/bo-lead-household-client";
const a="${a}",b="${b}",c="${c}";
const rows=[a,b].map((id,i)=>({id,phone:"090000000"+i,contactDisplayName:"Synthetic Lead "+(i+1),status:"ACTIVE",primaryContactMemberId:null,version:1,createdAt:"2026-11-25T00:00:00Z",updatedAt:"2026-11-25T00:01:00Z",createdBy:null,updatedBy:null,centerId:null,memberCount:i+1,intentCount:1}));
const member={id:c,status:"ACTIVE",version:1,displayName:"Synthetic Student",intendedRoles:["STUDENT"],gender:null,birthPrecision:"YEAR",birthYear:2018,birthMonth:null,birthDay:null,reportedAge:null,ageObservedAt:null,interestKinds:["MYTIME_PIANO"]};
const intent={id:c,kind:"GENERAL_INQUIRY",sourceBrand:"PINO_HOUSE",sourceSurface:"STAFF",status:"SUBMITTED",createdAt:"2026-11-25T00:00:00Z",version:1};
const api={
 async search(input){if(input.q==="deny")throw new LeadApiError(403,"DENIED",null);if(input.q==="empty")return {items:[],hasMore:false,nextCursor:null};return input.cursor?{items:[rows[1]],hasMore:false,nextCursor:null}:{items:[rows[0]],hasMore:true,nextCursor:"next"}},
 async detail(id){const row=rows.find(r=>r.id===id);if(!row)throw new LeadApiError(404,"NOT_FOUND",null);return {...row,members:[member],relationships:[],intents:[],intentHistoryHasMore:false}},
 async history(){return {items:[intent],hasMore:false,nextCursor:null}}
};
createRoot(document.querySelector("main")).render(<LeadHouseholdM1Preview readApi={new URLSearchParams(location.search).has("fixture")?undefined:api}/>);
`,resolveDir:process.cwd(),loader:"tsx"},jsx:"automatic",bundle:true,write:false,outdir:"out",loader:{".css":"empty"},define:{"process.env.NODE_ENV":'"production"'},plugins:[{name:"isolated-next-navigation",setup(p){p.onResolve({filter:/^next\/(navigation|link|image|dynamic)$/},args=>({path:args.path,namespace:"lead-test"}));p.onLoad({filter:/.*/,namespace:"lead-test"},args=>({contents:shims[args.path],loader:"jsx",resolveDir:process.cwd()}));}}]});
const js=code.outputFiles.find(f=>f.path.endsWith(".js")).text;
test("PAP-2288 mounted native Lead table, cursor, drawer, detail, history and failure states",async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",r=>r.request().isNavigationRequest()&&new URL(r.request().url()).hostname==="fixture.invalid"?r.fulfill({contentType:"text/html",body:"<main></main>"}):r.abort());
  const open=async(search="")=>{await page.goto("http://fixture.invalid/bo/sales/leads"+search);await page.addScriptTag({content:js});};
  await open();
  await page.getByText("Synthetic Lead 1",{exact:true}).waitFor();
  assert.equal(await page.getByText("DỮ LIỆU MẪU",{exact:true}).count(),0);
  await page.getByRole("button",{name:"Tải thêm",exact:true}).click();
  await page.getByText("Synthetic Lead 2",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Open Quick View for "+a}).click();
  await page.getByText("Synthetic Student",{exact:true}).waitFor();
  await page.getByText("MyTime · Piano",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Mở chi tiết đầy đủ →"}).click();
  await page.getByText("25/11/2026 · 07:00",{exact:true}).first().waitFor();
  await page.getByText("Lịch sử",{exact:true}).click();
  await page.getByText("Tư vấn chung",{exact:true}).waitFor();
  await open("?lead="+c);
  await page.getByText("Không tìm thấy Lead",{exact:true}).waitFor();
  assert.equal(await page.getByText("DỮ LIỆU MẪU",{exact:true}).count(),0);
  await open();
  await page.getByText("Synthetic Lead 1",{exact:true}).waitFor();
  const search=page.getByPlaceholder("Tìm tên, số điện thoại, thành viên, chương trình…");
  await search.fill("empty");await page.getByText("Không có Lead phù hợp",{exact:true}).waitFor();
  await search.fill("deny");await page.waitForTimeout(350);
  assert.equal(await page.getByText("Synthetic Lead 1",{exact:true}).count(),0);
  assert.equal(await page.getByText("DỮ LIỆU MẪU",{exact:true}).count(),0);
  await open("?fixture=1");
  await page.getByText("Nguyễn Thị Minh Anh",{exact:true}).first().waitFor();
  assert.ok(await page.getByText("DỮ LIỆU MẪU",{exact:true}).count()>0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
