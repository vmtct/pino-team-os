/** PAP-874/PAP-889 BO-only V2.3 Foundation Lock source contract. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const TOKENS="canvas surface strong text muted border border-subtle sidebar accent accent-table focus selected hover success warning danger info".split(" ").map(x=>"--bo-v23-color-"+x)
 .concat("family display heading body label caption".split(" ").map(x=>"--bo-v23-font-"+x))
 .concat(["--bo-v23-line-body"])
 .concat([1,2,3,4,5,6,8].map(x=>"--bo-v23-space-"+x))
 .concat(["xs","control","surface","popover"].map(x=>"--bo-v23-radius-"+x))
 .concat(["control-min-height","toolbar-min-height","table-heading-height","table-row-height","opener-column-width","view-tab-height","settings-panel-width","quick-view-width"].map(x=>"--bo-v23-"+x));
const APPROVED_TARGETS={
 "--bo-v23-font-display":"30px",
 "--bo-v23-font-body":"12px",
 "--bo-v23-font-caption":"11px",
 "--bo-v23-space-1":"4px",
 "--bo-v23-space-2":"8px",
 "--bo-v23-space-3":"12px",
 "--bo-v23-space-4":"16px",
 "--bo-v23-space-6":"24px",
 "--bo-v23-space-8":"32px",
 "--bo-v23-radius-control":"8px",
 "--bo-v23-control-min-height":"40px",
 "--bo-v23-toolbar-min-height":"49px",
 "--bo-v23-table-heading-height":"35px",
 "--bo-v23-table-row-height":"42px",
 "--bo-v23-opener-column-width":"37px",
 "--bo-v23-view-tab-height":"43px",
 "--bo-v23-settings-panel-width":"405px",
 "--bo-v23-quick-view-width":"520px"
};
const BRIDGES=[
 ["app/components/tos-shell/bo-shell.module.css","--bo-accent","--bo-v23-color-accent","#6f5bd6"],
 ["app/components/tos-shell/bo-shell.module.css","--bo-sidebar","--bo-v23-color-sidebar","#1c1c23"],
 ["app/components/tos-shell/bo-shell.module.css","background","--bo-v23-color-canvas","#f6f5f2"],
 ["app/components/tos-shell/bo-shell.module.css","color","--bo-v23-color-strong","#18181f"],
 ["app/bo/components/data-grid/bo-data-grid.module.css","--grid-border","--bo-v23-color-border","#e2e1e5"],
 ["app/bo/components/data-grid/bo-data-grid.module.css","--grid-border-soft","--bo-v23-color-border-subtle","#ecebf0"],
 ["app/bo/components/data-grid/bo-data-grid.module.css","--grid-muted","--bo-v23-color-muted","#807d88"],
 ["app/bo/components/data-grid/bo-data-grid.module.css","--grid-text","--bo-v23-color-text","#26242b"],
 ["app/bo/components/data-grid/bo-data-grid.module.css","--grid-accent","--bo-v23-color-accent-table","#6655c7"],
 ["app/bo/components/data-grid/bo-data-grid.module.css","border-radius","--bo-v23-radius-surface","13px"],
 ["app/bo/components/data-grid/bo-data-grid.module.css","min-height","--bo-v23-toolbar-min-height","49px"],
 ["app/bo/components/data-grid/bo-data-grid.module.css","border-radius","--bo-v23-radius-control","8px"]
];
const removeComments=s=>s.replace(/\/\*[\s\S]*?\*\//g,"");
const esc=s=>[...s].map(ch=>"\\^$.*+?()[]{}|".includes(ch)?"\\"+ch:ch).join("");
function source(root,p){return fs.readFileSync(path.join(root,p),"utf8")}
export function verifyBoV23Foundation(root=ROOT){
 const issues=[];
 let css="",layout="",shell="",globalLayout="",ci="";
 try{css=source(root,"app/bo/design-system/foundation.css")}catch{issues.push("Missing BO V2.3 token stylesheet")}
 try{layout=source(root,"app/bo/layout.tsx")}catch{issues.push("Missing BO layout")}
 try{shell=source(root,"app/components/tos-shell/BoShell.tsx")}catch{issues.push("Missing shared BO Shell")}
 try{globalLayout=source(root,"app/layout.tsx")}catch{issues.push("Missing app root layout")}
 try{ci=source(root,".github/workflows/pr-validation.yml")}catch{issues.push("Missing PR Validation workflow")}
 const live=removeComments(css).trim();
 const found=live.match(/^\[data-bo-design-system="v23"\]\s*\{([\s\S]*)\}$/);
 if(!found||/[{}]/.test(found[1]??""))issues.push("BO foundation must be one scoped [data-bo-design-system=\"v23\"] CSS rule");
 const declarations=[...live.matchAll(/(--bo-v23-[a-z0-9-]+)\s*:\s*([^;]+)\s*;/g)];
 const byName=new Map();
 for(const [,key,value] of declarations){
  if(byName.has(key))issues.push("Duplicate BO token: "+key);
  byName.set(key,value.trim());
 }
 for(const key of TOKENS){
  if(!byName.has(key))issues.push("Missing required BO foundation token: "+key);
  const value=byName.get(key);
  if(value&&!/^#[\da-f]{6}$|^\d+(?:\.\d+)?px$|^\d+(?:\.\d+)?$|^Arial, Helvetica, sans-serif$/i.test(value))issues.push("Invalid token value: "+key);
 }
 for(const key of byName.keys())if(!TOKENS.includes(key))issues.push("Unreviewed extra BO token: "+key);
 for(const [key,value] of Object.entries(APPROVED_TARGETS))
  if(byName.get(key)!==value)issues.push("Founder V2.3 density target drift: "+key);
 // PAP-986 separates the authority CSS pipeline from legacy BO/TOS. An external
 // legacy stylesheet is valid only with its exact source-to-output build mapping.
 let packaging="";
 try{packaging=source(root,"scripts/build-bo-public-views.mjs")}catch{/* imported legacy path remains supported */}
 const imported=/import\s+["']\.\/design-system\/foundation\.css["']/.test(layout);
 // UI-only admitted routes and the ordinary BO shell are separate render paths.
 // Both must receive the same packaged foundation bytes.
 const linkCount=(layout.match(/<link\s+rel="stylesheet"\s+href="\/bo-legacy-foundation\.css"/g)||[]).length;
 const packaged=linkCount===2&&/copyFile\('app\/bo\/design-system\/foundation\.css','public\/bo-legacy-foundation\.css'\)/.test(packaging);
 if(!imported&&!packaged)issues.push("BO layout must import foundation CSS or load its exact packaged legacy bytes");
 if(!/className=\{styles\.shell\}\s+data-bo-design-system="v23"/.test(shell))issues.push("BO shell missing v23 scope marker");
 if(/foundation\.css|data-bo-design-system/.test(globalLayout))issues.push("Root app layout must not apply BO V2.3 token scope");
 if(!/node scripts\/verify-bo-v23-foundation\.mjs/.test(ci)||!/node --test scripts\/verify-bo-v23-foundation\.test\.mjs/.test(ci))issues.push("Required CI foundation verification missing");
 for(const [file,property,token,fallback] of BRIDGES){
  let text="";
  try{text=source(root,file)}catch{issues.push("Missing BO token bridge file: "+file);continue}
  const regex=new RegExp(esc(property)+"\\s*:\\s*var\\(\\s*"+esc(token)+"\\s*,\\s*"+esc(fallback)+"\\s*\\)\\s*;");
  if(!regex.test(text))issues.push("Missing or visually changed BO bridge: "+file+" "+property+" -> "+token+" fallback "+fallback);
  const defined=byName.get(token);
  if(defined&&/^#[\da-f]{6}$/i.test(defined)&&fallback.startsWith("#")){
   const expand=v=>v.length===4?"#"+v.slice(1).split("").map(a=>a+a).join(""):v;
   if(expand(defined).toLowerCase()!==expand(fallback).toLowerCase())issues.push("Token differs from backward-compatible fallback: "+token);
  }else if(defined&&/^\d+px$/.test(defined)&&fallback.endsWith("px")&&defined!==fallback)
   issues.push("Token differs from existing runtime size fallback: "+token);
 }
 return {issues,tokens:byName.size,expectedTokens:TOKENS.length,bridgeCount:BRIDGES.length,scope:"BO_ONLY",certification:issues.length?"FAIL":"SOURCE_FOUNDATION_PASS_NOT_UI_PARITY"};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const rootArg=process.argv.find(x=>x.startsWith("--root="));
 const root=rootArg?path.resolve(rootArg.slice(7)):ROOT;
 const result=verifyBoV23Foundation(root);
 console.log(JSON.stringify(result,null,2));
 if(result.issues.length)process.exitCode=1;
}
