import { readdirSync, mkdirSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openQueue, validateSelection } from "./queue.mjs";

const root=fileURLToPath(new URL("../../",import.meta.url));
export function expectedGroups(surface,feature="") {
  if(!["ho","bo","tos"].includes(surface)) throw Error("INVALID_SURFACE");
  const names=readdirSync(resolve(root,"qa","cases",surface))
    .filter(n=>/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(n))
    .map(n=>n.slice(0,-5)).sort().filter(n=>!feature||n===feature);
  if(!names.length||names.includes("shared-staging-proof")) throw Error("UNKNOWN_LOCAL_CASE");
  return ["shared-staging-proof",...names];
}
export function classifyResult(job,expected,{status,error,signal,stdout}) {
  if(error||signal||!Number.isInteger(status)) return {state:"BLOCKED",reason:"RUNNER_TRANSPORT",groups:[]};
  const groups=[];
  for(const line of String(stdout??"").split(/\r?\n/)) {
    if(!line.startsWith("{")) continue;
    let item;try{item=JSON.parse(line);}catch{continue;}
    if(!item||!Object.hasOwn(item,"surface")||!Object.hasOwn(item,"feature")||item.mode!=="local") continue;
    if(item.surface!==job.surface||!expected.includes(item.feature)||!["PASS","FAIL"].includes(item.result)||!Number.isSafeInteger(item.elapsedMs)||item.elapsedMs<0)
      return {state:"BLOCKED",reason:"INVALID_GROUP_RECEIPT",groups:[]};
    groups.push({feature:item.feature,result:item.result,elapsedMs:item.elapsedMs});
  }
  if(groups.length!==expected.length||groups.some((g,i)=>g.feature!==expected[i])) return {state:"BLOCKED",reason:"INCOMPLETE_GROUP_RECEIPT",groups};
  const failed=groups.some(g=>g.result==="FAIL");
  if((status===0)===failed) return {state:"BLOCKED",reason:"EXIT_RECEIPT_MISMATCH",groups};
  return {state:failed?"FAIL":"PASS",reason:failed?"LOCAL_REGRESSION_FAILED":"LOCAL_REGRESSION_COMPLETE",groups};
}
export function executeClaim(queue,job,{revision,groups,run}) {
  const started=Date.now();
  let result;
  try {
    validateSelection(job.surface,job.feature,job.revision);
    if(revision()!==job.revision) result={state:"INVALIDATED",reason:"SOURCE_DRIFT_BEFORE",groups:[]};
    else {
      const expected=groups(job.surface,job.feature);
      result=classifyResult(job,expected,run(job));
      if(revision()!==job.revision) result={state:"INVALIDATED",reason:"SOURCE_DRIFT_AFTER",groups:[]};
    }
  } catch {result={state:"BLOCKED",reason:"LOCAL_PREFLIGHT_OR_RUNNER_ERROR",groups:[]};}
  const {state,...details}=result;
  return queue.finish(job.id,state,{...details,evidence:"LOCAL_ONLY",revision:job.revision,elapsedMs:Date.now()-started});
}
export function cleanRevision() {
  if(execFileSync("git",["status","--porcelain"],{cwd:root,encoding:"utf8",timeout:15000}).trim()) return null;
  return execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8",timeout:15000}).trim();
}
function localEnvironment() {
  const allowed=new Set(["path","systemroot","windir","temp","tmp","home","userprofile","localappdata","appdata","homedrive","homepath","comspec","pathext","processor_architecture","number_of_processors","programfiles","programfiles(x86)","programdata"]);
  return Object.fromEntries(Object.entries(process.env).filter(([k])=>allowed.has(k.toLowerCase())));
}
export function runLocal(job) {
  return spawnSync(process.execPath,["qa/run.mjs",job.surface,"local",...(job.feature?[job.feature]:[])],{
    cwd:root,env:localEnvironment(),encoding:"utf8",stdio:["ignore","pipe","pipe"],maxBuffer:32*1024*1024,windowsHide:true
  });
}
function main() {
  const [path,operation,surface,feature="",...extra]=process.argv.slice(2);
  if(!path||!isAbsolute(path)||path.startsWith("\\\\")||extra.length||!["enqueue","list","work-once"].includes(operation)||
      (operation==="enqueue"?!surface:surface!==undefined)) throw Error("Usage: node qa/service/worker.mjs <absolute local db outside repo> enqueue ho|bo|tos [feature] | list | work-once");
  const dbPath=resolve(path), rel=relative(root,dbPath);
  if(!rel||(!isAbsolute(rel)&&rel!==".."&&!rel.startsWith(".."+sep))) throw Error("DB_MUST_BE_OUTSIDE_REPOSITORY");
  mkdirSync(dirname(dbPath),{recursive:true});
  const queue=openQueue(dbPath);
  try {
    if(operation==="list") console.log(JSON.stringify(queue.list()));
    else if(operation==="enqueue") {
      expectedGroups(surface,feature);
      const revision=cleanRevision();
      validateSelection(surface,feature,revision);
      console.log(JSON.stringify(queue.enqueue({surface,feature,revision})));
    } else {
      const job=queue.claim();
      if(!job){console.log(JSON.stringify({state:"IDLE_OR_RUNNING"}));return;}
      const result=executeClaim(queue,job,{revision:cleanRevision,groups:expectedGroups,run:runLocal});
      console.log(JSON.stringify(result));
      if(result.state!=="PASS") process.exitCode=1;
    }
  } finally{queue.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) main();
