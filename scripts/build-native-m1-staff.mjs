/** PAP-2345 / PLT-M1-DELIVERY: derived build only, no listener or publication. */
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
const output=resolve("node_modules/.cache/pap2345-native-staff/"+revision);
if(existsSync(output))throw Error("Build output already exists; preserve previous evidence");
const logo=readFileSync(resolve("node_modules/.cache/pap2345-ho-logo.png"));
const logoSha="76da9a2d6beae0d75134979ac0b622d4ab798c28d9d727c3c165819aacd59a4d";
if(createHash("sha256").update(logo).digest("hex")!==logoSha)throw Error("Canonical PINO logo digest mismatch");
mkdirSync(output,{recursive:true});
writeFileSync(join(output,"pino-logo.png"),logo);
const assets="/ho/staff/__m1_assets/";
const shim={
 "next/link":`export default function Link({href,children,prefetch,...props}){return <a {...props} href={href==="/ho/staff"?href:"#unavailable-local-module"} onClick={event=>{props.onClick?.(event);event.preventDefault();}}>{children}</a>}`,
 "next/image":`export default function Image({alt,width,height,className}){return <img className={className} alt={alt} width={width} height={height} src="/ho/staff/__m1_assets/pino-logo.png"/>}`,
 "next/navigation":`export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(){throw Error("Local-only navigation")},replace(){throw Error("Local-only navigation")},refresh(){location.reload()}});export const redirect=()=>{throw Error("Local-only navigation")};`,
 "next/dynamic":`export default function dynamic(){return function UnavailableLocalModule(){return null;}}`,
 "local-logout":`export function LogoutButton(){return <button type="button" disabled aria-label="Đăng xuất không khả dụng trong M1">↪</button>}`
};
const result=await build({entryPoints:["scripts/native-m1-local/staff-entry.tsx"],outfile:join(output,"app.js"),bundle:true,platform:"browser",format:"iife",jsx:"automatic",minify:true,metafile:true,define:{"process.env.NODE_ENV":JSON.stringify("production")},plugins:[{name:"local-presentation-boundary",setup(b){
 b.onResolve({filter:/^next\/(link|image|navigation|dynamic)$/},args=>({path:args.path,namespace:"local-only"}));
 b.onResolve({filter:/^@\/app\/components\/tos-shell\/LogoutButton$/},()=>({path:"local-logout",namespace:"local-only"}));
 b.onLoad({filter:/.*/,namespace:"local-only"},args=>({contents:shim[args.path],loader:"jsx",resolveDir:root}));
}}]});
for(const required of ["app/ho/staff/StaffManualWorkspace.tsx","app/ho/staff/StaffManualCreateDrawer.tsx","app/ho/staff/manual-create-contract.ts","app/ho/staff/manual-create-preview.ts","app/ho/staff/staff-activation-preview.ts","app/ho/staff/StaffActivationAction.tsx","app/ho/staff/StaffRegistrationQueue.tsx","app/ho/staff/staff-registration-queue-contract.ts","app/ho/staff/StaffRegistrationFinalization.tsx","app/ho/staff/StaffAccessPresentation.tsx","app/ho/staff/StaffPasswordResetPresentation.tsx","app/ho/staff/StaffProfilePresentation.tsx","app/ho/staff/staff-profile-local.ts","app/ho/staff/staff-account-inline-sample.ts","app/ho/staff/staff-record-sample.ts","app/ho/staff/StaffAccessControls.tsx","app/ho/staff/staff-access-fixture-port.ts","app/ho/staff/staff-access-admission.ts","app/ho/staff/staff-local-route-state.ts","app/ho/staff/StaffRateSample.tsx","app/ho/staff/staff-rate-local-action.ts","app/ho/staff/StaffAccessScenario.tsx","app/ho/staff/staff-access-scenario.ts","app/ho/staff/staff-access-presentation-model.ts","app/ho/staff/staff-finalization-directory-preview.ts","app/bo/components/registration/BoRegistrationWorkspace.tsx"])if(!Object.keys(result.metafile.inputs).some(p=>p.replaceAll("\\","/")===required))throw Error("Native source not bundled: "+required);
if(!existsSync(join(output,"app.css")))throw Error("Native CSS missing");
writeFileSync(join(output,"index.html"),'<!doctype html><html lang="vi" data-surface="ho"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Staff · M1</title><link rel="stylesheet" href="'+assets+'app.css"></head><body><div id="root"></div><script src="'+assets+'app.js"></script></body></html>');
const spec={jiraTask:"PAP-2418",epicCode:"WFM-STAFF",surface:"ho",reviewUrl:"http://desktop-isrdren:8800/ho/staff",sourceRevision:revision,fixtureId:"STAFF-MOCK-001",sourceFiles:{route:"app/ho/staff/page.tsx",renderer:"app/ho/staff/StaffManualWorkspace.tsx",schema:"app/ho/staff/manual-create-contract.ts",fixture:"app/ho/staff/staff-activation-preview.ts"}};
const registration=createRegistration(spec,revision,path=>git("show",revision+":"+path),readAssets(output));
const receipt=output+"-registration.json";writeFileSync(receipt,JSON.stringify(registration,null,2));
console.log(JSON.stringify({output,receipt,revision,artifact:registration.artifact.sha256,servingVerified:false}));
