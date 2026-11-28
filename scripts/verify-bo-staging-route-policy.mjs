/** PAP-901: fail CI when a canonical BO route has no explicit staging decision. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mountsExactNamedComponent, mountsPayrollNativeTable } from "./bo-route-import-guard.mjs";
import { isFounderMigratedBoAvatarNativeDsaRoute } from "./verify-tdd-authority.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLICY = "app/bo/architecture/bo-staging-route-policy.ts";
const LAYOUT = "app/bo/layout.tsx";
const CI = ".github/workflows/pr-validation.yml";
const read = (root, file) => fs.readFileSync(path.join(root, file), "utf8");

function policyRoutes(source, name, issues) {
  const match = source.match(new RegExp(`\\bconst\\s+${name}\\s*=\\s*new Set(?:<string>)?\\s*\\(\\s*(\\[[\\s\\S]*?\\])\\s*\\);`));
  if (!match) { issues.push(`Missing literal ${name}`); return new Set(); }
  let routes;
  try { routes = JSON.parse(match[1].replace(/,\s*\]$/, "]")); }
  catch { issues.push(`${name} must contain only JSON string literals`); return new Set(); }
  if (!Array.isArray(routes) || routes.some(route => typeof route !== "string" || !(/^\/bo\/[a-z0-9-]+$/.test(route) || (route === "/bo/sales/leads" || route === "/bo/workforce/staffs")))) {
    issues.push(`${name} must be a literal Set of BO route strings`);
    return new Set();
  }
  if (new Set(routes).size !== routes.length) issues.push(`Duplicate route in ${name}`);
  return new Set(routes);
}

/** TDD_DEFAULT is a separate, exact, schema-registered BO entry lane.
 * It is independently enforced by scripts/verify-tdd-authority.mjs (G0/G1).
 * Neither an unregistered file nor a grandfathered route grants admission. */
