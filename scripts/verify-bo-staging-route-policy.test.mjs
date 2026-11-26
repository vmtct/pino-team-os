import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyBoStagingRoutePolicy } from "./verify-bo-staging-route-policy.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = "app/bo/architecture/bo-staging-route-policy.ts";
const layout = "app/bo/layout.tsx";
const ci = ".github/workflows/pr-validation.yml";
const rootLayout = "app/layout.tsx";
const source = "app/bo/architecture/bo-unified-workspace-source.ts";
const gateway = "app/bo/architecture/BoWorkforceRoute.tsx";
const cd = ".github/workflows/candidate-staging-deploy.yml";
const pages = ["workforce-shift-plans", "workforce-availability", "workforce-assignments", "payroll-periods"];

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pap901-staging-routes-"));
  const write = (file, value) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
  };
  const read = file => fs.readFileSync(path.join(root, file), "utf8");
  for (const file of [policy, layout, rootLayout, source, gateway, cd, ci, ...pages.map(name => `app/bo/${name}/page.tsx`)]) {
    const content=fs.readFileSync(path.join(repo,file),"utf8");
    // Existing PAP-901 factory fixtures have no TDD manifest; keep scopes independent.
    write(file,file===policy?content.replace(/\r\n/g,"\n").replace('  "/bo/payroll-daily",\n',"").replace('  "/bo/payroll-exceptions",\n',"").replace('  "/bo/pinoria-avatars",\n',"").replace('  "/bo/afterschool-accounts",\n',"").replace('  "/bo/open-studio-passes",\n',"")
      .replace(/\s*"\/bo\/classroom-diaries",\r?\n/,"\n").replace('  "/bo/bills",\n',"").replace('  "/bo/missions",\n',"").replace('  "/bo/tvs",\n',"").replace('  "/bo/opening-evidence",\n',"").replace('  "/bo/piner-posts",\n',"").replace('  "/bo/sales/leads",\n',"").replace('  "/bo/pinoria-wish-events",\n',"").replace('  "/bo/mytime-guests",\n',"").replace('  "/bo/guests",\n',"").replace('  "/bo/mytime-workshops",\n',"").replace('  "/bo/enrollments",\n',"").replace('  "/bo/running-classes",\n',"").replace('  "/bo/parents",\n',""):content);
  }
  try { return run({ root, read, write }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("PAP-1970 native Payroll is explicit, read-only and does not re-enter TDD Engine",()=>fixture(({root,read,write})=>{
  const files=[
    "app/bo/payroll-daily/page.tsx",
    "app/bo/payroll-daily/BoPayrollDailyReadView.tsx",
    "app/bo/payroll-daily/[staffMemberId]/[workDate]/BoPayrollDailyDetail.tsx",
    "lib/bo-payroll-daily-api.ts",
    "lib/bo-payroll-daily-read-contract.test.ts",
    "lib/bo-native-payroll-route.ts",
    "lib/pap1970-native-payroll-route.test.ts",
    "app/bo/payroll-periods/PayrollNativeTable.tsx",
  ];
  for(const file of files)write(file,fs.readFileSync(path.join(repo,file),"utf8"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/payroll-daily.*exactly one staging decision/);
  write(policy,read(policy).replace('  "/bo/payroll-periods",','  "/bo/payroll-periods",\n  "/bo/payroll-daily",'));
  assert.deepEqual(verifyBoStagingRoutePolicy(root).issues,[]);
  const view=files[1], original=read(view);
  const wrapper=files[7], originalWrapper=read(wrapper);
  for(const bad of [
    original.replace('../payroll-periods/PayrollNativeTable','../payroll-periods/OtherTable'),
    original.replace(/<PayrollDsaReadTable\b/g,"<OtherTable"),
    original.replace(/<BoQuickView\b/g,"<OtherDrawer"),
    original.replace('@/app/bo/components/registration/BoQuickView','@/app/bo/components/OtherDrawer')
  ]){
    write(view,bad);
    assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/payroll-daily.*invalid native read-only route contract/);
  }
  write(view,original);
  for(const bad of [
    originalWrapper.replace('@/app/bo/components/registration/BoDataTable','@/app/bo/components/OtherTable'),
    originalWrapper.replace(/<BoDataTable\b/g,"<OtherTable"),
    originalWrapper.replace('export function PayrollDsaReadTable','function PayrollDsaReadTable'),
    originalWrapper.replace('import {BoDataTable}','// import {BoDataTable}')
  ]){
    write(wrapper,bad);
    assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/payroll-daily.*invalid native read-only route contract/);
  }
  fs.unlinkSync(path.join(root,wrapper));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/payroll-daily.*invalid native read-only route contract/);
  write(wrapper,originalWrapper);
  const exceptionFiles=[
    "app/bo/payroll-exceptions/page.tsx",
    "app/bo/payroll-exceptions/BoPayrollExceptionsReadView.tsx",
    "app/bo/payroll-exceptions/[requestId]/BoPayrollExceptionDetail.tsx",
    "lib/bo-payroll-exceptions-read.ts",
    "lib/bo-payroll-exceptions-model.test.ts"
  ];
  for(const file of exceptionFiles)write(file,fs.readFileSync(path.join(repo,file),"utf8"));
  write(policy,read(policy).replace('  "/bo/payroll-daily",','  "/bo/payroll-daily",\n  "/bo/payroll-exceptions",'));
  assert.deepEqual(verifyBoStagingRoutePolicy(root).issues,[]);
  const exception=read(exceptionFiles[1]);
  write(exceptionFiles[1],exception.replace(/<BoQuickView\b/g,"<OtherDrawer"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/payroll-exceptions.*invalid native read-only route contract/);
  write(exceptionFiles[1],exception);
  const client=read(exceptionFiles[3]);
  write(exceptionFiles[3],client+'\nconst invalid={method:"POST"};');
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/payroll-exceptions.*invalid native read-only route contract/);
  write(exceptionFiles[3],client);
  assert.deepEqual(verifyBoStagingRoutePolicy(root).issues,[]);
  write(view,original+"\n// BoModuleFactory");
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/payroll-daily.*invalid native read-only route contract/);
  write(view,original);
  fs.unlinkSync(path.join(root,files[4]));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/payroll-daily.*missing native read-only route contract/);
}));

