/** PAP-2337 / PNR-APP-HUB — offline artifact build; no publication. */
import {build} from "esbuild";
import {mkdirSync,writeFileSync,existsSync,readFileSync} from "node:fs";
import {resolve,join} from "node:path";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {createRegistration,readAssets} from "./m1-preview-provenance.mjs";
const root=process.cwd(),git=(...args)=>execFileSync("git",args,{cwd:root});
const revision=git("rev-parse","HEAD").toString().trim();
if(git("status","--porcelain").toString().trim())throw Error("Clean committed source required");
const dependencies=process.env.PINO_M1_READONLY_NODE_MODULES;if(!dependencies)throw Error("Pinned dependency root required");
const outputRoot=process.env.PINO_M1_POST_ARTIFACT_ROOT;if(!outputRoot)throw Error("Private artifact root required");
const logoPath=process.env.PINO_M1_LOGO_PATH;
if(!logoPath)throw Error("Canonical logo path required");
const logo=readFileSync(logoPath);
if(createHash("sha256").update(logo).digest("hex")!=="76da9a2d6beae0d75134979ac0b622d4ab798c28d9d727c3c165819aacd59a4d")throw Error("Canonical logo digest mismatch");
for(const surface of ["bo","ho"]){
 const route=surface==="bo"?"/bo/piner-posts":"/ho/content/post-approval",assets=route+"/__m1_assets/",output=resolve(outputRoot,revision,surface);
 if(existsSync(output))throw Error("Preserve previous artifact evidence");
 mkdirSync(output,{recursive:true});writeFileSync(join(output,"pino-logo.png"),logo);
 const shim={
 "next/link":'export default function Link({href,children,prefetch,...props}){return <a {...props} href="#unavailable-local-module" onClick={event=>{props.onClick?.(event);event.preventDefault();}}>{children}</a>}',
 "next/image":'export default function Image({alt,width,height,className}){return <img className={className} alt={alt} width={width} height={height} src="'+assets+'pino-logo.png"/>}',
 "next/navigation":'export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(){throw Error("Local-only navigation")},replace(){throw Error("Local-only navigation")},refresh(){location.reload()}});export const redirect=()=>{throw Error("Local-only navigation")};',
 "next/dynamic":'export default function dynamic(){return function UnavailableLocalModule(){return null;}}',
 "local-logout":'export function LogoutButton(){return <button type="button" disabled>↪</button>}'
 };
 const result=await build({entryPoints:["scripts/native-m1-local/post-entry.tsx"],outfile:join(output,"app.js"),bundle:true,platform:"browser",format:"iife",jsx:"automatic",minify:true,metafile:true,nodePaths:[dependencies],alias:{react:resolve(dependencies,"react"),"react-dom":resolve(dependencies,"react-dom")},define:{"process.env.NODE_ENV":JSON.stringify("production")},plugins:[{name:"local-presentation-boundary",setup(b){b.onResolve({filter:/^next\/(link|image|navigation|dynamic)$/},a=>({path:a.path,namespace:"local-only"}));b.onResolve({filter:/^@\/app\/components\/tos-shell\/LogoutButton$/},()=>({path:"local-logout",namespace:"local-only"}));b.onLoad({filter:/.*/,namespace:"local-only"},a=>({contents:shim[a.path],loader:"jsx",resolveDir:root}));}}]});
 for(const required of ["app/bo/content/posts/PostPreviewShell.tsx","app/bo/content/posts/post-preview-contract.ts","app/bo/content/posts/post-preview-fixture.ts","app/bo/content/posts/BoPostSubmitShell.tsx","app/bo/piner-posts/BoPostsDraftRuntime.tsx","app/bo/piner-posts/native-draft-binding.ts","app/bo/piner-posts/post-preview-session.ts","app/ho/content/post-approval/HoPostApprovalShell.tsx"])if(!Object.keys(result.metafile.inputs).some(p=>p.replaceAll("\\","/")===required))throw Error("Native source missing: "+required);
 const reactInputs=Object.keys(result.metafile.inputs).map(p=>p.replaceAll("\\","/")).filter(p=>/\/react\/cjs\/react.production\.js$/.test(p));
 if(reactInputs.length!==1)throw Error("React runtime must be a singleton: "+JSON.stringify(reactInputs));
 console.log(JSON.stringify({surface,reactInputs}));
 if(!existsSync(join(output,"app.css")))throw Error("Native CSS missing");
 writeFileSync(join(output,"index.html"),'<!doctype html><html lang="vi" data-surface="'+surface+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Post · M1</title><link rel="stylesheet" href="'+assets+'app.css"></head><body><div id="root"></div><script src="'+assets+'app.js"></script></body></html>');
 const spec={jiraTask:"PAP-2337",epicCode:"PNR-APP-HUB",surface,reviewUrl:"http://192.168.1.6:8800"+route+"?m1Preview=1",sourceRevision:revision,fixtureId:"POST-MOCK-001",sourceFiles:{route:surface==="bo"?"app/bo/piner-posts/page.tsx":"app/ho/content/post-approval/page.tsx",renderer:surface==="bo"?"app/bo/piner-posts/BoPostsDraftRuntime.tsx":"app/bo/content/posts/PostPreviewShell.tsx",schema:surface==="bo"?"app/bo/piner-posts/native-draft-binding.ts":"app/bo/content/posts/post-preview-contract.ts",fixture:surface==="bo"?"app/bo/piner-posts/post-preview-session.ts":"app/bo/content/posts/post-preview-fixture.ts"}};
 const registration=createRegistration(spec,revision,path=>git("show",revision+":"+path),readAssets(output)),receipt=output+"-registration.json";writeFileSync(receipt,JSON.stringify(registration,null,2));console.log(JSON.stringify({surface,output,receipt,revision,artifact:registration.artifact.sha256,servingVerified:false}));
}
