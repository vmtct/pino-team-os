// PAP-1972 · BO native Payroll scope fence / PAP-1063 · Compensation & Payroll
// Local React component test, synthetic Center context and HTTP fixtures; no Core/Stage requests.
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const evidence=process.env.PAP1972_EVIDENCE_DIR||require("os").tmpdir();
const {build}=require("esbuild");
const {chromium}=require("playwright");
const mode=process.argv[2]||"probe";
const A="0199f001-0000-7000-8000-000000000001",B="0199f001-0000-7000-8000-000000000002",S="01a18a28-6d8e-7db7-acbb-a18a942a5e72",R="00000000-0000-7000-8000-000000000099",D="2026-11-13";
const entry=[
'import React,{useState} from "react";',
'import {createRoot} from "react-dom/client";',
'import {FixtureContext} from "@/app/bo/components/registration/BoCenterSelection";',
'import Daily from "@/app/bo/payroll-daily/BoPayrollDailyReadView";',
'import Exceptions from "@/app/bo/payroll-exceptions/BoPayrollExceptionsReadView";',
'import DailyDetail from "@/app/bo/payroll-daily/[staffMemberId]/[workDate]/BoPayrollDailyDetail";',
'import ExceptionDetail from "@/app/bo/payroll-exceptions/[requestId]/BoPayrollExceptionDetail";',
'const A='+JSON.stringify(A)+',B='+JSON.stringify(B)+',S='+JSON.stringify(S)+',R='+JSON.stringify(R)+',D='+JSON.stringify(D)+';',
'window.calls=[];window.delay=0;window.wrongIdentity=false;',
'window.fetch=async(input,init)=>{const u=new URL(typeof input==="string"?input:input.url,location.origin),method=init?.method||input?.method||"GET";const c=u.searchParams.get("centerId");window.calls.push({path:u.pathname,center:c,method});const delay=window.delay;await new Promise(resolve=>setTimeout(resolve,delay));if(method!=="GET")throw Error("UNEXPECTED_WRITE");if(c===B)return Response.json({error:{code:"ACCESS_PERMISSION_DENIED",message:"Fixture forbidden"}},{status:403});',
'const day={base:{calculationVersion:"PAP-800-v1",centerId:c,staffMemberId:window.wrongIdentity?B:S,workDate:D,status:"READY",paidMinutes:75,amountMinor:45000,hourlyRateMinor:36000,rateEntryId:"rate-id",rateVersion:2,assignmentIds:["fixture-assignment"],sessionIds:[],correctionIds:[],coverageSourceIds:[],payableIntervals:[]},source:{coverage:[],attendance:[]},effective:{status:"READY",paidMinutes:75,amountMinor:45000},override:null,overrideStale:false,overrideVersion:0,sourceFingerprint:"fixture"};',
'const exc={id:window.wrongIdentity?B:R,centerId:c,staffMemberId:S,assignmentId:"fixture-assignment",workDate:D,requestedStartAt:"2026-11-13T11:00:00Z",requestedEndAt:"2026-11-13T12:00:00Z",requestReason:"synthetic fixture",status:"PENDING",decision:null};',
'const isDaily=u.pathname.includes("/daily"),isDetail=isDaily?u.pathname.endsWith("/"+D):u.pathname.endsWith("/"+R);const data=isDaily?day:exc;return Response.json({data:isDetail?data:{data:[data],total:1,nextOffset:null}});};',
'function App(){const [center,setCenter]=useState(A);const kind=new URLSearchParams(location.search).get("kind");window.switchCenter=setCenter;const scope={selected:center,loading:false,error:null,centers:[{id:A,name:"Fixture A"},{id:B,name:"Fixture B"}]};const view=kind==="daily"?<Daily/>:kind==="exceptions"?<Exceptions/>:kind==="daily-detail"?<DailyDetail staffMemberId={S} workDate={D}/>:<ExceptionDetail requestId={R}/>;return <FixtureContext.Provider value={scope}>{view}</FixtureContext.Provider>;}',
'createRoot(document.getElementById("root")).render(<App/>);'
].join("\n");
(async()=>{
const bundle=await build({absWorkingDir:root,stdin:{contents:entry,resolveDir:root,loader:"tsx",sourcefile:"pap1972-harness.tsx"},bundle:true,write:false,outdir:"dist",platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"'},loader:{".module.css":"local-css",".css":"css"},plugins:[{name:"fixture-boundaries",setup(b){
 b.onResolve({filter:/^@\/app\/bo\/components\/registration\/BoCenterSelection$/},()=>({path:"center",namespace:"fixture"}));
 b.onResolve({filter:/^next\/link$/},()=>({path:"link",namespace:"fixture"}));
 b.onResolve({filter:/^next\/navigation$/},()=>({path:"navigation",namespace:"fixture"}));
 b.onLoad({filter:/.*/,namespace:"fixture"},a=>({loader:"tsx",resolveDir:root,contents:a.path==="center"?'import {createContext,useContext} from "react";export const FixtureContext=createContext(null);export const useBoCenterSelection=()=>useContext(FixtureContext);':a.path==="link"?'import React from "react";export default function Link(props){return <a {...props}/>;}':'export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(){},replace(){},refresh(){}});'}));
 }}]});