test("PAP-901 current canonical routes use one admitted BO workspace with required stylesheet", () => {
  const result=verifyBoStagingRoutePolicy(repo);
  assert.deepEqual(result.issues, []);
  assert.equal(result.admitted, result.canonical);
  assert.equal(result.deferred, 0);
});

test("PAP-982 admitted TDD route requires exact schema, binding, tests and explicit policy",()=>fixture(({root,read,write})=>{
  const entry=JSON.parse(fs.readFileSync(path.join(repo,"config/tdd-admission.json"),"utf8")).modules.find(e=>e.key==="bills");
  for(const file of [...entry.files,...entry.tests])write(file,fs.readFileSync(path.join(repo,file),"utf8"));
  write("config/tdd-admission.json",JSON.stringify({modules:[entry]}));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\\n"),/bills.*exactly one staging decision/);
  write(policy,read(policy).replace('  "/bo/payroll-periods",','  "/bo/payroll-periods",\n  "/bo/bills",'));
  assert.deepEqual(verifyBoStagingRoutePolicy(root).issues,[]);
  write("config/tdd-admission.json",JSON.stringify({modules:[]}));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\\n"),/bills.*canonical BoModuleFactory page/);
  write("config/tdd-admission.json",JSON.stringify({modules:[entry]}));
  fs.unlinkSync(path.join(root,entry.schema.file));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\\n"),/Invalid exact BO TDD route admission|TDD entry/);
}));
test("new canonical module without a staging decision fails closed", () => fixture(({ root, write }) => {
  write("app/bo/new-module/page.tsx", "return <BoModuleFactory moduleKey=\"new-module\" />;");
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /new-module.*exactly one staging decision/);
}));

test("an explicitly deferred module may merge without staging route exposure", () => fixture(({ root, read, write }) => {
  write("app/bo/new-module/page.tsx", "return <BoModuleFactory moduleKey=\"new-module\" />;");
  write(policy, read(policy).replace("new Set<string>([])", 'new Set<string>(["/bo/new-module"])'));
  assert.deepEqual(verifyBoStagingRoutePolicy(root).issues, []);
}));

