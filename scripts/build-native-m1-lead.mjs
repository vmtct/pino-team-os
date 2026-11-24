/** PAP-2286 / PLT-LEAD: offline derived artifact, no publication or listener. */
import {build} from "esbuild";
import {mkdirSync,writeFileSync,existsSync,readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {resolve,join} from "node:path";
import {execFileSync} from "node:child_process";
import {createRegistration,readAssets} from "./m1-preview-provenance.mjs";
const root=process.cwd();
const git=(...args)=>execFileSync("git",args,{cwd:root});
const revision=git("rev-parse","HEAD").toString().trim();
if(git("status","--porcelain").toString().trim())throw Error("Clean committed source required");
const output=resolve("node_modules/.cache/pap2286-native-lead/"+revision);
if(existsSync(output))throw Error("Build output already exists; preserve evidence");
mkdirSync(output,{recursive:true});
const assets="/bo/sales/leads/__m1_assets/";
const logo=readFileSync(process.env.PINO_M1_BO_LOGO_PATH??"");
if(createHash("sha256").update(logo).digest("hex")!=="ed3e525cd6c51fdd4a4a8f9e984c13eec14e0b37245e8c2a8fc9ca8b23cf594b")throw Error("Canonical BO logo digest mismatch");
writeFileSync(join(output,"pino-logo-white.png"),logo);
const navigation=`
import {useSyncExternalStore} from "react";
const event="pino:m1:lead:navigation";
function subscribe(callback){window.addEventListener(event,callback);window.addEventListener("popstate",callback);return()=>{window.removeEventListener(event,callback);window.removeEventListener("popstate",callback);};}
const validId=id=>typeof id==="string"&&/^LEAD-MOCK-\\d{3,}$/.test(id);
function decode(){const physical=new URLSearchParams(location.search),id=physical.get("record");const virtual=new URLSearchParams("m1Preview=1");const saved=history.state?.[event];if(validId(id)){if(saved?.id===id&&saved.mode==="quickView")virtual.set("quickView",id);else{virtual.set("lead",id);if(saved?.id===id&&/^[a-z][a-z0-9-]{0,63}$/.test(saved.tab??""))virtual.set("tab",saved.tab);}}return virtual;}
function snapshot(){return decode().toString();}
export const usePathname=()=>location.pathname;
export function useSearchParams(){return new URLSearchParams(useSyncExternalStore(subscribe,snapshot,snapshot));}
function target(href){const next=new URL(href,location.href),q=next.searchParams;if(next.origin!==location.origin||next.pathname!=="/bo/sales/leads"||q.getAll("m1Preview").length!==1||q.get("m1Preview")!=="1"||next.hash||[...q.keys()].some(k=>!["m1Preview","lead","quickView","tab","record"].includes(k)||q.getAll(k).length!==1))throw Error("Local review route only");const lead=q.get("lead"),quick=q.get("quickView"),record=q.get("record"),id=lead??quick??record,tab=q.get("tab");if([lead,quick,record].filter(x=>x!==null).length>1||id!==null&&!validId(id)||tab!==null&&(!lead||!/^[a-z][a-z0-9-]{0,63}$/.test(tab)))throw Error("Synthetic record only");const physical=new URLSearchParams("m1Preview=1");if(id)physical.set("record",id);return {href:next.pathname+"?"+physical,state:{id,mode:quick?"quickView":"detail",tab}};}
export const localHref=href=>target(href).href;
function change(href,replace){const next=target(href);history[replace?"replaceState":"pushState"]({[event]:next.state},"",next.href);window.dispatchEvent(new Event(event));}
export const useRouter=()=>({push:href=>change(href,false),replace:href=>change(href,true),refresh:()=>location.reload(),back:()=>history.back()});
export const redirect=()=>{throw Error("Local-only navigation")};
`;
const shim={
 "next/navigation":navigation,
 "next/link":`import {useRouter,localHref} from "next/navigation";export default function Link({href,children,prefetch,...props}){const router=useRouter();let actual=null;try{if(typeof href==="string")actual=localHref(href);}catch{}return <a {...props} href={actual??"#unavailable-local-module"} onClick={event=>{props.onClick?.(event);if(event.defaultPrevented)return;event.preventDefault();if(actual)router.push(href);}}>{children}</a>}`,
 "next/image":`export default function Image({alt,width,height,className}){return <span className={className} role="img" aria-label={alt} style={{width,height}}/>}`,
 "next/dynamic":`export default function dynamic(){return function UnavailableLocalModule(){return null;}}`,
 "local-logout":`export function LogoutButton(){return <button type="button" disabled>↪</button>}`
};
const result=await build({entryPoints:["scripts/native-m1-local/lead-entry.tsx"],outfile:join(output,"app.js"),bundle:true,platform:"browser",format:"iife",jsx:"automatic",minify:true,metafile:true,define:{"process.env.NODE_ENV":JSON.stringify("production")},plugins:[{name:"local-presentation-boundary",setup(b){
 b.onLoad({filter:/[\\/]BoCenterSwitcher\.tsx$/},a=>{const text=readFileSync(a.path,"utf8"),url="https://assets.pinohouse.art/core/Pino%20Logo%20White.png";if(!text.includes(url))throw Error("Native BO logo source changed");return {contents:text.replace(url,assets+"pino-logo-white.png"),loader:"tsx",resolveDir:resolve(a.path,"..")};});
 b.onResolve({filter:/^next\/(link|image|navigation|dynamic)$/},args=>({path:args.path,namespace:"local-only"}));
 b.onResolve({filter:/^@\/app\/components\/tos-shell\/LogoutButton$/},()=>({path:"local-logout",namespace:"local-only"}));
 b.onLoad({filter:/.*/,namespace:"local-only"},args=>({contents:shim[args.path],loader:"jsx",resolveDir:root}));
}}]});
for(const required of ["app/bo/sales/leads/LeadHouseholdM1Preview.tsx","app/bo/sales/leads/lead-household-m1-fixtures.ts","app/bo/components/registration/BoRegistrationWorkspace.tsx","app/bo/components/BoFullDetail.tsx"])if(!Object.keys(result.metafile.inputs).some(p=>p.replaceAll("\\","/")===required))throw Error("Native source not bundled: "+required);
if(!existsSync(join(output,"app.css")))throw Error("Native CSS missing");
writeFileSync(join(output,"index.html"),'<!doctype html><html lang="vi" data-bo-ui-authority="v25" data-bo-design-system="v25"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Leads · M1</title><link rel="stylesheet" href="'+assets+'app.css"></head><body><div id="root"></div><script src="'+assets+'app.js"></script></body></html>');
const spec={jiraTask:"PAP-2286",epicCode:"PLT-LEAD",surface:"bo",reviewUrl:"http://192.168.1.6:8800/bo/sales/leads?m1Preview=1",sourceRevision:revision,fixtureId:"LEAD-MOCK-001",sourceFiles:{route:"app/bo/sales/leads/page.tsx",renderer:"app/bo/sales/leads/LeadHouseholdM1Preview.tsx",schema:"app/bo/sales/leads/lead-household-m1-fixtures.ts",fixture:"app/bo/sales/leads/lead-household-m1-fixtures.ts"}};
const registration=createRegistration(spec,revision,path=>git("show",revision+":"+path),readAssets(output));
const receipt=output+"-registration.json";
writeFileSync(receipt,JSON.stringify(registration,null,2));
console.log(JSON.stringify({output,receipt,revision,artifact:registration.artifact.sha256,servingVerified:false}));
