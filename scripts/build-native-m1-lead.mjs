/** PAP-2286 / PLT-LEAD: offline derived artifact, no publication or listener. */
import {build} from "esbuild";
import {mkdirSync,writeFileSync,existsSync} from "node:fs";
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
const navigation=`
import {useSyncExternalStore} from "react";
const event="pino:m1:lead:navigation";
function subscribe(callback){window.addEventListener(event,callback);window.addEventListener("popstate",callback);return()=>{window.removeEventListener(event,callback);window.removeEventListener("popstate",callback);};}
function snapshot(){return location.search;}
export const usePathname=()=>location.pathname;
export function useSearchParams(){return new URLSearchParams(useSyncExternalStore(subscribe,snapshot,snapshot));}
function change(href,replace){const next=new URL(href,location.href);if(next.origin!==location.origin||next.pathname!=="/bo/sales/leads"||next.searchParams.get("m1Preview")!=="1"||next.hash)throw Error("Local review route only");history[replace?"replaceState":"pushState"](null,"",next.pathname+next.search);window.dispatchEvent(new Event(event));}
export const useRouter=()=>({push:href=>change(href,false),replace:href=>change(href,true),refresh:()=>location.reload(),back:()=>history.back()});
export const redirect=()=>{throw Error("Local-only navigation")};
`;
const shim={
 "next/navigation":navigation,
 "next/link":`import {useRouter} from "next/navigation";export default function Link({href,children,prefetch,...props}){const router=useRouter();const valid=typeof href==="string"&&href.startsWith("/bo/sales/leads?")&&new URL(href,location.href).searchParams.get("m1Preview")==="1";return <a {...props} href={valid?href:"#unavailable-local-module"} onClick={event=>{props.onClick?.(event);if(event.defaultPrevented)return;event.preventDefault();if(valid)router.push(href);}}>{children}</a>}`,
 "next/image":`export default function Image({alt,width,height,className}){return <span className={className} role="img" aria-label={alt} style={{width,height}}/>}`,
 "next/dynamic":`export default function dynamic(){return function UnavailableLocalModule(){return null;}}`,
 "local-logout":`export function LogoutButton(){return <button type="button" disabled>↪</button>}`
};
const result=await build({entryPoints:["scripts/native-m1-local/lead-entry.tsx"],outfile:join(output,"app.js"),bundle:true,platform:"browser",format:"iife",jsx:"automatic",minify:true,metafile:true,define:{"process.env.NODE_ENV":JSON.stringify("production")},plugins:[{name:"local-presentation-boundary",setup(b){
 b.onResolve({filter:/^next\/(link|image|navigation|dynamic)$/},args=>({path:args.path,namespace:"local-only"}));
 b.onResolve({filter:/^@\/app\/components\/tos-shell\/LogoutButton$/},()=>({path:"local-logout",namespace:"local-only"}));
 b.onLoad({filter:/.*/,namespace:"local-only"},args=>({contents:shim[args.path],loader:"jsx",resolveDir:root}));
}}]});
for(const required of ["app/bo/sales/leads/LeadHouseholdM1Preview.tsx","app/bo/sales/leads/lead-household-m1-fixtures.ts","app/bo/components/registration/BoRegistrationWorkspace.tsx","app/bo/components/BoFullDetail.tsx"])if(!Object.keys(result.metafile.inputs).some(p=>p.replaceAll("\\","/")===required))throw Error("Native source not bundled: "+required);
if(!existsSync(join(output,"app.css")))throw Error("Native CSS missing");
writeFileSync(join(output,"index.html"),'<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Leads · M1</title><link rel="stylesheet" href="'+assets+'app.css"></head><body><div id="root"></div><script src="'+assets+'app.js"></script></body></html>');
const spec={jiraTask:"PAP-2286",epicCode:"PLT-LEAD",surface:"bo",reviewUrl:"http://192.168.1.6:8800/bo/sales/leads?m1Preview=1",sourceRevision:revision,fixtureId:"LEAD-MOCK-001",sourceFiles:{route:"app/bo/sales/leads/page.tsx",renderer:"app/bo/sales/leads/LeadHouseholdM1Preview.tsx",schema:"app/bo/sales/leads/lead-household-m1-fixtures.ts",fixture:"app/bo/sales/leads/lead-household-m1-fixtures.ts"}};
const registration=createRegistration(spec,revision,path=>git("show",revision+":"+path),readAssets(output));
const receipt=output+"-registration.json";
writeFileSync(receipt,JSON.stringify(registration,null,2));
console.log(JSON.stringify({output,receipt,revision,artifact:registration.artifact.sha256,servingVerified:false}));