test("staging admission cannot point at an absent or legacy route", () => fixture(({ root, read, write }) => {
  write(policy, read(policy).replace('"/bo/workforce-assignments",', '"/bo/workforce-assignments",\n  "/bo/staff",'));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /\/bo\/staff.*canonical BoModuleFactory page/);
}));

test("admitted staging route without one authority stylesheet fails", () => fixture(({root,read,write}) => {
  write(rootLayout, read(rootLayout).replace('isBoStagingRouteAdmitted(path ?? "")', "false"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /authority CSS/);
}));

test("removing staging deny fallback or CI gate fails", () => fixture(({ root, read, write }) => {
  write(layout, read(layout).replace('if (!isBoStagingRouteAdmitted(routePath) && routePath !== "/bo" && routePath !== "/bo/") redirect("/bo")', ""));
  write(ci, read(ci).replace("node scripts/verify-bo-staging-route-policy.mjs", ""));
  const issues = verifyBoStagingRoutePolicy(root).issues.join("\n");
  assert.match(issues, /remain denied/);
  assert.match(issues, /PR CI must enforce/);
}));
test("unified workspace route cannot silently revert to legacy standalone shell", () => fixture(({root,read,write}) => {
  write(layout, read(layout).replace('<BoRuntimeBoundary currentUser=', '<BoShell currentUser='));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /single React workspace/);
}));
test("all three registered Workforce routes must stay in canonical nav", () => fixture(({root,read,write}) => {
  write(source,read(source).replace("modules: { ...school.modules, ...moduleDefinitions }", "modules: school.modules"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /Unified BO navigation/);
}));
test("Core adapter cannot be replaced with silent empty fallback data", () => fixture(({root,read,write}) => {
  write(source,read(source).replace("await adapters[key].list(fetcher, options.centerId)", "Promise.resolve([])"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /authorized and read-only/);
}));
test("staging route must use BO authority CSS rather than unstyled legacy shell", () => fixture(({root,read,write}) => {
  write(rootLayout,read(rootLayout).replace('"/bo-skeleton/" + file','"/team-legacy-global.css"'));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /authority CSS/);
}));

test("auto CD cannot silently skip CSS runtime checks", () => fixture(({root,read,write})=>{
  write(cd,read(cd).replace("for css in team-legacy-global.css bo-legacy-foundation.css","for css in unapproved.css"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/Automatic staging CD must smoke test/);
}));
test("staging nav cannot expose unadmitted future modules", () => fixture(({root,read,write})=>{
  write(source,read(source).replace("boModuleRegistry.filter(def => isBoStagingRouteAdmitted(def.href))","boModuleRegistry"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/Unified BO navigation/);
}));

test("automatic CD must validate BO public hostname, not workers.dev",()=>fixture(({root,read,write})=>{
  write(cd,read(cd).replace("https://bo.staging.pinohouse.art/$css","https://wrong.example/$css"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/Automatic staging CD must smoke test/);
}));

test("PAP-1030 retired BO deep-link smoke must run on canonical BO staging host", () => fixture(({root,read,write}) => {
  const source = read(cd);
  assert.match(source, /bo_host='https:\/\/bo\.staging\.pinohouse\.art'/);
  write(cd, source.replace("bo_host='https://bo.staging.pinohouse.art'", "bo_host='https://pino-team-os-staging.minhtri-van42.workers.dev'"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /retired BO route smoke must target canonical BO staging host/);
}));

test("PAP-1810 native BO Avatar is canonical under exact Founder migration, not Factory/TDD",()=>fixture(({root,read,write})=>{
  const files=[
    "app/bo/pinoria-avatars/page.tsx",
    "app/bo/pinoria-avatars/AvatarDirectoryDsa.tsx",
    "app/bo/pinoria-avatars/avatar-dsa-data.ts",
    "app/bo/pinoria-avatars/avatar-dsa-model.ts",
    "app/bo/pinoria-avatars/CreateSelfDrawer.tsx",
    "app/bo/pinoria-avatars/SelfWardrobeDetail.tsx",
    "app/bo/pinoria-avatars/SelfLoadoutDetail.tsx",
    "lib/pap1810-avatar-native-dsa.test.ts",
  ];
  for(const file of files)write(file,fs.readFileSync(path.join(repo,file),"utf8"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),
    /pinoria-avatars.*exactly one staging decision/);
  write(policy,read(policy).replace('  "/bo/payroll-periods",',
    '  "/bo/payroll-periods",\n  "/bo/pinoria-avatars",'));
  assert.deepEqual(verifyBoStagingRoutePolicy(root).issues,[]);
  const data=files[2],good=read(data);
  write(data,good.replace("pinoria.avatar.directory.view","unrestricted.read"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),
    /pinoria-avatars.*canonical BoModuleFactory page/);
  write(data,good);
  const page=files[0],original=read(page);
  write(page,original.replace("<AvatarDirectoryDsa />","<SelfDirectoryTdd />"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),
    /pinoria-avatars.*canonical BoModuleFactory page/);
  write(page,original);
  write("app/bo/new-unregistered/page.tsx",
    'export default function Page(){return <AvatarDirectoryDsa/>}');
  write(policy,read(policy).replace('  "/bo/payroll-periods",',
    '  "/bo/payroll-periods",\n  "/bo/new-unregistered",'));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),
    /new-unregistered.*canonical BoModuleFactory page/);
}));

test("PAP-1886 native Accounts must stay centered, read-only and explicitly admitted", () => fixture(({root, read, write}) => {
  const files = [
    "app/bo/afterschool-accounts/page.tsx",
    "app/bo/afterschool-accounts/AfterschoolAccounts.tsx",
    "lib/host-boundary.ts",
    "lib/host-boundary.test.ts",
  ];
  for (const file of files) write(file, fs.readFileSync(path.join(repo, file), "utf8"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /afterschool-accounts.*exactly one staging decision/);
  write(policy, read(policy).replace('  "/bo/payroll-periods",', '  "/bo/payroll-periods",\n  "/bo/afterschool-accounts",'));
  assert.deepEqual(verifyBoStagingRoutePolicy(root).issues, []);
  write(files[1], read(files[1]).replace("data?.scopeCenterId !== centerId", "false"));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"), /afterschool-accounts.*invalid native read-only route contract/);
}));

test("PAP-767 native Opening Evidence requires exact authorized entry, detail and host integration",()=>fixture(({root,read,write})=>{
 const files=[
  "app/bo/opening-evidence/page.tsx","app/bo/opening-evidence/OpeningEvidenceStageGate.tsx",
  "app/bo/opening-evidence/[subjectType]/[receiptId]/page.tsx","app/bo/opening-evidence/[subjectType]/[receiptId]/OpeningEvidenceDetail.tsx",
  "lib/bo-opening-evidence-api.ts","lib/bo-opening-evidence-handler.ts","lib/opening-evidence-host-contract.ts",
  "lib/opening-evidence-host-contract.test.ts","lib/pap764-opening-evidence-nav.test.ts","lib/host-boundary.ts","app/bo/shell/BoApplicationShell.tsx"
 ];
 for(const file of files)write(file,fs.readFileSync(path.join(repo,file),"utf8"));
 write(policy,read(policy).replace('  "/bo/payroll-periods",','  "/bo/payroll-periods",\n  "/bo/opening-evidence",'));
 assert.deepEqual(verifyBoStagingRoutePolicy(root).issues,[]);
 const stage=files[1],stageOriginal=read(stage);
 for(const [needle,replacement] of [
  ['<BoDataTable ', '<div '],
  ['<BoQuickView ', '<div '],
  ['import {BoQuickView} from "@/app/bo/components/registration/BoQuickView"', 'import {BoQuickView} from "./fake"'],
  ['scope.centers.some(center=>center.id===scope.selected)', 'true'],
  ['openingEvidenceApi.list({centerId,offset,limit', 'openingEvidenceApi.list({centerId:"other",offset,limit'],
  ['response?.key===key', 'true'],
 ]){
  assert.ok(stageOriginal.includes(needle),needle);
  write(stage,stageOriginal.replace(needle,replacement));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/opening-evidence.*invalid native scoped route contract/);
 }
 write(stage,stageOriginal);
 const boundary=files[9],original=read(boundary);
 write(boundary,original.replace("openingEvidenceHostDecision(hostname, pathname, method)","null"));
 assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/opening-evidence.*invalid native scoped route contract/);
 write(boundary,original);
 const api=files[4],apiOriginal=read(api);
 write(api,apiOriginal.replaceAll("same-origin","omit"));
 assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/opening-evidence.*invalid native scoped route contract/);
 write(api,apiOriginal);
 fs.unlinkSync(path.join(root,files[3]));
 assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/opening-evidence.*missing exact native route contract/);
}));

