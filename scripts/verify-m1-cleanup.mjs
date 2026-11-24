/** PAP-2346 / PLT-M1-DELIVERY. Read-only M4/production mock-removal evidence. */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, lstatSync, realpathSync } from "node:fs";
import { join, resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const sha = /^[a-f0-9]{40}$/;
const digest = /^[a-f0-9]{64}$/;
const safePath = p => typeof p === "string" && !p.includes("\\") && !isAbsolute(p) &&
  p.split("/").every(s => s && s !== "." && s !== ".." && /^[A-Za-z0-9_.()[\]-]+$/.test(s));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

function validateRegistration(f) {
  if (!/^PAP-[1-9][0-9]*$/.test(f?.jiraTask ?? "") || !["bo","ho"].includes(f.surface) ||
      !["M1","M4"].includes(f.phase) || !Array.isArray(f.sourceRoots) || !f.sourceRoots.length ||
      !f.sourceRoots.every(p=>safePath(p) && p.startsWith("app/"+f.surface+"/")) ||
      !Array.isArray(f.removedPaths) || !f.removedPaths.length || !f.removedPaths.every(safePath) ||
      !Array.isArray(f.markers) || !f.markers.some(m=>typeof m==="string" && /^[A-Z][A-Z0-9-]*-MOCK-001$/.test(m)) ||
      !f.markers.every(m=>typeof m==="string" && m.length>=8 && m.length<=200)) {
    throw new Error("Invalid feature registration");
  }
}

export function auditCleanup({ registry, mode, revision, sourceFiles, packageFiles, packageDigest }) {
  if (!sha.test(revision) || registry.sourceRevision!==revision ||
      !["M4","production"].includes(mode) || !Array.isArray(registry.features) || !registry.features.length ||
      !digest.test(packageDigest ?? "") || !Array.isArray(sourceFiles) || !Array.isArray(packageFiles) || !packageFiles.length) {
    throw new Error("Incomplete cleanup evidence");
  }
  registry.features.forEach(validateRegistration);
  if(new Set(registry.features.map(f=>f.jiraTask)).size!==registry.features.length) throw new Error("Duplicate feature registration");
  const selected=registry.features.filter(f=>mode==="production" || f.phase==="M4");
  if(!selected.length) throw new Error("No cleanup target");
  const inventory=packageFiles.map(({path,bytes})=>{
    if(!safePath(path) || !Buffer.isBuffer(bytes)) throw new Error("Invalid package file");
    return {path,size:bytes.length,sha256:hash(bytes)};
  }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if(new Set(inventory.map(f=>f.path.toLowerCase())).size!==inventory.length) throw new Error("Ambiguous package inventory");
  const computed=hash(JSON.stringify(inventory));
  const errors=[];
  if(computed!==packageDigest) errors.push({kind:"PACKAGE_DIGEST_MISMATCH"});
  for(const f of selected){
    if(f.phase==="M4"){
      const relevant=sourceFiles.filter(s=>f.sourceRoots.some(root=>s.path===root || s.path.startsWith(root+"/")));
      if(!relevant.length) errors.push({jiraTask:f.jiraTask,kind:"SOURCE_SCOPE_MISSING"});
      for(const path of f.removedPaths){
        if(sourceFiles.some(s=>s.path===path)) errors.push({jiraTask:f.jiraTask,kind:"REMOVED_PATH_PRESENT",path});
      }
      for(const s of relevant){
        for(const marker of f.markers) if(s.bytes.includes(Buffer.from(marker))) errors.push({jiraTask:f.jiraTask,kind:"SOURCE_MARKER",path:s.path,marker});
      }
    }
    for(const p of packageFiles){
      for(const marker of f.markers) if(p.bytes.includes(Buffer.from(marker))) errors.push({jiraTask:f.jiraTask,kind:"PACKAGE_MARKER",path:p.path,marker});
      if(f.removedPaths.some(path=>p.path===path || p.path.endsWith("/"+path))) errors.push({jiraTask:f.jiraTask,kind:"PACKAGE_PATH",path:p.path});
    }
  }
  return {mode,sourceRevision:revision,packageDigest:computed,selected:selected.map(f=>f.jiraTask),
    staticEvidencePass:errors.length===0,errors, runtimeNegative:"NOT_RUN", founderGate2:"PENDING_MANUAL",productionAuthorized:false};
}

export function readPackage(directory){
  const root=realpathSync(directory), files=[];
  if(!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) throw new Error("Invalid package root");
  function walk(dir){
    for(const name of readdirSync(dir)){
      const path=join(dir,name), stat=lstatSync(path), rel=relative(root,realpathSync(path));
      if(stat.isSymbolicLink() || isAbsolute(rel) || rel===".." || rel.startsWith(".."+(process.platform==="win32"?"\\":"/"))) throw new Error("Unsafe package entry");
      if(stat.isDirectory()) walk(path);
      else if(stat.isFile()) files.push({path:rel.split("\\").join("/"),bytes:readFileSync(path)});
      else throw new Error("Unsupported package entry");
    }
  }
  walk(root); return files;
}

export function verifyFromDisk(repo, registry, mode, packageDir, packageDigest){
  const git=(...args)=>execFileSync("git",["-C",repo,...args],{maxBuffer:32*1024*1024});
  const revision=git("rev-parse","HEAD").toString().trim();
  if(git("status","--porcelain").toString().trim()) throw new Error("Dirty source worktree");
  const paths=git("ls-files","-z").toString().split("\0").filter(Boolean);
  registry.features.forEach(validateRegistration);
  const selected=registry.features.filter(f=>f.phase==="M4");
  const sourceFiles=paths.map(path=>({path,bytes:selected.some(f=>f.sourceRoots.some(root=>path===root||path.startsWith(root+"/")))?git("show",revision+":"+path):Buffer.alloc(0)}));
  return auditCleanup({registry,mode,revision,sourceFiles,packageFiles:readPackage(packageDir),packageDigest});
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==7) throw new Error("Usage: node scripts/verify-m1-cleanup.mjs <repo> <registry.json> <M4|production> <package-dir> <expected-package-sha256>");
    const result=verifyFromDisk(process.argv[2],JSON.parse(readFileSync(process.argv[3],"utf8")),process.argv[4],process.argv[5],process.argv[6]);
    console.log(JSON.stringify(result,null,2)); if(!result.staticEvidencePass) process.exitCode=1;
  }catch(error){console.error(error.message);process.exitCode=1;}
}
