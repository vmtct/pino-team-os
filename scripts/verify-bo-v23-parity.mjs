/** PAP-889: phased BO V2.3 static parity tripwire; not a browser test or Founder sign-off. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const SPEC="docs/bo-v23-ui-authority.json";
const PINNED=Object.freeze({
  "playground.html":"44C30E1FB9E98A8B81337691DAE090637FC47F0CC1F8C50A1F1DD9451F0F21AD",
  "playground.js":"D5AA75741FCD9DD0E650C314CD7951B3F43B7D572B7ADFE431202E7583150DBC",
  "index.html":"EEC5BB6158315586EC78FDA821C499F440223841EF43CCFA1CF8AF7A46C9195D"
});
const MODES=new Set(["report","adopted","pilot"]);
const EXT=["",".tsx",".ts",".jsx",".js",".mjs","/index.tsx","/index.ts","/index.js"];
const safe=name=>typeof name==="string"&&!name.startsWith("/")&&!name.includes("..")&&!name.includes("\\");
function read(root,rel){const abs=path.resolve(root,rel);if(!abs.startsWith(path.resolve(root)+path.sep))throw new Error("Unsafe path "+rel);return fs.readFileSync(abs,"utf8")}
const exists=(root,rel)=>fs.existsSync(path.join(root,rel));
export function authorityManifest(root=ROOT){
 const m=JSON.parse(read(root,SPEC));
 if(m.version!==1||m.immutable!==true||!m.pilot?.students?.route||!m.pilot?.classes?.route)throw new Error("Malformed V2.3 authority manifest");
 const items=Object.entries(m.sourceSha256??{});
 if(items.length!==13||items.some(([p,h])=>!safe(p)||!/^[a-f0-9]{64}$/i.test(h)))throw new Error("Malformed authority SHA-256 inventory");
 for(const [name,sha] of Object.entries(PINNED))if(m.sourceSha256[name]!==sha)throw new Error("Founder SHA anchor drift: "+name);
 for(const pilot of Object.values(m.pilot))if(!safe(pilot.route)||!pilot.route.startsWith("app/bo/"))throw new Error("Unsafe BO route");
 return m;
}
export function verifyAuthorityRoot(root,sourceDir){
 const errors=[];
 for(const [name,sha] of Object.entries(authorityManifest(root).sourceSha256)){
  const p=path.join(sourceDir,name);
  if(!fs.existsSync(p)){errors.push("Missing authority source "+name);continue}
  if(crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex").toUpperCase()!==sha)errors.push("Authority hash mismatch "+name);
 }
 return errors;
}
function resolveImport(root,current,name){
 if(!name.startsWith(".")&&!name.startsWith("@/"))return null;
 const raw=path.posix.normalize(name.startsWith("@/")?name.slice(2):path.posix.join(path.posix.dirname(current),name));
 if(!raw.startsWith("app/bo/")&&!raw.startsWith("lib/bo-"))return null;
 for(const suffix of EXT){const rel=raw+suffix;if(exists(root,rel)&&fs.statSync(path.join(root,rel)).isFile())return rel}
 return null;
}
export function reachableSource(root,entry){
 const seen=new Map(),queue=[entry];
 while(queue.length){
  const rel=queue.shift();if(!rel||seen.has(rel)||!exists(root,rel))continue;
  if(seen.size>250)throw new Error("Dependency graph too large");
  const source=read(root,rel);seen.set(rel,source);
  for(const match of source.matchAll(/\b(?:from\s*|import\s*)["']([^"'\r\n]+)["']/g)){
   const dependency=resolveImport(root,rel,match[1]);
   if(dependency&&!seen.has(dependency))queue.push(dependency);
  }
 }
 return seen;
}
function checkRoute(root,key,route){
 const graph=reachableSource(root,route);
 const combined=[...graph.values()].join("\n");
 const jsx=name=>[...graph.entries()].some(([filename,text])=>filename.startsWith("app/bo/")&&new RegExp("<"+name+"(?=[\\s/>])").test(text));
 const grid=graph.get("app/bo/components/data-grid/BoDataGrid.tsx")??"";
 const owner=key==="students"?(graph.get("app/bo/learners/BoLearnersView.tsx")??""):(graph.get("app/bo/BoOperationalView.tsx")??"");
 const checks=[
  ["canonical_table",jsx("BoDataGrid")||jsx("BoModuleFactory"),"actual page mounts canonical Table"],
  ["first_cell_opener",/Bo(?:DataGrid)?(?:QuickView|Drawer)Opener|data-bo-v23-opener/.test(combined),"first-cell compact Quick View opener"],
  ["id_separate_column",/key\s*:\s*["']id["']/.test(owner)||jsx("BoModuleFactory"),"canonical ID has own readonly/copyable column"],
  ["editable_drawer",jsx("BoDrawer")||jsx("BoEditableDrawer")||jsx("BoEditableQuickView"),"one editable property Drawer"],
  ["typed_inline_edit",/\bonCell(?:Commit|Edit|Change)\b|\bonField(?:Commit|Edit|Change)\b|\bBoTypedCellEditor\b|\btypedEditor\b/.test(grid+"\n"+combined),"typed mutation-capable inline cell editor"],
  ["settings_panel",jsx("BoTableSettings")||jsx("BoGridSettings")||jsx("BoSettingsPanel"),"mounted typed Settings panel"],
  ["saved_view_tabs",jsx("BoSharedViewTabs"),"mounted public saved view tabs, not just standalone definition"],
  ["full_detail",jsx("BoFullDetail"),"mounted shared Full Detail tabs"],
  ["no_legacy_readonly",!/Thuộc tính chỉ xem ở V1|Read-only until the PAP-874/.test(combined),"no legacy readonly placeholder"],
  ["no_separate_filter",!/toolbarActions\s*=\s*\{\s*<label\b/.test(owner),"configuration controls in Settings instead of old toolbar"]
 ];
 if(key==="students"){
  checks.push(["no_metric_rail",!/styles\.metrics\b/.test(owner),"no legacy Student metric rail"]);
  checks.push(["no_row_avatars",!/styles\.avatarSmall\b/.test(owner),"no Student row avatar"]);
 }else{
  const chunk=owner.match(/function RunningClasses\b[\s\S]*?(?=\nfunction [A-Z]|\nconst [A-Z]|$)/)?.[0]??owner;
  checks.push(["classes_interactive",!/read-only canonical projection/.test(chunk)&&(/\bonRowOpen\b/.test(chunk)||jsx("BoModuleFactory")),"Classes editable domain interaction"]);
 }
 return {key,route,visited:graph.size,checks:checks.map(([id,passed,requirement])=>({id,passed,requirement}))};
}
export function auditBoV23(root=ROOT,mode="report"){
 if(!MODES.has(mode))throw new Error("Unsupported mode: "+mode);
 const authority=authorityManifest(root);
 const ledger=JSON.parse(read(root,"app/bo/architecture/legacy-migration-ledger.json"));
 const adopted=new Set((ledger.adoptedRoutes??[]).map(row=>typeof row==="string"?row:row.path));
 const all=Object.entries(authority.pilot);
 const selected=all.filter(([,p])=>mode!=="adopted"||adopted.has(p.route));
 const routes=selected.map(([key,p])=>checkRoute(root,key,p.route));
 const failures=routes.flatMap(r=>r.checks.filter(c=>!c.passed).map(c=>r.key+":"+c.id+": "+c.requirement));
 return {mode,authority:authority.authority,status:mode==="adopted"&&!routes.length?"PENDING_ADOPTION":failures.length?"NOT_PARITY_READY":"STATIC_PASS_ONLY",
   selectedRoutes:routes.length,adoptedPilotRoutes:all.filter(([,p])=>adopted.has(p.route)).length,
   failures,routeResults:routes,warning:"Static hints only: visual parity, Core ACL, domain behavior and Founder Production approval are separate."};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const arg=flag=>process.argv.find(x=>x.startsWith("--"+flag+"="))?.split("=").slice(1).join("=");
 const mode=arg("mode")||"report",root=arg("root")?path.resolve(arg("root")):ROOT;
 try{
  const result=auditBoV23(root,mode),local=arg("authority-root");
  result.authorityFileErrors=local?verifyAuthorityRoot(root,path.resolve(local)):[];
  console.log(JSON.stringify(result,null,2));
  if(result.authorityFileErrors.length||(mode!=="report"&&result.failures.length))process.exitCode=1;
 }catch(e){console.error("BO_V23_PARITY_ERROR: "+String(e?.stack??e));process.exitCode=1}
}