test("PAP-767 and PAP-1886 native routes coexist without weakening either guard",()=>fixture(({root,read,write})=>{
 const files=[
  "app/bo/opening-evidence/page.tsx","app/bo/opening-evidence/OpeningEvidenceStageGate.tsx",
  "app/bo/opening-evidence/[subjectType]/[receiptId]/page.tsx","app/bo/opening-evidence/[subjectType]/[receiptId]/OpeningEvidenceDetail.tsx",
  "lib/bo-opening-evidence-api.ts","lib/bo-opening-evidence-handler.ts","lib/opening-evidence-host-contract.ts",
  "lib/opening-evidence-host-contract.test.ts","lib/pap764-opening-evidence-nav.test.ts","lib/host-boundary.ts","app/bo/shell/BoApplicationShell.tsx",
  "app/bo/afterschool-accounts/page.tsx","app/bo/afterschool-accounts/AfterschoolAccounts.tsx","lib/host-boundary.test.ts"
 ];
 for(const file of files)write(file,fs.readFileSync(path.join(repo,file),"utf8"));
 write(policy,read(policy).replace('  "/bo/payroll-periods",','  "/bo/payroll-periods",\n  "/bo/opening-evidence",\n  "/bo/afterschool-accounts",'));
 assert.deepEqual(verifyBoStagingRoutePolicy(root).issues,[]);
 const accounts=files[12],original=read(accounts);
 write(accounts,original.replace("data?.scopeCenterId !== centerId","false"));
 assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/afterschool-accounts.*invalid native read-only route contract/);
 write(accounts,original);
 const evidence=files[4],good=read(evidence);
 write(evidence,good.replaceAll("same-origin","omit"));
 assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/opening-evidence.*invalid native scoped route contract/);
}));

