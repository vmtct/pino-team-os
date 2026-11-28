/** PAP-2346 / PLT-M1-DELIVERY: bounded lexical coverage audit, not runtime or semantic proof. */
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const sourcePath = p => typeof p==="string" && /^(app|lib)\/[A-Za-z0-9_./()[\]-]+\.(?:tsx?|jsx?|mjs|cjs)$/.test(p) &&
  !p.split("/").some(s=>s===".."||s==="."||s==="") && !/\.(?:test|spec)\.[^.]+$/.test(p);
const markers=Object.freeze([
  ["ACTIVATION",/\bm1Preview\b/],
  ["FIXTURE_ID",/\b[A-Z][A-Z0-9-]*-MOCK-\d{3,}\b/],
  ["M1_LABEL",/\bM1 FE Shell\b/],
  ["SHARED_LIFECYCLE",/\b(?:createPreviewState|decideM1Preview)\b/],
]);
export function discoverCoverage(files){
  return files.filter(f=>sourcePath(f.path)).flatMap(f=>{
    if(!Buffer.isBuffer(f.bytes))throw Error("Source bytes required");
    const text=f.bytes.toString("utf8");
    const signals=markers.filter(([,re])=>re.test(text)).map(([name])=>name);
    return signals.length?[{path:f.path,signals}]:[];
  }).sort((a,b)=>a.path.localeCompare(b.path,"en"));
}
export function auditCoverage({revision,registry,files}){
  if(!/^[a-f0-9]{40}$/.test(revision)||registry?.sourceRevision!==revision||!Array.isArray(registry.features)||!registry.features.length)
    throw Error("Exact-revision registry required");
  const ownership=new Map(),tasks=new Set();
  for(const feature of registry.features){
    if(!/^PAP-[1-9][0-9]*$/.test(feature.jiraTask??"")||tasks.has(feature.jiraTask)||!["M1","M4"].includes(feature.phase)||!Array.isArray(feature.coverageFiles)||!feature.coverageFiles.length)
      throw Error("Invalid coverage registration");
    tasks.add(feature.jiraTask);
    for(const p of feature.coverageFiles){
      if(!sourcePath(p))throw Error("Invalid coverage path");
      const owners=ownership.get(p)??[];
      if(owners.some(o=>o.jiraTask===feature.jiraTask))throw Error("Duplicate coverage path");
      ownership.set(p,[...owners,{jiraTask:feature.jiraTask,phase:feature.phase}]);
    }
  }
  const discovered=discoverCoverage(files);
  const uncovered=discovered.filter(f=>!ownership.has(f.path));
  const m4Residual=discovered.flatMap(f=>{const owners=ownership.get(f.path)??[];return owners.some(o=>o.phase==="M1")?[]:owners.filter(o=>o.phase==="M4").map(o=>({...f,jiraTask:o.jiraTask}));});
  const sharedReview=discovered.filter(f=>{const owners=ownership.get(f.path)??[];return owners.some(o=>o.phase==="M1")&&owners.some(o=>o.phase==="M4");});
  return {sourceRevision:revision,discovered,uncovered,m4Residual,sharedReview,lexicalCoveragePass:uncovered.length===0&&m4Residual.length===0,
    semanticCompleteness:"NOT_PROVEN",runtimeNegative:"NOT_RUN",productionAuthorized:false};
}
function readSource(repo){
  const git=(...args)=>execFileSync("git",["-C",repo,...args],{maxBuffer:32*1024*1024});
  const revision=git("rev-parse","HEAD").toString().trim();
  if(git("status","--porcelain").toString().trim())throw Error("Dirty source");
  // Broad indexed candidate search, then exact marker matching on committed bytes.
  let paths=[];
  try{paths=git("grep","--cached","-l","-z","-E","m1Preview|[A-Z][A-Z0-9-]*-MOCK-[0-9]{3,}|M1 FE Shell|createPreviewState|decideM1Preview","--","app","lib").toString().split("\0").filter(sourcePath);}
  catch(error){if(error.status!==1)throw error;}
  const files=paths.map(path=>({path,bytes:git("show",revision+":"+path)}));
  return {revision,files};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==4)throw Error("Usage: node scripts/verify-m1-registry-coverage.mjs <repo> <registry.json|--discover>");
    const {revision,files}=readSource(process.argv[2]);
    const result=process.argv[3]==="--discover"?{sourceRevision:revision,discovered:discoverCoverage(files),semanticCompleteness:"NOT_PROVEN",productionAuthorized:false}:auditCoverage({revision,files,registry:JSON.parse(readFileSync(process.argv[3],"utf8"))});
    console.log(JSON.stringify(result,null,2));
    if(result.lexicalCoveragePass===false)process.exitCode=1;
  }catch(e){console.error(e.message);process.exitCode=1;}
}