const js=bundle.outputFiles.find(f=>f.path.endsWith(".js")).text,css=bundle.outputFiles.find(f=>f.path.endsWith(".css"))?.text??"";
const browser=await chromium.launch({headless:true});const results=[];
try{
for(const kind of ["daily","exceptions","daily-detail","exception-detail"]){
 const p=await browser.newPage({viewport:{width:1440,height:900}});p.setDefaultTimeout(6000);let errors=[],network=[];
 p.on("pageerror",e=>errors.push(e.message));
 await p.route("**/*",r=>{const u=new URL(r.request().url());if(u.hostname!=="pap1972.invalid"){network.push(u.origin);return r.abort();}if(u.pathname==="/bundle.js")return r.fulfill({contentType:"application/javascript",body:js});if(u.pathname==="/bundle.css")return r.fulfill({contentType:"text/css",body:css});if(u.pathname==="/")return r.fulfill({contentType:"text/html",body:'<!doctype html><html><head><link rel="stylesheet" href="/bundle.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'});return r.abort();});
 const flags={};
 try{
 await p.goto("http://pap1972.invalid/?kind="+kind);await p.waitForFunction(()=>typeof window.switchCenter==="function");
 if(!kind.includes("detail")){
  const row=p.locator("tbody tr").first();await row.waitFor();await row.locator("button").first().click();await p.getByRole("link",{name:"Full Detail"}).waitFor();
  await p.evaluate(B=>window.switchCenter(B),B);await p.getByRole("alert").waitFor();flags.deniedCenterHidesDrawer=await p.getByRole("link",{name:"Full Detail"}).count()===0;
  await p.evaluate(A=>{window.delay=250;window.switchCenter(A)},A);await row.locator("button").first().waitFor();await p.waitForTimeout(350);flags.returnCenterNoStaleDrawer=await p.getByRole("link",{name:"Full Detail"}).count()===0;
  if(kind==="daily"){if(await p.getByRole("link",{name:"Full Detail"}).count())await p.getByRole("button",{name:"Close detail",exact:true}).first().click({force:true});await row.locator("button").first().click();await p.getByRole("link",{name:"Full Detail"}).waitFor();const input=p.locator('input[type="date"]').first(),original=await input.inputValue();let day=new Date(original+"T00:00:00Z");day.setUTCDate(day.getUTCDate()+1);await input.fill(day.toISOString().slice(0,10),{force:true});await row.waitFor();await p.waitForTimeout(300);flags.dateFilterClosesDrawer=await p.getByRole("link",{name:"Full Detail"}).count()===0; }
 }else{
  await p.locator('[data-bo-detail-version="v25"]').waitFor();
  await p.evaluate(B=>window.switchCenter(B),B);await p.getByRole("alert").waitFor();flags.deniedCenterNoDetail=await p.locator('[data-bo-detail-version="v25"]').count()===0;
  await p.evaluate(A=>{window.delay=700;window.switchCenter(A)},A);await p.waitForTimeout(100);flags.newScopeLoadingNotOldError=await p.getByRole("alert").count()===0&&await p.getByRole("status").count()>0;
  await p.locator('[data-bo-detail-version="v25"]').waitFor();flags.correctDetailRestored=true;
  await p.evaluate(B=>{window.delay=0;window.switchCenter(B)},B);await p.getByRole("alert").waitFor();
  await p.evaluate(A=>{window.wrongIdentity=true;window.switchCenter(A)},A);await p.waitForTimeout(350);flags.wrongIdentityRejected=(await p.getByRole("alert").count())>0&&(await p.locator('[data-bo-detail-version="v25"]').count())===0;
 }
 const calls=await p.evaluate(()=>window.calls); flags.getOnly=calls.length>0&&calls.every(x=>x.method==="GET");flags.noExternalNetwork=network.length===0;flags.noPageError=errors.length===0;
 results.push({kind,flags,pass:Object.values(flags).every(Boolean),calls,errors});
 }catch(e){results.push({kind,flags,pass:false,error:String(e),errors,network});}finally{await p.close();}
}
}finally{await browser.close();fs.writeFileSync(path.join(evidence,"PAP-1972-"+mode+".json"),JSON.stringify({mode,results,browserClosed:true},null,2));for(const r of results)console.log(r.kind,JSON.stringify(r.flags),r.error||"",r.errors);console.log("PAP1972",results.filter(x=>x.pass).length+"/"+results.length);if(results.some(x=>!x.pass))process.exitCode=1;}
})().catch(e=>{console.error(e);process.exitCode=1});