// PAP-2134: exact native Post admission, not a factory or fixture-only route.
test("PAP-2134 native Posts requires exact TDD manifest, schema and explicit staging policy",()=>fixture(({root,read,write})=>{
 const entry=JSON.parse(fs.readFileSync(path.join(repo,"config/tdd-admission.json"),"utf8")).modules.find(e=>e.key==="piner-posts");
 assert.ok(entry);
 for(const file of [...entry.files,...entry.tests])write(file,fs.readFileSync(path.join(repo,file),"utf8"));
 write("config/tdd-admission.json",JSON.stringify({modules:[entry]}));
 assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/piner-posts.*exactly one staging decision/);
 write(policy,read(policy).replace('  "/bo/payroll-periods",','  "/bo/payroll-periods",\n  "/bo/piner-posts",'));
 assert.deepEqual(verifyBoStagingRoutePolicy(root).issues,[]);
 write("config/tdd-admission.json",JSON.stringify({modules:[]}));
 assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/piner-posts.*canonical BoModuleFactory page/);
 write("config/tdd-admission.json",JSON.stringify({modules:[entry]}));
 fs.unlinkSync(path.join(root,entry.schema.file));
 assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/Invalid exact BO TDD route admission|TDD entry/);
}));

test("PAP-2032 native Wish Events requires exact authorized runtime and Center/actor fences",()=>fixture(({root,read,write})=>{
 const files=["app/bo/pinoria-wish-events/page.tsx","app/bo/pinoria-wish-events/BoWishRuntime.tsx","app/bo/pinoria-wish/BoWishEventCatalog.tsx","app/bo/pinoria-wish/BoWishEventDetail.tsx","lib/bo-pls-wish-handler.ts","lib/bo-pls-wish-host-contract.ts","lib/host-boundary.ts","lib/bo-pls-wish-handler.test.ts","app/api/bo/pinoria/pls-wish/events/[[...path]]/route.ts"];
 for(const f of files)write(f,fs.readFileSync(path.join(repo,f),"utf8"));
 write(policy,read(policy).replace('  "/bo/payroll-periods",','  "/bo/payroll-periods",\n  "/bo/pinoria-wish-events",'));
 assert.deepEqual(verifyBoStagingRoutePolicy(root).issues,[]);
 for(const [index,needle] of [[0,"!==\"bo.staging.pinohouse.art\")notFound()"],[1,"s.centers.some(c=>c.id===s.selected)"],[1,"current.actor!==cap.actor"],[4,"credential.kind===\"support\""],[4,"const outbound:BoAccessRequest={method:m,path:[\"pinoria/pls-wish/events\",...path].join(\"/\"),resource:{centerId}};"],[6,"boPlsWishHostDecision(hostname,pathname,method)"]]){
  const f=files[index],original=read(f);assert.ok(original.includes(needle));write(f,original.replace(needle,"BROKEN_CONTRACT"));assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/Wish Events: invalid native scoped route contract/);write(f,original);
 }
 fs.unlinkSync(path.join(root,files[8]));assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/Wish Events: missing native scoped route contract/);
}));

