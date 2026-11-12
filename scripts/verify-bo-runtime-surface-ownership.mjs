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
  // PAP-1853: native read-only Subscription has Table/Drawer/Detail, not the archived Sale Create form.
  if(c.deliveryState!=="center-read-only" && (!ui.includes("SubscriptionHistoryGrid")||!ui.includes("SubscriptionCreateDrawer")))
    issues.push("Specialized table/form absent "+key);
  // PAP-1853 (PAP-1491 is keeping): strictly serialize Subscription UI
  // authority from suspended hold to Center-owned READ-ONLY native PINO DSA.
  // Historical specialized source remains auditable, never mounted as writer.
  const suspended = key==="subscriptions" && c.deliveryState==="suspended" && c.suspensionIssue==="PAP-1334";
  const nativeRead = key==="subscriptions" && c.deliveryState==="center-read-only" &&
    c.approvalIssue==="PAP-1334" && c.guardKeeperIssue==="PAP-1853";
  // PAP-1882/PAP-1491: explicitly bound, narrow independent Sale admission.
  // The previous PAP-1334 Table/QuickView/Detail remains read-only; legacy writers stay forbidden.
  const saleAdmission=Boolean(nativeRead &&
    c.saleAdmission?.task==="PAP-1882" && c.saleAdmission?.epic==="PAP-1491" &&
    c.saleAdmission?.businessTask==="PAP-1350" &&
    c.saleAdmission?.payerReaderTask==="PAP-1871" &&
    c.saleAdmission?.mode==="center-bound-active-sale" &&
    c.saleAdmission?.createComponent==="app/bo/subscriptions/SubscriptionCreateDrawer.tsx" &&
    c.saleAdmission?.saleHelper==="lib/pap1882-independent-sale.ts");
  if(c.saleAdmission&&!saleAdmission)issues.push("PAP-1882 sale admission not in approved owner manifest");
  if(c.deliveryState!==undefined && !suspended && !nativeRead)
    issues.push("Unsupported specialized delivery state "+key);
  if(key==="subscriptions" && !suspended && !nativeRead)
    issues.push("Subscription requires explicit suspended or approved Center-read-only authority");
  if(nativeRead){
    const newComponent="app/bo/subscriptions/SubscriptionDirectoryDsa.tsx";
    const oldComponent="app/bo/subscriptions/BoSubscriptionsView.tsx";
    if(c.component!==newComponent||c.marker!=="subscription-center-read-only"||
      c.uiAnchor!=="subscription-center-read-only-root"||
      c.legacyComponent!==oldComponent||c.legacyMarker!=="subscriptions-core"||
      c.legacyUiAnchor!=="subscription-create-student-search")
      issues.push("PAP-1853 native Subscription ownership must use exact approved components");
    if(!ui.includes('id="subscription-center-read-only-root"')||
      !ui.includes('data-bo-runtime-surface="subscription-center-read-only"')||
      !ui.includes('data-pap1334-native-subscriptions="read-only"')||
      !ui.includes("useBoCenterSelection(")||
      !ui.includes("loadCenterSubscriptionDirectory(")||
      !ui.includes("assertCenterDetail(")||
      !ui.includes("readSubscriptionCenterDetail(")||
      !ui.includes("BoDataTable")||!ui.includes("BoQuickView")||
      !ui.includes("DetailFrame")||!ui.includes("PropertySections"))
      issues.push("PAP-1853 Center-owned Subscription read-only PINO DSA contract incomplete");
    // PAP-1882 permits ONLY the independently attested Sale Drawer, never a legacy writer,
    // second mounting point, direct unscoped command, or forged manifest admission.
    const createMounts=(ui.match(/<SubscriptionCreateDrawer\b/g)||[]).length;
    const admittedCreate=Boolean(saleAdmission && createMounts===1 &&
      ui.includes('import {SubscriptionCreateDrawer} from "./SubscriptionCreateDrawer"') &&
      ui.includes("boApi.scopeCatalog()") && ui.includes("onChanged={()=>{setRevision("));
    if(ui.includes("BoSubscriptionsView")||ui.includes("renewSubscription(")||
      ui.includes("createSubscription(")||ui.includes("endEnrollment(")||
      ui.includes("cancelSubscription(")||ui.includes("boApi.createBillingSale(")||
      (createMounts||ui.includes("SubscriptionCreateDrawer")||saleAdmission) && !admittedCreate)
      issues.push("PAP-1853 unsafe legacy Subscription writer leaked into native DSA");
    if(saleAdmission){
      const createPath=c.saleAdmission.createComponent,helperPath=c.saleAdmission.saleHelper;
      if(!own(overrides,createPath)&&!fs.existsSync(path.join(root,createPath))||
         !own(overrides,helperPath)&&!fs.existsSync(path.join(root,helperPath))){
        issues.push("PAP-1882 independent Sale source or helper missing");
      }else{
        const create=read(createPath),helper=read(helperPath);
        const requiredCreate=["useBoCenterSelection()","studentCenterApi.learners(",
          "studentCenterApi.learnerLifecycle(","eligibleSalePayers(centerId,selected.id,ctl.signal)",
          "boApi.createBillingSale(attempt.body,attempt.key)","buildIndependentSaleBody(",
          "assertIndependentSaleReadback(","payerScope?.centerId===centerId",
          "payerScope.studentId===selected.id",'data-pap1882-sale="independent"',
          "<DrawerFrame","<PropertySections"];
        const forbiddenCreate=["placeBulkEnrollments(","activateSubscription(",
          "renewSubscription(","createSubscription(","deferActivation: true"];
        const requiredHelper=["/api/bo/billing/sales/eligible-payers?",
          "validSaleCenter(","assertIndependentSaleReadback(","actual.centerId !== expected.centerId",
          'actual.lifecycle !== "ACTIVE"'];
        if(requiredCreate.some(x=>!create.includes(x))||forbiddenCreate.some(x=>create.includes(x))||
          requiredHelper.some(x=>!helper.includes(x)))
          issues.push("PAP-1882 exact Center-owned independent Sale/Parent/readback contract incomplete");
      }
    }
    const scoped="lib/pap1334-native-subscription-read.ts";
    if(!own(overrides,scoped)&&!fs.existsSync(path.join(root,scoped))){
      issues.push("PAP-1853 immutable Subscription owner read-model missing");
    }else{
      const adapter=read(scoped);
      if(!adapter.includes('"/api/bo/subscriptions/center-directory?"')||
        !adapter.includes("item.centerId!==centerId")||
        !adapter.includes("row.centerId!==centerId")||
        adapter.includes('return "/api/bo/subscriptions?"'))
        issues.push("PAP-1853 native Subscription model lacks persisted Center attestation");
    }
    if(!entry.includes('if (moduleKey === "subscriptions") return <BoRegistrationWorkspace')||
      !entry.includes('content={<SubscriptionDirectoryDsa />}')||
      !entry.includes('import("../../subscriptions/SubscriptionDirectoryDsa")')||
      entry.includes("<BoSubscriptionsView embedded />")||
      entry.includes("import { BoSubscriptionsView }")||
      entry.includes('data-testid="bo-subscription-center-contract-pending"'))
      issues.push("PAP-1853 only Center-authenticated native Subscription DSA may own BO runtime");
    if(!own(overrides,oldComponent)&&!fs.existsSync(path.join(root,oldComponent))){
      issues.push("PAP-1853 historical Subscription owner archive missing");
    }else if(!read(oldComponent).includes('data-bo-runtime-surface="subscriptions-core"')){
      issues.push("PAP-1853 historical Subscription source marker changed");
    }
    const legacyDrawer="app/bo/subscriptions/SubscriptionCreateDrawer.tsx";
    if(!read(legacyDrawer).includes('id="subscription-create-student-search"'))
      issues.push("PAP-1853 legacy Create anchor must stay archived for audit");
  }else if(suspended){
    if(!entry.includes('if (moduleKey === "subscriptions") return <BoRegistrationWorkspace') ||
      !entry.includes('data-testid="bo-subscription-center-contract-pending"') ||
      !entry.includes('content={<section role="status"') ||
      entry.includes("<BoSubscriptionsView embedded />") ||
      entry.includes("import { BoSubscriptionsView }"))
      issues.push("Suspended Subscription must fail-close legacy runtime "+key);
  }else if(!entry.includes('moduleKey === "'+key+'"')||
      !entry.includes("<BoSubscriptionsView embedded />"))
    issues.push("Specialized UI orphaned from /bo shell "+key);
  if(!nativeRead && !read("app/bo/subscriptions/SubscriptionCreateDrawer.tsx").includes('id="'+c.uiAnchor+'"'))
    issues.push("Create anchor absent "+key);
  if(!middleware.includes('isBoStagingHost(host) && (request.nextUrl.pathname === "/bo/subscriptions"')||!middleware.includes('target.searchParams.set("module", "subscriptions")'))issues.push("Legacy URL does not canonicalize on staging "+key);

 }
 const sidebar=read("lib/bo-sidebar-routes.ts");
 const urlContract=read("lib/bo-url-contract.ts");
 const legacyList=urlContract.match(/export const BO_LEGACY_QUERY_MODULES\s*=\s*\[([\s\S]*?)\]\s*as const/);
 const legacyKeys=legacyList ? [...legacyList[1].matchAll(/"([a-zA-Z][a-zA-Z0-9]*)"/g)].map(m=>m[1]) : [];
 if(!sidebar.includes('import { BO_LEGACY_QUERY_MODULES } from "./bo-url-contract"') ||
    !sidebar.includes("BO_SIDEBAR_MODULES: readonly string[] = BO_LEGACY_QUERY_MODULES") ||
    !legacyKeys.includes("subscriptions") ||
    new Set(legacyKeys).size !== legacyKeys.length)
   issues.push("Module excluded from BO sidebar URL whitelist");
 return {ok:issues.length===0,issues,owned:Object.keys(mods).length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const v=verifyBoRuntimeSurfaceOwnership();
 if(v.ok)console.log("BO_RUNTIME_PARITY_PASS: "+v.owned+" modules");
 else {for(const e of v.issues)console.error("BO_RUNTIME_PARITY_FAIL: "+e);process.exitCode=1;}
}
