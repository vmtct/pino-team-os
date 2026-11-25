/** PAP-2225 / PLT-DELIVERY: immutable native artifact, no listener/publication. */
import {build} from "esbuild";
import {mkdirSync,writeFileSync,existsSync,readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {resolve,join} from "node:path";
import {execFileSync} from "node:child_process";
import {createRegistration,readAssets} from "./m1-preview-provenance.mjs";
const root=process.cwd(),git=(...args)=>execFileSync("git",args,{cwd:root});
const revision=git("rev-parse","HEAD").toString().trim();
if(git("status","--porcelain").toString().trim())throw Error("Clean committed source required");
const output=resolve("node_modules/.cache/pap2225-native-running-class/"+revision);
if(existsSync(output))throw Error("Preserve prior artifact");
const logo=readFileSync(process.env.PINO_M1_BO_LOGO_PATH??"");
if(createHash("sha256").update(logo).digest("hex")!=="ed3e525cd6c51fdd4a4a8f9e984c13eec14e0b37245e8c2a8fc9ca8b23cf594b")throw Error("Canonical BO logo digest mismatch");
mkdirSync(output,{recursive:true});writeFileSync(join(output,"pino-logo-white.png"),logo);
const route="/bo/running-classes",assets=route+"/__m1_assets/";
const shim={
 "next/link":'export default function Link({href,children,prefetch,...props}){return <a {...props} href={href==="/bo/running-classes"?href:"#unavailable-local-module"} onClick={event=>{props.onClick?.(event);event.preventDefault();}}>{children}</a>}',
 "next/image":'export default function Image({alt,width,height,className}){return <img className={className} alt={alt} width={width} height={height} src="/bo/running-classes/__m1_assets/pino-logo-white.png"/>}',
 "next/navigation":'export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(){throw Error("Local navigation only")},replace(){throw Error("Local navigation only")},refresh(){location.reload()}});export const redirect=()=>{throw Error("Local navigation only")};',
 "next/dynamic":'export default function dynamic(){return function UnavailableLocalModule(){return null;}}',
 "local-logout":'export function LogoutButton(){return <button type="button" disabled aria-label="Đăng xuất không khả dụng trong M1">↪</button>}'
};
const result=await build({entryPoints:["scripts/native-m1-local/running-class-entry.tsx"],outfile:join(output,"app.js"),bundle:true,platform:"browser",format:"iife",jsx:"automatic",minify:true,metafile:true,define:{"process.env.NODE_ENV":JSON.stringify("production")},plugins:[{name:"local-presentation-boundary",setup(b){
 b.onLoad({filter:/[\\/]BoCenterSwitcher\.tsx$/},a=>{const text=readFileSync(a.path,"utf8"),url="https://assets.pinohouse.art/core/Pino%20Logo%20White.png";if(!text.includes(url))throw Error("Native BO logo changed");return {contents:text.replace(url,assets+"pino-logo-white.png"),loader:"tsx",resolveDir:resolve(a.path,"..")};});
 b.onResolve({filter:/^next\/(link|image|navigation|dynamic)$/},args=>({path:args.path,namespace:"local-only"}));
 b.onResolve({filter:/^@\/app\/components\/tos-shell\/LogoutButton$/},()=>({path:"local-logout",namespace:"local-only"}));
 b.onLoad({filter:/.*/,namespace:"local-only"},args=>({contents:shim[args.path],loader:"jsx",resolveDir:root}));
}}]});
for(const required of ["app/bo/components/registration/BoRegistrationWorkspace.tsx","app/bo/components/registration/BoFullDetail.tsx","app/bo/components/registration/BoQuickView.tsx","app/bo/running-classes/RunningClassDraftControls.tsx","app/bo/running-classes/running-class-review.ts"])if(!Object.keys(result.metafile.inputs).some(p=>p.replaceAll("\\","/")===required))throw Error("Native source missing: "+required);
if(!existsSync(join(output,"app.css")))throw Error("CSS missing");
writeFileSync(join(output,"index.html"),'<!doctype html><html lang="vi" data-bo-ui-authority="v25" data-bo-design-system="v25"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Running Class · M1</title><link rel="stylesheet" href="'+assets+'app.css"></head><body><div id="root"></div><script src="'+assets+'app.js"></script></body></html>');
const spec={jiraTask:"PAP-2225",epicCode:"PLT-DELIVERY",surface:"bo",reviewUrl:"http://desktop-isrdren:8800"+route,sourceRevision:revision,fixtureId:"RUNNING-CLASS-MOCK-001",sourceFiles:{route:"app/bo/running-classes/page.tsx",renderer:"app/bo/running-classes/RunningClassDraftControls.tsx",schema:"app/bo/running-classes/running-class-presentation.ts",fixture:"app/bo/running-classes/running-class-review.ts"}};
const registration=createRegistration(spec,revision,path=>git("show",revision+":"+path),readAssets(output));
const receipt=output+"-registration.json";writeFileSync(receipt,JSON.stringify(registration,null,2));
console.log("PAP2225_ARTIFACT "+JSON.stringify({output,receipt,revision,artifact:registration.artifact.sha256,servingVerified:false}));