test("PAP-2225 native Running Classes requires exact authorized live and retained M1 workspace",()=>fixture(({root,read,write})=>{
 const files=["app/bo/running-classes/page.tsx","app/bo/running-classes/RunningClassStagingEntry.tsx","app/bo/running-classes/running-class-review-access.ts","app/bo/running-classes/running-class-review.ts","app/bo/running-classes/running-class-review-query.ts","app/bo/running-classes/running-class-review-access.test.ts","app/bo/running-classes/running-class-review-query.test.ts","lib/pap2225-running-class-m1.test.ts"];
 files.push("app/bo/running-classes/RunningClassNativeEntry.tsx","app/bo/running-classes/running-class-stage-admission.ts","app/bo/running-classes/running-class-provider.ts","app/bo/running-classes/running-class-stage-admission.test.ts");
 for(const file of files)write(file,fs.readFileSync(path.join(repo,file),"utf8"));
 write(policy,read(policy).replace('  "/bo/payroll-periods",','  "/bo/payroll-periods",\n  "/bo/running-classes",'));
 assert.deepEqual(verifyBoStagingRoutePolicy(root).issues,[]);
 for(const [index,from,to] of [[0,'./RunningClassStagingEntry','./OtherEntry'],[0,'!boSkeletonEnabled(env,host)','false'],[1,'!center.centers.some(c=>c.id===selected)','false'],[1,'if(state!=="ready")','if(false)'],[1,'const options=useMemo(()=>({centerId}),[centerId]);','const options={centerId};'],[1,'options={options}','options={{centerId}}'],[1,'../components/registration/BoRegistrationWorkspace','../OtherWorkspace'],[2,'!ctx.permissionKeys?.includes("delivery.schedule.manage")','false'],[2,'method:"GET"','method:"POST"'],[3,'new Map<string,ClassRecord>','new FakeStore'],[0,'./RunningClassNativeEntry','./OtherEntry'],[9,'RUNNING_CLASS_LIVE_ADMISSION=true','RUNNING_CLASS_LIVE_ADMISSION=false'],[8,'runningClassLive:provider','runningClassLive:undefined'],[8,'!center.centers.some(c=>c.id===selected)','false'],[10,'current.userId!==actorId','false']]){
  const file=files[index],original=read(file);assert.ok(original.includes(from),from);write(file,original.replace(from,to));
  assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/running-classes.*invalid native scoped fixture contract/);write(file,original);
 }
 fs.unlinkSync(path.join(root,files[5]));assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/running-classes.*missing exact native fixture contract/);
}));

