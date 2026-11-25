/** PAP-2183 / PLT-PRODUCT-PLAN: derived build only, no listener or publication. */
import {build} from "esbuild";
import {mkdirSync,writeFileSync,existsSync,readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {resolve,join} from "node:path";
import {execFileSync} from "node:child_process";
import {createRegistration,readAssets} from "./m1-preview-provenance.mjs";
const root=process.cwd();
const pkg=JSON.parse(readFileSync(resolve("node_modules/@pino/design-system/package.json"),"utf8"));
if(pkg.version!=="0.4.3")throw Error("PAP-2363 released Team consumer pin 0.4.3 required; no shared dependency mutation");
const git=(...args)=>execFileSync("git",args,{cwd:root});
const revision=git("rev-parse","HEAD").toString().trim();
if(git("status","--porcelain").toString().trim())throw Error("Clean committed source required");
const output=resolve("node_modules/.cache/pap2183-native-product-plans/"+revision);
if(existsSync(output))throw Error("Build output already exists; preserve previous evidence");
const logo=readFileSync(resolve("node_modules/.cache/pap2345-ho-logo.png"));
const logoSha="76da9a2d6beae0d75134979ac0b622d4ab798c28d9d727c3c165819aacd59a4d";
if(createHash("sha256").update(logo).digest("hex")!==logoSha)throw Error("Canonical PINO logo digest mismatch");
mkdirSync(output,{recursive:true});
writeFileSync(join(output,"pino-logo.png"),logo);
const assets="/ho/billing/product-plans/__m1_assets/";
const shim={
 "next/link":`export default function Link({href,children,prefetch,...props}){return <a {...props} href={href==="/ho/billing/product-plans"?href:"#unavailable-local-module"} onClick={event=>{props.onClick?.(event);event.preventDefault();}}>{children}</a>}`,
 "next/image":`export default function Image({alt,width,height,className}){return <img className={className} alt={alt} width={width} height={height} src="/ho/billing/product-plans/__m1_assets/pino-logo.png"/>}`,
 "next/navigation":`export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(){throw Error("Local-only navigation")},replace(){throw Error("Local-only navigation")},refresh(){location.reload()}});export const redirect=()=>{throw Error("Local-only navigation")};`,
 "next/dynamic":`export default function dynamic(){return function UnavailableLocalModule(){return null;}}`,
 "local-logout":`export function LogoutButton(){return <button type="button" disabled aria-label="Đăng xuất không khả dụng trong M1">↪</button>}`
};
const result=await build({entryPoints:["scripts/native-m1-local/product-plans-entry.tsx"],outfile:join(output,"app.js"),bundle:true,platform:"browser",format:"iife",jsx:"automatic",minify:true,metafile:true,define:{"process.env.NODE_ENV":JSON.stringify("production")},plugins:[{name:"local-presentation-boundary",setup(b){
 b.onResolve({filter:/^next\/(link|image|navigation|dynamic)$/},args=>({path:args.path,namespace:"local-only"}));
 b.onResolve({filter:/^@\/app\/components\/tos-shell\/LogoutButton$/},()=>({path:"local-logout",namespace:"local-only"}));
 b.onLoad({filter:/.*/,namespace:"local-only"},args=>({contents:shim[args.path],loader:"jsx",resolveDir:root}));
}}]});
for(const required of ["app/ho/billing/product-plans/ProductPlanM1Content.tsx","app/components/workspace-renderer/Editor.tsx","app/ho/billing/product-plans/schema.ts","app/ho/billing/product-plans/product-plan-m1-preview.ts","app/bo/components/registration/BoRegistrationWorkspace.tsx"])if(!Object.keys(result.metafile.inputs).some(p=>p.replaceAll("\\","/")===required))throw Error("Native source not bundled: "+required);
if(!existsSync(join(output,"app.css")))throw Error("Native CSS missing");
writeFileSync(join(output,"index.html"),'<!doctype html><html lang="vi" data-surface="ho"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gói học · M1</title><link rel="stylesheet" href="'+assets+'app.css"></head><body><div id="root"></div><script src="'+assets+'app.js"></script></body></html>');
const spec={jiraTask:"PAP-2183",epicCode:"PLT-PRODUCT-PLAN",surface:"ho",reviewUrl:"http://desktop-isrdren:8800/ho/billing/product-plans",sourceRevision:revision,fixtureId:"PRODUCT-PLAN-MOCK-001",sourceFiles:{route:"app/ho/billing/product-plans/page.tsx",renderer:"app/ho/billing/product-plans/ProductPlanM1Content.tsx",schema:"app/ho/billing/product-plans/schema.ts",fixture:"app/ho/billing/product-plans/product-plan-m1-preview.ts"}};
const registration=createRegistration(spec,revision,path=>git("show",revision+":"+path),readAssets(output));
const receipt=output+"-registration.json";writeFileSync(receipt,JSON.stringify(registration,null,2));
console.log(JSON.stringify({output,receipt,revision,artifact:registration.artifact.sha256,servingVerified:false}));
