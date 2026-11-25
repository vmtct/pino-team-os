/** PAP-2359 / PAP-1316: HO_BO_DEEPLINK_CONTINUITY_P0.
 * Explicit coverage inventory, not a route/permission allowlist. The existing
 * mandatory lib/*.test.ts PR Validation suite runs this for every change.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readdirSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {NextRequest} from "next/server";
import {middleware} from "../middleware";
import {HO_PAGE_PATHS,safeHoReturnTo,hoStagingAuthPath,hoStagingReturnFromSearch} from "./ho-routes";
import {BO_LEGACY_QUERY_MODULES} from "./bo-url-contract";
import {boStagingAdmittedRoutes} from "../app/bo/architecture/bo-staging-route-policy";
import {safeBoStagingReturnTo,boStagingAuthContinuation,boStagingReturnFromSearch,BO_RETURN_HEADER} from "./bo-staging-return-to";
import {recoverInvalidStaffPasswordSession} from "./staff-session-recovery";
import {roleReviewRoute} from "../app/ho/system/roles/role-m1-preview";
const ho="ho.staging.pinohouse.art",bo="bo.staging.pinohouse.art";
const id="01a1ef9f-d253-7e6b-ba2d-200887c4486f";
const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
// Adding a registered route requires a deliberate receipt here, with
// representative functional query examples wherever the page emits them.
const hoPaths=[
 "/ho/billing/bills","/ho/billing/product-plans","/ho/learning-spaces","/ho/centers","/ho/open-studio/walkin","/ho/mytime-workshops",
 "/ho/workforce/term-weeks","/ho/operating-cycle/global-terms","/ho/workforce/shift-templates",
 "/ho/staff","/ho/workforce/staff-links","/ho/learning/paths","/ho/learning/syllabi",
 "/ho/learning/missions","/ho/learning/specialties","/ho/learning/diaries","/ho/content/post-approval",
 "/ho/pinoria/worlds","/ho/pinoria/wardrobe","/ho/pinoria/wardrobe-sets","/ho/pinoria/starter-sets",
 "/ho/pinoria/wish-policies","/ho/pinoria/wish-banners","/ho/pinoria/effects","/ho/pinoria/tv-policies",
 "/ho/system/custom-attributes","/ho/system/people","/ho/system/users","/ho/system/roles",
 "/ho/system/audit","/ho/system/tdd-reference","/ho/language-mappings",
];
const boPaths=[
 "/bo/missions","/bo/bills","/bo/workforce-shift-plans","/bo/workforce-availability",
 "/bo/workforce-assignments","/bo/payroll-periods","/bo/payroll-daily","/bo/payroll-exceptions",
 "/bo/pinoria-avatars","/bo/afterschool-accounts","/bo/open-studio-passes","/bo/classroom-diaries",
 "/bo/piner-posts","/bo/sales/leads","/bo/guests","/bo/mytime-workshops","/bo/enrollments",
 "/bo/opening-evidence","/bo/pinoria-wish-events",
];
const legacy:Record<string,string>={
 students:"/bo?module=students",classes:"/bo?module=classes",subscriptions:"/bo?module=subscriptions",
 enrollments:"/bo/enrollments",visits:"/bo?module=visits",staffs:"/bo?module=staffs",
 timekeeping:"/bo?module=timekeeping",salaryPeriods:"/bo/payroll-periods",audits:"/bo?module=audits",
 parents:"/bo?module=parents",missions:"/bo?module=missions",
};
const previews:Record<string,{path:string;expected:string;record?:string;negative:string}>={
 "/ho/learning-spaces":{path:"/ho/learning-spaces",expected:"/ho/learning-spaces",record:"record=LEARNING-SPACE-MOCK-001",negative:"record="+id},
 "/ho/billing/product-plans":{path:"/ho/billing/product-plans?m1Preview=1",expected:"/ho/billing/product-plans",record:"record=PRODUCT-PLAN-MOCK-001",negative:"record="+id},
 "/bo/piner-posts":{path:"/bo/piner-posts?m1Preview=1",expected:"/bo/piner-posts",record:"record=POST-MOCK-001&tab=media",negative:"record="+id},
 "/bo/sales/leads":{path:"/bo/sales/leads?m1Preview=1",expected:"/bo/sales/leads",record:"lead=LEAD-MOCK-001&tab=members",negative:"lead="+id},
 "/ho/staff":{path:"/ho/staff?m1Preview=1",expected:"/ho/staff",record:"record=STAFF-MOCK-001",negative:"record="+id},
 "/ho/system/roles":{path:"/ho/system/roles?m1Preview=1",expected:"/ho/system/roles?m1Preview=1",record:"record=ROLE-MOCK-001",negative:"record="+id},
};
function discoverPreviewPages(dir:string):string[]{
 return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const file=join(dir,entry.name);
  if(entry.isDirectory())return discoverPreviewPages(file);
  if(entry.name!=="page.tsx"||!/\b(?:m1Preview|decideM1Preview)\b/.test(readFileSync(file,"utf8")))return [];
  return [file.replace(/\\/g,"/").replace(/^app/,"").replace(/\/page\.tsx$/,"")];
 });
}
function sameSet(actual:readonly string[],expected:readonly string[],message:string){
 assert.deepEqual([...actual].sort(),[...expected].sort(),message);
}
function parse(host:string,path:string){return host===ho?safeHoReturnTo(path):safeBoStagingReturnTo(path);}
function tracked(path:string){return path+(path.includes("?")?"&":"?")+"utm_source=chatgpt.com&utm_medium=referral";}
function checkFlow(host:string,input:string,expected:string){
 const origin="https://"+host;
 assert.equal(parse(host,input),expected,input+" parser");
 let current=new URL(tracked(input),origin);
 let response=middleware(new NextRequest(current));
 for(let i=0;i<3&&response.status===307;i++){
  current=new URL(response.headers.get("location")!);
  if(current.pathname==="/staff-login")break;
  assert.equal(current.host,host,input+" cross-host redirect");
  response=middleware(new NextRequest(current));
 }
 assert.equal(response.status,307,input+" anonymous login status");
 assert.equal(current.pathname,"/staff-login",input+" login path");
 assert.equal(current.searchParams.get("returnTo"),expected,input+" lost destination");
 const get=host===ho?hoStagingReturnFromSearch:boStagingReturnFromSearch;
 const change=host===ho?hoStagingAuthPath("/staff-password/change",get(current.search)):boStagingAuthContinuation("/staff-password/change",current.search);
 assert.equal(get(new URL(change,origin).search),expected,input+" password change");
 const signed=middleware(new NextRequest(origin+tracked(expected),{headers:{cookie:"pino_staff_password_session=fixture-only"}}));
 assert.equal(signed.headers.get("x-middleware-next"),"1",input+" session hint");
 const header=host===ho?"x-pino-ho-return-to":BO_RETURN_HEADER;
 assert.equal(signed.headers.get("x-middleware-request-"+header),expected,input+" session destination");
}
test("HO_BO_DEEPLINK_CONTINUITY_P0: every registered route and legacy alias has a deliberate coverage receipt",()=>{
 sameSet(Object.values(HO_PAGE_PATHS),hoPaths,"HO route added/removed: update coverage contract");
 sameSet([...boStagingAdmittedRoutes],boPaths,"BO admission changed: update coverage contract");
 sameSet([...BO_LEGACY_QUERY_MODULES],Object.keys(legacy),"BO legacy alias changed: update coverage contract");
 for(const p of ["/ho",...hoPaths])checkFlow(ho,p,p);
 for(const p of ["/bo",...boPaths])checkFlow(bo,p,p);
 for(const [key,expected] of Object.entries(legacy))checkFlow(bo,"/bo?module="+key,expected);
});
test("HO_BO_DEEPLINK_CONTINUITY_P0: native preview entrypoints cannot ship untested",()=>{
 sameSet([...discoverPreviewPages("app/bo"),...discoverPreviewPages("app/ho")],Object.keys(previews),"Native M1 page changed: register its actual preview URL and fail-closed examples");
 for(const [path,entry] of Object.entries(previews)){
  const host=path.startsWith("/ho/")?ho:bo;
  checkFlow(host,entry.path,entry.expected);
  if(entry.record)checkFlow(host,entry.path+(entry.path.includes("?")?"&":"?")+entry.record,entry.expected+(entry.expected.includes("?")?"&":"?")+entry.record);
  for(const suffix of ["m1Preview=0","m1Preview=1&m1Preview=1","m1Preview=1&returnTo=//evil.example","m1Preview=1&"+entry.negative]){
   assert.equal(parse(host,path+"?"+suffix),null,path+"?"+suffix);
  }
 }
 // PAP-2183: canonical path, exact mock ID, legacy normalization and no real ID.
 const plans="/ho/billing/product-plans";
 checkFlow(ho,plans+"?record=PRODUCT-PLAN-MOCK-001",plans+"?record=PRODUCT-PLAN-MOCK-001");
 for(const query of ["record="+id,"record=PRODUCT-PLAN-MOCK-002","record=","record=PRODUCT-PLAN-MOCK-001&record=PRODUCT-PLAN-MOCK-001","tab=unknown","next=/bo"])
   assert.equal(parse(ho,plans+"?"+query),null,plans+"?"+query);
 assert.equal(parse(bo,plans),null);
 // PAP-2369: canonical native preview only; no legacy selector or real ID.
 const spaces="/ho/learning-spaces";
 checkFlow(ho,spaces+"?record=LEARNING-SPACE-MOCK-001",spaces+"?record=LEARNING-SPACE-MOCK-001");
 for(const query of ["record="+id,"record=LEARNING-SPACE-MOCK-002","record=","record=LEARNING-SPACE-MOCK-001&record=LEARNING-SPACE-MOCK-001","m1Preview=1","tab=unknown","next=/bo"])
   assert.equal(parse(ho,spaces+"?"+query),null,spaces+"?"+query);
 assert.equal(parse(bo,spaces),null);
 assert.equal(roleReviewRoute({m1Preview:"1"}),"preview");
 assert.equal(roleReviewRoute({record:id,m1Preview:"1"}),"invalid");
});
test("HO_BO_DEEPLINK_CONTINUITY_P0: route-specific detail, tab, grid, center and recovery examples",async()=>{
 const samples:[string,string,string][]=[
  [ho,"/ho/pinoria/worlds?record="+id+"&tab=scenes","/ho/pinoria/worlds?record="+id+"&tab=scenes"],
  [ho,"/ho/pinoria/starter-sets?record="+id+"&tab=members","/ho/pinoria/starter-sets?record="+id+"&tab=members"],
  [ho,"/ho/pinoria/wish-banners?record="+id+"&tab=items&wishSelection=pending&wishRevision=2","/ho/pinoria/wish-banners?record="+id+"&tab=items&wishSelection=pending&wishRevision=2"],
  [ho,"/ho/system/custom-attributes?sort=displayName&size=30&page=2&scope=CENTER&centerId="+center,"/ho/system/custom-attributes?sort=displayName&size=30&page=2&scope=CENTER&centerId="+center],
  [bo,"/bo/subscriptions?centerId="+center+"&record="+id+"&tab=enrollment","/bo?module=subscriptions&centerId="+center+"&record="+id+"&tab=enrollment"],
  [bo,"/bo/piner-posts?centerId="+center+"&record=POST-MOCK-001&tab=media","/bo/piner-posts?centerId="+center+"&record=POST-MOCK-001&tab=media"],
  [bo,"/bo/sales/leads?centerId="+center+"&leadIntent="+id+"&q=music&dir=desc&size=50&f_status=SUBMITTED","/bo/sales/leads?centerId="+center+"&leadIntent="+id+"&q=music&dir=desc&size=50&f_status=SUBMITTED"],
 ];
 for(const [host,path,expected] of samples){
  checkFlow(host,path,expected);
  const url=new URL(path,"https://"+host),result:string[]=[];
  await recoverInvalidStaffPasswordSession(async()=>new Response(null,{status:204}),{hostname:host,pathname:url.pathname,search:url.search,replace:v=>result.push(String(v))});
  assert.equal(new URL(result[0]!,"https://"+host).searchParams.get("returnTo"),expected,path+" expired session");
 }
 for(const host of [bo,ho]){
  const own=host===ho?"/ho/centers":"/bo";
  for(const input of ["//evil.example"+own,"https://evil.example"+own,own+"?returnTo=//evil.example",own+"?m1Preview=1",own+"?record=a&record=b"])
   assert.equal(parse(host,input),null,input);
 }
});

test("PAP-2337: malformed authenticated Post preview requests fail before streaming",()=>{
 const path="/bo/piner-posts",headers={cookie:"pino_staff_password_session=fixture-only"};
 for(const q of ["record="+id,"record=POST-MOCK-001&record=POST-MOCK-002","m1Preview=0","tab=media","returnTo=//evil.example"]){
  for(const method of ["GET","HEAD"])assert.equal(middleware(new NextRequest("https://"+bo+path+"?"+q,{headers,method})).status,404,q);
 }
 for(const q of ["","?record=POST-MOCK-001&tab=media","?m1Preview=1&record=POST-MOCK-001&tab=media","?centerId="+center])assert.equal(middleware(new NextRequest("https://"+bo+path+q,{headers})).headers.get("x-middleware-next"),"1",q);
 assert.equal(middleware(new NextRequest("https://"+bo+path+"?record=POST-MOCK-001&_rsc=abc",{headers:{...headers,rsc:"1"}})).headers.get("x-middleware-next"),"1");
});

test("PAP-2369: malformed authenticated Learning Space links fail before streaming",()=>{
 const path="/ho/learning-spaces",headers={cookie:"pino_staff_password_session=fixture-only"};
 for(const q of ["record="+id,"record=LEARNING-SPACE-MOCK-001&record=LEARNING-SPACE-MOCK-001","m1Preview=1","tab=unknown","next=/bo"]){
  for(const method of ["GET","HEAD"])assert.equal(middleware(new NextRequest("https://"+ho+path+"?"+q,{headers,method})).status,404,q);
 }
 for(const q of ["","?record=LEARNING-SPACE-MOCK-001","?utm_source=chatgpt.com&record=LEARNING-SPACE-MOCK-001"])assert.equal(middleware(new NextRequest("https://"+ho+path+q,{headers})).headers.get("x-middleware-next"),"1",q);
 assert.equal(middleware(new NextRequest("https://"+ho+path+"?record=LEARNING-SPACE-MOCK-001&_rsc=abc",{headers:{...headers,rsc:"1"}})).headers.get("x-middleware-next"),"1");
});