test("PAP-2387/PAP-2389 exact native Parent live admission requires actor and Center binding",()=>fixture(({root,read,write})=>{
 const files=["app/bo/parents/page.tsx","app/bo/parents/ParentStagingEntry.tsx","app/bo/parents/ParentDirectoryDsa.tsx","app/bo/parents/parent-live-context.tsx","app/bo/parents/parent-m1-context.tsx","app/bo/parents/parent-native-data.ts","app/bo/parents/parent-route.ts","app/bo/parents/ParentCreateDrawer.tsx","app/bo/components/registration/BoParentReadTabs.tsx","lib/pap2387-parent-staging-boundary.test.ts","lib/pap2389-parent-route.test.ts","app/bo/parents/parent-create-retry.ts"];
 for(const f of files)write(f,fs.readFileSync(path.join(repo,f),"utf8"));
 write(policy,read(policy).replace('  "/bo/payroll-periods",','  "/bo/payroll-periods",\n  "/bo/parents",'));
 assert.deepEqual(verifyBoStagingRoutePolicy(root).issues,[]);
 for(const [index,needle] of [[0,"host!==\"bo.staging.pinohouse.art\"||env.APP_ENV!==\"staging\"||!boSkeletonEnabled(env,host)"],[0,"if(!canonicalParentRoute(query))notFound()"],[0,"await authorizeBoShell(new Headers(incoming),env)"],[0,"if(!actor.permissionKeys.includes(\"identity.parent_directory.view\"))forbidden()"],[0,"actorId={actor.userId} actorEmail={actor.email}"],[1,"user.email!==actorEmail"],[1,"!center.centers.some(c=>c.id===selected)"],[1,"loadNativeParentLiveGrants(scope,ctl.signal)"],[1,"if(state!==\"ready\")return <RecordState status={state}/>"],[1,"<ParentLiveScope.Provider value={scope}>"],[1,"load:async()=>{throw Error(\"Parent owns scoped native record transport\")"],[1,"content={<ParentDirectoryDsa/>}"],[3,"createContext<NativeParentLiveScope|null>(null)"],[4,"self.origin!==\"null\""],[5,"loadNativeParentContext(scope.centerId,signal,fetcher,scope.actorId)"],[5,"scope.canCreate&&grants.has(\"identity.parent.create\")"],[5,"scope.canEdit&&grants.has(\"identity.parent.edit\")"],[5,"raw.userId !== expectedActorId"],[5,"grants.has(\"identity.parent_directory.view\")"],[5,"scopes.centers.some(c => c.id === centerId)"],[2,"liveScope.centerId!==centerId"],[2,"return loadNativeParentLiveGrants(liveScope,signal)"],[2,"return loadNativeParentDirectory(centerId,ctl.signal)"],[2,"const current=fixture?grants:await reattest(ctl.signal)"],[7,"liveScope.centerId!==attempt.centerId"],[7,"await loadNativeParentLiveGrants(liveScope,ctl.signal)"],[7,"parentCreateMayEdit(previouslyUncertain,true)"],[8,"await loadNativeParentLiveGrants(liveScope,controller.signal)"],[8,"new URLSearchParams({centerId:liveScope.centerId})"],[6,"export const PARENT_ROUTE = \"/bo/parents\""],[6,"!uuid.test(value)"],[11,"return !previouslyUncertain&&definiteRejection"]]){
  const f=files[index],original=read(f);assert.ok(original.includes(needle),needle);write(f,original.replace(needle,"BROKEN_CONTRACT"));assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/parents: invalid exact native Parent live contract/,needle);write(f,original);
 }
 for(const [index,extra] of [[1,"\nconst retired = <ParentStagingFixtureProvider/>;"],[1,"\nconst retired = {ephemeral:true};"],[6,"\n// PARENT-MOCK-001"]]){const f=files[index],original=read(f);write(f,original+extra);assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/parents: invalid exact native Parent live contract/);write(f,original);}
 fs.unlinkSync(path.join(root,files[9]));assert.match(verifyBoStagingRoutePolicy(root).issues.join("\n"),/parents: missing exact native Parent live contract/);
}));
