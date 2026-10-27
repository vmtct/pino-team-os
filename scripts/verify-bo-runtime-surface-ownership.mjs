/** PAP-1050: fail-closed BO module ownership and served-route parity. */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
export function verifyBoRuntimeSurfaceOwnership(root=ROOT,overrides={}) {
 const issues=[];
 const read=file=>own(overrides,file)?overrides[file]:fs.readFileSync(path.join(root,file),"utf8");
 let manifest;
 try{manifest=JSON.parse(read("app/bo/architecture/bo-runtime-surface-ownership.json"))}
 catch(e){return {ok:false,issues:["Manifest unavailable: "+String(e)]}};
 if(manifest.version!==1||!manifest.modules||!manifest.specialized)issues.push("Invalid ownership manifest");
 const school=read("public/bo-authority-source/school-adapters.js");
 const sections=[school.match(/const modules=\{([\s\S]*?)\n \};/)?.[1]||"",school.match(/const definitions=\{([\s\S]*?)\n \};/)?.[1]||""];
 const schoolKeys=new Set(sections.flatMap(s=>[...s.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*):\s*(?:\{|\[)/gm)].map(m=>m[1])));
 const factoryKeys=new Set([...read("app/bo/architecture/registry.ts").matchAll(/defineBoModule\(\{\s*key:\s*"([^"]+)"/g)].map(m=>m[1]));
 if(schoolKeys.size<9||factoryKeys.size<4)issues.push("Module inventory cannot be parsed");
 const all=new Set([...schoolKeys,...factoryKeys]),mods=manifest.modules||{};
 const grandfatheredGeneric=new Set(["students","classes","enrollments","parents","visits","staffs","timekeeping","salaryPeriods","audits"]);
 for(const key of all)if(!own(mods,key))issues.push("New module has no UI owner: "+key);
 for(const key of Object.keys(mods))if(!all.has(key))issues.push("Stale/unregistered module: "+key);
 for(const [key,owner] of Object.entries(mods)){
  if(!["generic","specialized","factory"].includes(owner))issues.push("Invalid owner "+key);
  if(owner==="generic"&&!grandfatheredGeneric.has(key))issues.push("New generic UI owner forbidden: "+key+" — use factory or specialized with explicit runtime contract");
  if(owner==="factory"&&!factoryKeys.has(key))issues.push("Fake factory owner "+key);
  if(owner==="generic"&&factoryKeys.has(key))issues.push("Factory module falling back to generic "+key);
  if(owner==="specialized"&&!own(manifest.specialized,key))issues.push("Specialized module missing contract "+key);
 }
 const entry=read("app/bo/components/registration/BoRuntimeBoundary.tsx");
 const workspace=read("app/bo/components/registration/BoRegistrationWorkspace.tsx");
 const middleware=read("middleware.ts");
 const policy=read("app/bo/architecture/bo-staging-route-policy.ts");
 if(!workspace.includes("content ? content : detail ?")||!workspace.includes("if (content) { document.title"))issues.push("Canonical shell missing specialized content support");
 if(policy.match(/boStagingAdmittedRoutes = new Set\(\[[\s\S]*?"\/bo\/subscriptions"/))issues.push("Standalone Subscription route illegally admitted");
 for(const [key,c] of Object.entries(manifest.specialized||{})){
  if(mods[key]!=="specialized"||!c||!c.component||!c.marker||!c.uiAnchor||!c.canonicalUrl||!c.legacyAlias){issues.push("Incomplete specialized ownership for "+key);continue;}
  if(c.canonicalUrl!=="/bo?module="+encodeURIComponent(key))issues.push("Wrong canonical module URL "+key);
  if(c.legacyAlias!=="/bo/"+key)issues.push("Wrong legacy alias "+key);
  const file=c.component;
  if(!own(overrides,file)&&!fs.existsSync(path.join(root,file))){issues.push("Missing specialized UI "+key);continue;}
  const ui=read(file);
  if(!ui.includes('data-bo-runtime-surface="'+c.marker+'"'))issues.push("Specialized UI marker missing "+key);
  if(!ui.includes("SubscriptionHistoryGrid")||!ui.includes("SubscriptionCreateDrawer"))issues.push("Specialized table/form absent "+key);
  // PAP-1081: one menu-owner contract. The embedded owner must receive the
  // canonical Workspace menu factory, not merely mount inside the shell.
  const ownerSlot='renderContent={moduleKey === "'+key+'" ? mobileMenu => <BoSubscriptionsView embedded mobileMenu={mobileMenu} /> : undefined}';
  const menuFromWorkspace=workspace.includes("renderContent ? renderContent(menu) : content ? content : detail ?");
  const listMenu=ui.includes('mobileMenu?.("subscription-menu-btn")');
  const detailMenu=ui.includes('mobileMenu={mobileMenu?.("subscription-detail-menu-btn") ?? null}');
  if(!entry.includes(ownerSlot)||!menuFromWorkspace||!listMenu||!detailMenu)issues.push("Specialized UI orphaned from canonical /bo menu/owner shell "+key);
  if(!middleware.includes('isBoStagingHost(host) && (request.nextUrl.pathname === "/bo/subscriptions"')||!middleware.includes('target.searchParams.set("module", "subscriptions")'))issues.push("Legacy URL does not canonicalize on staging "+key);
  if(!read("app/bo/subscriptions/SubscriptionCreateDrawer.tsx").includes('id="'+c.uiAnchor+'"'))issues.push("Create anchor absent "+key);
 }
 if(!read("lib/bo-sidebar-routes.ts").includes('"subscriptions"'))issues.push("Module excluded from BO sidebar URL whitelist");
 return {ok:issues.length===0,issues,owned:Object.keys(mods).length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const v=verifyBoRuntimeSurfaceOwnership();
 if(v.ok)console.log("BO_RUNTIME_PARITY_PASS: "+v.owned+" modules");
 else {for(const e of v.issues)console.error("BO_RUNTIME_PARITY_FAIL: "+e);process.exitCode=1;}
}