function tddRoutes(root, issues) {
  const file=path.join(root,"config/tdd-admission.json");
  if(!fs.existsSync(file))return new Set();
  let manifest;
  try {manifest=JSON.parse(fs.readFileSync(file,"utf8"));}
  catch {issues.push("Malformed TDD route admission manifest");return new Set();}
  if(!Array.isArray(manifest.modules)){issues.push("TDD route admission modules must be an array");return new Set();}
  const routes=new Set();
  for(const m of manifest.modules.filter(x=>x.surface==="BO"&&x.profile==="TDD_DEFAULT")){
    const route=m.route,routeFile=m.file;
    const files=[routeFile,m.schema?.file,m.binding?.file,...(m.tests||[])];
    if(typeof m.key!=="string"||!/^[a-z][a-z0-9-]*$/.test(m.key)||route!=="/bo/"+m.key||
      routeFile!=="app/bo/"+m.key+"/page.tsx"||m.binding?.kind!=="SURFACE_WORKSPACE_ADAPTER"||
      !Array.isArray(m.files)||!m.files.includes(routeFile)||!m.files.includes(m.schema?.file)||
      !m.files.includes(m.binding?.file)||!Array.isArray(m.tests)||m.tests.length===0||
      files.some(f=>typeof f!=="string"||f.includes("..")||f.startsWith("/")||!fs.existsSync(path.join(root,f)))||
      routes.has(route)) {issues.push("Invalid exact BO TDD route admission: "+String(route));continue;}
    routes.add(route);
  }
  return routes;
}
const nativePayrollEntries = [
 {key:"payroll-daily",view:"BoPayrollDailyReadView",detail:"[staffMemberId]/[workDate]/BoPayrollDailyDetail.tsx",client:"lib/bo-payroll-daily-api.ts",test:"lib/bo-payroll-daily-read-contract.test.ts"},
 {key:"payroll-exceptions",view:"BoPayrollExceptionsReadView",detail:"[requestId]/BoPayrollExceptionDetail.tsx",client:"lib/bo-payroll-exceptions-read.ts",test:"lib/bo-payroll-exceptions-model.test.ts"},
];
function nativePayrollRoutes(root,issues){
 const out=new Set();
 for(const e of nativePayrollEntries){
  const base="app/bo/"+e.key+"/",page=base+"page.tsx";
  if(!fs.existsSync(path.join(root,page)))continue;
  const files=[page,base+e.view+".tsx",base+e.detail,e.client,e.test,"lib/bo-native-payroll-route.ts","lib/pap1970-native-payroll-route.test.ts"];
  if(files.some(f=>!fs.existsSync(path.join(root,f)))){issues.push(e.key+": missing native read-only route contract");continue;}
  const [p,v,d,c]=files.map(f=>read(root,f));
  if(!p.includes("<"+e.view)||!p.includes("PAP-1970")||!mountsPayrollNativeTable(root,base+e.view+".tsx",v,"PayrollDsaReadTable","../payroll-periods/PayrollNativeTable")||!mountsExactNamedComponent(base+e.view+".tsx",v,"@/app/bo/components/registration/BoQuickView","BoQuickView")||
     !v.includes("useBoCenterSelection")||!d.includes("BoFullDetail")||!d.includes("useBoCenterSelection")||
     !c.includes("same-origin")||!c.includes("no-store")||[p,v,d].some(x=>/BoModuleFactory|BoWorkforceRoute|defineTddModule|SurfaceWorkspace/.test(x))||
     /method:\s*["'](?:POST|PATCH|PUT|DELETE)["']/.test(c)){issues.push(e.key+": invalid native read-only route contract");continue;}
  out.add("/bo/"+e.key);
 }
 return out;
}
/** PAP-1886: exact read-only Accounts page using shared native BO DSA primitives. */
function nativeAfterschoolAccountsRoute(root, issues) {
  const base = "app/bo/afterschool-accounts/";
  const page = base + "page.tsx";
  if (!fs.existsSync(path.join(root, page))) return false;
  const files = [page, base + "AfterschoolAccounts.tsx", "lib/host-boundary.ts", "lib/host-boundary.test.ts"];
  if (files.some(file => !fs.existsSync(path.join(root, file)))) {
    issues.push("/bo/afterschool-accounts: missing native read-only route contract");
    return false;
  }
  const [entry, view, host, test] = files.map(file => read(root, file));
  if (!entry.includes("<AfterschoolAccounts />") || !view.includes("PAP-1886") ||
      !view.includes("<BoDataTable") || !view.includes("<BoQuickView") ||
      !view.includes("useBoCenterSelection") || !view.includes("/api/bo/identity/afterschool-users?") ||
      !view.includes("data?.scopeCenterId !== centerId") || !view.includes('cache: "no-store"') ||
      !host.includes('pathname === "/bo/afterschool-accounts"') ||
      !test.includes("PAP-1886 native Accounts page is BO Staging and session gated") ||
      [entry, view].some(source => /BoModuleFactory|BoWorkforceRoute|defineTddModule|SurfaceWorkspace/.test(source)) ||
      /method:\s*["'](?:POST|PATCH|PUT|DELETE)["']/.test(view)) {
    issues.push("/bo/afterschool-accounts: invalid native read-only route contract");
    return false;
  }
  return true;
}

/** PAP-767 exact native opening-evidence contract, never a wildcard exemption. */
function nativeOpeningEvidenceRoute(root,issues){
 const base="app/bo/opening-evidence/";
 const files=[base+"page.tsx",base+"OpeningEvidenceStageGate.tsx",base+"[subjectType]/[receiptId]/page.tsx",
   base+"[subjectType]/[receiptId]/OpeningEvidenceDetail.tsx","lib/bo-opening-evidence-api.ts",
   "lib/bo-opening-evidence-handler.ts","lib/opening-evidence-host-contract.ts","lib/opening-evidence-host-contract.test.ts",
   "lib/pap764-opening-evidence-nav.test.ts","lib/host-boundary.ts","app/bo/shell/BoApplicationShell.tsx"];
 const policy=read(root,POLICY);
 if(!policy.includes('"/bo/opening-evidence"'))return false;
 if(files.some(f=>!fs.existsSync(path.join(root,f)))){issues.push("opening-evidence: missing exact native route contract");return false;}
 const [p,v,dp,d,c,h,host,,,boundary,shell]=files.map(f=>read(root,f));
 const ok=p.includes("PAP-764")&&p.includes("<OpeningEvidenceStageGate")&&p.includes('host !== "bo.staging.pinohouse.art"')&&
   v.includes('import {BoDataTable} from "@/app/bo/components/registration/BoDataTable"')&&v.includes('import {BoQuickView} from "@/app/bo/components/registration/BoQuickView"')&&
   /<BoDataTable\b/.test(v)&&/<BoQuickView\b/.test(v)&&v.includes("useBoCenterSelection")&&v.includes("scope.centers.some(center=>center.id===scope.selected)")&&
   v.includes("openingEvidenceApi.list({centerId,offset,limit")&&v.includes("response?.key===key")&&v.includes("allowed&&validRange")&&
   !/BoDataGridSidePeek|BoCenterSelectionProvider|opening-shell-data|installOpeningFixture/.test(v)&&
   dp.includes('host!=="bo.staging.pinohouse.art"')&&dp.includes("<OpeningEvidenceDetail")&&
   d.includes("BoFullDetail")&&d.includes("useBoCenterSelection")&&d.includes("openingEvidenceApi.review")&&
   c.includes("same-origin")&&c.includes("no-store")&&h.includes("teamCredential")&&h.includes("callBoAccessCoreWithCredential")&&
   host.includes("openingEvidenceBoModule")&&boundary.includes("openingEvidenceHostDecision(hostname, pathname, method)")&&
   shell.includes('"opening-evidence":')&&shell.includes("openingEvidenceBoModule(pathname)")&&policy.includes("openingEvidenceBoModule(path)")&&
   [p,v,dp,d].every(x=>!/BoModuleFactory|BoWorkforceRoute|defineTddModule|SurfaceWorkspace/.test(x));
 if(!ok)issues.push("opening-evidence: invalid native scoped route contract");
 return ok;
}
/** PAP-2032: exact native Wish Event Staging entry and authorized Center-scoped Core adapter. */
function nativeWishEventRoute(root,issues){
 const route="/bo/pinoria-wish-events";
 if(!read(root,POLICY).includes('"'+route+'"'))return false;
 const files=["app/bo/pinoria-wish-events/page.tsx","app/bo/pinoria-wish-events/BoWishRuntime.tsx","app/bo/pinoria-wish/BoWishEventCatalog.tsx","app/bo/pinoria-wish/BoWishEventDetail.tsx","lib/bo-pls-wish-handler.ts","lib/bo-pls-wish-host-contract.ts","lib/host-boundary.ts","lib/bo-pls-wish-handler.test.ts","app/api/bo/pinoria/pls-wish/events/[[...path]]/route.ts"];
 if(files.some(f=>!fs.existsSync(path.join(root,f)))){issues.push("Wish Events: missing native scoped route contract");return false;}
 const sources=files.map(f=>read(root,f));
 const required=[[0,"!==\"bo.staging.pinohouse.art\")notFound()"],[0,"<BoWishRuntime/>"],[1,"useBoCenterSelection"],[1,"s.centers.some(c=>c.id===s.selected)"],[1,"credentials:\"same-origin\""],[1,"cache:\"no-store\""],[1,"r.permissionKeys.includes(\"pinoria.wish_event.view\")"],[1,"current.actor!==actor||!current.invalidate"],[1,"current.actor!==cap.actor"],[1,"attempt.body.centerId!==centerId"],[1,"<BoWishEventCatalog"],[2,"import {BoDataTable} from \"@/app/bo/components/registration/BoDataTable\""],[2,"<BoDataTable"],[2,"parseBoWishDetail(raw,centerId,detailId)"],[3,"import {BoQuickView} from \"@/app/bo/components/registration/BoQuickView\""],[3,"<BoQuickView"],[3,"<DetailFrame"],[4,"env.APP_ENV!==\"staging\""],[4,"teamCredential(r,env,\"BO\")"],[4,"credential.kind===\"support\""],[4,"callBoAccessCoreWithCredential"],[4,"value.userId!==r.headers.get(\"x-pino-expected-actor\")"],[4,"const outbound:BoAccessRequest={method:m,path:[\"pinoria/pls-wish/events\",...path].join(\"/\"),resource:{centerId}};"],[5,"host===\"bo.staging.pinohouse.art\""],[5,"path===\"/bo/pinoria-wish-events\""],[6,"boPlsWishHostDecision(hostname,pathname,method)"],[7,"BO reward media is GET-only, actor fenced, event and ordinal scoped"],[8,"handleBoPlsWishEvent"]];
 const valid=required.every(([index,needle])=>sources[index].includes(needle))&&sources.slice(0,4).every(x=>!/BoModuleFactory|BoWorkforceRoute|defineTddModule|BoDataGridSidePeek|BoCenterSelectionProvider/.test(x));
 if(!valid)issues.push("Wish Events: invalid native scoped route contract");
 return valid;
}

/** PAP-2286: exact native Lead route, gated by server ACL; legacy experience remains production-only. */
function nativeLeadsRoute(root, issues) {
  const files = ["app/bo/sales/leads/page.tsx", "app/bo/sales/leads/SalesLeadPipelineView.tsx", "app/bo/shell/BoApplicationShell.tsx", "lib/pap901-staging-routes.test.ts"];
  if (files.some(file => !fs.existsSync(path.join(root, file)))) { issues.push("Leads: missing native route contract"); return false; }
  const [page, view, shell, test] = files.map(file => read(root, file));
  const valid = page.includes('await authorizeBoShell(') &&
    page.includes('actor.permissionKeys.includes("acquisition.lead.manage")') &&
    page.includes('APP_ENV === "staging"') && page.includes('return <NativeLeadEntry actorId={actor.userId}/>;') &&
    page.includes('canonicalLeadStageQuery(raw)') && page.includes('resolveLegacyLeadIntent(env.PINO_BO_CORE,credential,actor.userId,query.leadIntent)') && !page.includes('LeadHouseholdM1Preview') && page.includes('return <SalesLeadPipelineView />;') &&
    view.includes('return <SalesLeadIntentPipelineView />;') && !view.includes('LeadHouseholdM1Preview') &&
    shell.includes('"sales/leads": { label: "Leads"') && shell.includes('Object.hasOwn(directModules, key) ? "/bo/" + key') &&
    !shell.includes('/bo/sales/leads?m1Preview=1') &&
    test.includes('isBoStagingRouteAdmitted("/bo/sales/leads"),true') &&
    !/<BoModuleFactory|<BoWorkforceRoute/.test(page);
  if (!valid) issues.push("Leads: invalid exact native staging route contract");
  return valid;
}

/** PAP-1044 / PAP-2225: exact authenticated live Running Classes workspace; M1 staging fixture retired. */
function nativeRunningClassesRoute(root,issues){
 const route="/bo/running-classes",base="app/bo/running-classes/";
 if(!read(root,POLICY).includes('"'+route+'"'))return false;
 const files=[base+"page.tsx",base+"RunningClassNativeEntry.tsx",base+"running-class-stage-admission.ts",base+"running-class-provider.ts",base+"running-class-stage-admission.test.ts"];
 if(files.some(f=>!fs.existsSync(path.join(root,f)))){issues.push(route+": missing exact native live contract");return false;}
 const [page,live,phase,provider]=files.map(f=>read(root,f));
 const required=[
 [page,'if(env.APP_ENV==="staging"||isBoStagingHost(host)){if(host!=="bo.staging.pinohouse.art"||!boSkeletonEnabled(env,host))notFound();}'],
 [page,'else return <BoOperationalView view="running-classes"/>;'],
 [page,'if(parseRunningClassStageQuery(runningClassSearchParams(await searchParams))===null)notFound();'],
 [page,'const actor=await authorizeBoShell(new Headers(incoming),env).catch(()=>forbidden());'],
 [page,'return <RunningClassNativeEntry expectedActorId={actor.userId}/>;'],
 [phase,'return parseRunningClassLiveQuery(input,legacy);'],
 [live,'if(!selected||!center.centers.some(c=>c.id===selected))return <RecordState status="denied"/>;'],
 [live,'fetcher("/api/bo/context?centerId="+encodeURIComponent(centerId),{method:"GET"})'],
 [live,'if(!body.data||body.data.userId!==expectedActorId)'],
 [live,'openRunningClassProvider({centerId,expectedActorId,context,selectedCenter:()=>abort.signal.aborted?"":centerId,fetcher,storage:window.sessionStorage})'],
 [live,'runningClassLive:provider'],
 [live,'return()=>{abort.abort();opened?.dispose();};'],
 [live,'<BoRegistrationWorkspace source={session.source} moduleKey="classes" options={options} currentUser={user}/>'],
 [provider,'current.userId!==actorId'],
 [provider,'current.permissionKeys?.includes("delivery.schedule.manage")'],
 [provider,'current.permissionKeys?.includes("membership.subscription.view")'],
 [provider,'if(write&&!writable)return fail("Running Class is read-only.");']
 ];
 const valid=mountsExactNamedComponent(files[0],page,"./RunningClassNativeEntry","RunningClassNativeEntry")&&
 mountsExactNamedComponent(files[1],live,"../components/registration/BoRegistrationWorkspace","BoRegistrationWorkspace")&&
 required.every(([source,needle])=>source.includes(needle))&&
 !fs.existsSync(path.join(root,base+"RunningClassStagingEntry.tsx"))&&
 !/RunningClassStagingEntry|RUNNING_CLASS_LIVE_ADMISSION|createRunningClassReview/.test(page+live)&&
 !/parseRunningClassReviewQuery|RUNNING_CLASS_LIVE_ADMISSION/.test(phase);
 if(!valid)issues.push(route+": invalid native scoped live contract");
 return valid;
}

/** PAP-2387/PAP-2389: exact authenticated native Parent live route. */
function nativeParentRoute(root,issues){
 const route="/bo/parents";
 if(!read(root,POLICY).includes('"'+route+'"'))return false;
 const files=["app/bo/parents/page.tsx","app/bo/parents/ParentStagingEntry.tsx","app/bo/parents/ParentDirectoryDsa.tsx","app/bo/parents/parent-live-context.tsx","app/bo/parents/parent-m1-context.tsx","app/bo/parents/parent-native-data.ts","app/bo/parents/parent-route.ts","app/bo/parents/ParentCreateDrawer.tsx","app/bo/components/registration/BoParentReadTabs.tsx","lib/pap2387-parent-staging-boundary.test.ts","lib/pap2389-parent-route.test.ts","app/bo/parents/parent-create-retry.ts"];
 if(files.some(f=>!fs.existsSync(path.join(root,f)))){issues.push(route+": missing exact native Parent live contract");return false;}
 const source=files.map(f=>read(root,f));
 const [page,view,native,scope,local,access,query]=source;
 const required=[[0,"host!==\"bo.staging.pinohouse.art\"||env.APP_ENV!==\"staging\"||!boSkeletonEnabled(env,host)"],[0,"if(!canonicalParentRoute(query))notFound()"],[0,"await authorizeBoShell(new Headers(incoming),env)"],[0,"if(!actor.permissionKeys.includes(\"identity.parent_directory.view\"))forbidden()"],[0,"actorId={actor.userId} actorEmail={actor.email}"],[1,"user.email!==actorEmail"],[1,"!center.centers.some(c=>c.id===selected)"],[1,"loadNativeParentLiveGrants(scope,ctl.signal)"],[1,"if(state!==\"ready\")return <RecordState status={state}/>"],[1,"<ParentLiveScope.Provider value={scope}>"],[1,"load:async()=>{throw Error(\"Parent owns scoped native record transport\")"],[1,"content={<ParentDirectoryDsa/>}"],[3,"createContext<NativeParentLiveScope|null>(null)"],[4,"self.origin!==\"null\""],[5,"loadNativeParentContext(scope.centerId,signal,fetcher,scope.actorId)"],[5,"scope.canCreate&&grants.has(\"identity.parent.create\")"],[5,"scope.canEdit&&grants.has(\"identity.parent.edit\")"],[5,"raw.userId !== expectedActorId"],[5,"grants.has(\"identity.parent_directory.view\")"],[5,"scopes.centers.some(c => c.id === centerId)"],[2,"liveScope.centerId!==centerId"],[2,"return loadNativeParentLiveGrants(liveScope,signal)"],[2,"return loadNativeParentDirectory(centerId,ctl.signal)"],[2,"const current=fixture?grants:await reattest(ctl.signal)"],[7,"liveScope.centerId!==attempt.centerId"],[7,"await loadNativeParentLiveGrants(liveScope,ctl.signal)"],[7,"parentCreateMayEdit(previouslyUncertain,true)"],[8,"await loadNativeParentLiveGrants(liveScope,controller.signal)"],[8,"new URLSearchParams({centerId:liveScope.centerId})"],[6,"export const PARENT_ROUTE = \"/bo/parents\""],[6,"!uuid.test(value)"],[11,"return !previouslyUncertain&&definiteRejection"]];
 const valid=mountsExactNamedComponent(files[0],page,"./ParentStagingEntry","ParentStagingEntry")&&
 mountsExactNamedComponent(files[1],view,"../components/registration/BoRegistrationWorkspace","BoRegistrationWorkspace")&&
 mountsExactNamedComponent(files[1],view,"./ParentDirectoryDsa","ParentDirectoryDsa")&&
 mountsExactNamedComponent(files[2],native,"@/app/bo/components/registration/BoDataTable","BoDataTable")&&
 mountsExactNamedComponent(files[2],native,"@/app/bo/components/registration/BoQuickView","BoQuickView")&&
 required.every(([index,needle])=>source[index].includes(needle))&&
 ![page,view].some(s=>/ParentStagingFixtureProvider|ParentM1Provider|createParentFixture|ephemeral\s*:\s*true|BoModuleFactory|BoWorkforceRoute|BoLocalReviewCenter|localStorage\.|sessionStorage\.|method:\s*["'](?:POST|PATCH|PUT|DELETE)["']/.test(s))&&
 !local.includes("ParentStagingFixtureProvider")&&!query.includes("PARENT-MOCK");
 if(!valid)issues.push(route+": invalid exact native Parent live contract");
 return valid;
}

function canonicalRoutes(root, issues) {
  const base = path.join(root, "app/bo");
  const routes = new Set();
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name === "page.tsx" && /<BoModuleFactory\b|<BoWorkforceRoute\b/.test(fs.readFileSync(full, "utf8"))) {
        const relative = path.relative(base, dir).replaceAll(path.sep, "/");
        routes.add(`/bo/${relative}`);
      }
    }
  }
  visit(base);
  const tdd=tddRoutes(root,issues);
  for(const route of tdd)routes.add(route);
  // PAP-1810 / PNR-AVATAR-CRUD: exact Founder-directed native BO DSA
  // migration; only the validated existing Avatar route is admitted.
  const native=new Set();
  if(!tdd.has("/bo/pinoria-avatars") &&
    isFounderMigratedBoAvatarNativeDsaRoute(root,{
      file:"app/bo/pinoria-avatars/page.tsx",
      route:"/bo/pinoria-avatars",key:"pinoria-avatars",surface:"BO",profile:"TDD_DEFAULT"
    })) {
    routes.add("/bo/pinoria-avatars");
    native.add("/bo/pinoria-avatars");
  }
  for(const route of nativePayrollRoutes(root,issues)){routes.add(route);native.add(route);}
  if (nativeAfterschoolAccountsRoute(root,issues)) {
    routes.add("/bo/afterschool-accounts");
    native.add("/bo/afterschool-accounts");
  }
  if(nativeOpeningEvidenceRoute(root,issues)){routes.add("/bo/opening-evidence");native.add("/bo/opening-evidence");}
  if(nativeRunningClassesRoute(root,issues)){routes.add("/bo/running-classes");native.add("/bo/running-classes");}
  if(nativeParentRoute(root,issues)){routes.add("/bo/parents");native.add("/bo/parents");}
  const staffRoute="/bo/workforce/staffs";
  const staffPage="app/bo/workforce/staffs/page.tsx";
  if(fs.existsSync(path.join(root,staffPage))||read(root,POLICY).includes(JSON.stringify(staffRoute))){
    const files=[staffPage,"app/bo/workforce/staffs/staff-directory-route.ts","app/bo/page.tsx","app/bo/shell/BoApplicationShell.tsx","lib/host-boundary.ts","lib/bo-staging-return-to.ts","lib/pap2411-staff-directory-route.test.ts"];
    if(files.some(f=>!fs.existsSync(path.join(root,f))))issues.push(staffRoute+": missing exact Staff route contract");
    else {
      const [page,query,alias,shell,host,ret,tests]=files.map(f=>read(root,f));
      const valid=mountsExactNamedComponent(staffPage,page,"../../components/registration/BoRuntimeBoundary","BoRuntimeEntry")&&
        page.includes("host !== BO_STAGING_HOSTNAME")&&page.includes('env.APP_ENV !== "staging"')&&page.includes("!boSkeletonEnabled(env,host)")&&
        page.includes("canonicalStaffDirectoryRoute(query)")&&page.includes('moduleKey="staffs"')&&
        query.includes(JSON.stringify(staffRoute))&&alias.includes("canonicalStaffDirectoryRoute(query,true)")&&
        shell.includes(JSON.stringify(staffRoute))&&host.includes(JSON.stringify(staffRoute))&&ret.includes("canonicalStaffDirectoryRoute")&&
        tests.includes("PAP-2411 exact Staging GET/HEAD admission only");
      if(!valid)issues.push(staffRoute+": invalid exact Staff route contract");
      else {routes.add(staffRoute);native.add(staffRoute);}
    }
  }
  if(nativeWishEventRoute(root,issues)){routes.add("/bo/pinoria-wish-events");native.add("/bo/pinoria-wish-events");}
  if (fs.existsSync(path.join(root, "app/bo/sales/leads/page.tsx")) && read(root, POLICY).includes('"/bo/sales/leads"')) {
    if (nativeLeadsRoute(root, issues)) { routes.add("/bo/sales/leads"); native.add("/bo/sales/leads"); }
  }
  return {routes,tdd,native};
}

export function verifyBoStagingRoutePolicy(root = ROOT) {
  const issues = [];
  const admitted = policyRoutes(read(root, POLICY), "boStagingAdmittedRoutes", issues);
  const deferred = policyRoutes(read(root, POLICY), "boStagingDeferredRoutes", issues);
  const {routes:canonical,tdd,native} = canonicalRoutes(root,issues);
  for (const route of canonical) {
    if (admitted.has(route) === deferred.has(route))
      issues.push(`${route}: canonical BO route needs exactly one staging decision (admitted or deferred)`);
  }
  for (const route of [...admitted, ...deferred]) {
    if (!canonical.has(route)) issues.push(`${route}: staging policy must reference a canonical BoModuleFactory page`);
  }

  const layout = read(root, LAYOUT);
  const rootLayout = read(root, "app/layout.tsx");
  const unifiedSource = read(root, "app/bo/architecture/bo-unified-workspace-source.ts");
  const gateway = read(root, "app/bo/architecture/BoWorkforceRoute.tsx");
  if (!layout.includes('if (!isBoStagingRouteAdmitted(routePath) && routePath !== "/bo"') ||
      !layout.includes('<BoRuntimeBoundary currentUser=') ||
      /if\s*\(isBoStagingRouteAdmitted\(routePath\)\)[\s\S]*?<BoShell/.test(layout))
    issues.push("Staging admitted BO routes must use the same single React workspace as /bo; other routes remain denied");
  if (!layout.includes('from "./architecture/bo-staging-route-policy"'))
    issues.push("BO layout must use the canonical staging route policy");
  if (!rootLayout.includes('isBoStagingRouteAdmitted(path ?? "")') ||
      !rootLayout.includes("BO_AUTHORITY_STYLES") ||
      !rootLayout.includes('"/bo-skeleton/" + file'))
    issues.push("Admitted staging routes must load BO authority CSS in root layout");
  if (!unifiedSource.includes('boModuleRegistry.filter(def => isBoStagingRouteAdmitted(def.href))') ||
      !unifiedSource.includes('admittedModules.map(') ||
      !unifiedSource.includes('Staging module missing authorized adapter') ||
      !unifiedSource.includes('modules: { ...school.modules, ...moduleDefinitions }') ||
      !unifiedSource.includes('isModuleReadOnly: isWorkforce') ||
      !unifiedSource.includes('routeForModule:') ||
      !unifiedSource.includes('if (!options.centerId) throw Error(') ||
      !unifiedSource.includes('await adapters[key].list(fetcher, options.centerId)'))
    issues.push("Unified BO navigation and data must be registry-backed, authorized and read-only for Workforce");
  if (!gateway.includes("useBoStagingUser") ||
      !gateway.includes("unifiedBoWorkspaceSource") ||
      !gateway.includes("return <BoModuleFactory"))
    issues.push("Workforce pages must retain production fallback and staging BO workspace");
  for (const route of admitted) {
    if (!canonical.has(route)) continue;
    if(native.has(route)){
      // Exact native DSA feature keeps the same BO shell, staging policy,
      // real Core Center-scoped API and PINO DS; not the legacy Factory grid.
      continue;
    }
    if(tdd.has(route)){
      const file=read(root,"app/bo/"+route.slice("/bo/".length)+"/page.tsx");
      if(!/<[A-Za-z]*Tdd\b/.test(file)||/<\s*(table|BoDataGrid|BoDataGridSidePeek)(?=[\s/>])/.test(file))
        issues.push(route+": TDD entry must mount shared SurfaceWorkspace binding, not a custom table");
      continue; // TDD G0/G1 is an independently mandatory PR gate.
    }
    const key = route.slice("/bo/".length);
    const file = read(root, "app/bo/" + key + "/page.tsx");
    const pattern = new RegExp("<BoWorkforceRoute\\s+moduleKey=[\"']" + key + "[\"']");
    if (!pattern.test(file) || !file.includes("moduleAdapter"))
      issues.push(route + ": registered staging entrypoint must be wired to one canonical BO workspace");
  }
  const cd = read(root, ".github/workflows/candidate-staging-deploy.yml");
  if (!cd.includes("for css in team-legacy-global.css bo-legacy-foundation.css") ||
      !cd.includes('grep -qi "^content-type: text/css"') ||
      !cd.includes('"https://bo.staging.pinohouse.art/$css"'))
    issues.push("Automatic staging CD must smoke test both required CSS assets");
  if (!cd.includes("bo_host='https://bo.staging.pinohouse.art'") ||
      !cd.includes('"$bo_host/bo/$route"') ||
      !cd.includes("for route in workforce-term-weeks pinoria-world pinoria-ward pinoria-ward/sets system/users system/roles"))
    issues.push("PAP-1030 retired BO route smoke must target canonical BO staging host");
  const ci = read(root, CI);
  if (!ci.includes("node scripts/verify-bo-staging-route-policy.mjs") ||
      !ci.includes("node --test scripts/verify-bo-staging-route-policy.test.mjs"))
    issues.push("PR CI must enforce BO staging route policy and regressions");
  return { issues, canonical: canonical.size, admitted: admitted.size, deferred: deferred.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyBoStagingRoutePolicy();
  if (result.issues.length) {
    for (const issue of result.issues) console.error("BO_STAGING_ROUTE_FAIL:", issue);
    process.exitCode = 1;
  } else console.log(`BO_STAGING_ROUTE_PASS canonical=${result.canonical} admitted=${result.admitted} deferred=${result.deferred}`);
}
