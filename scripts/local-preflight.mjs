import {execFileSync} from "node:child_process";
import {existsSync,readFileSync,statSync} from "node:fs";
import {dirname,isAbsolute,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
export function untrackedTrailingWhitespace(content){
 if(content.includes(0))return false;
 return content.toString("utf8").split(/\r?\n/).some(line=>/[ \t]+$/.test(line));
}
export const mismatch=(p,s,repo)=>repo==="pino-core"&&/^scripts\/[^/]+\.test\.mjs$/.test(p)&&/\b(?:readFileSync|readdirSync|statSync|existsSync)\s*\(/.test(s);
export function plan(paths,repo){
 const f=[...new Set(paths.filter(Boolean))].sort();
 return {files:f,syntax:f.filter(p=>/\.(?:mjs|cjs|js)$/.test(p)),workflows:f.filter(p=>/^\.github\/workflows\/[^/]+\.ya?ml$/.test(p)),nodeTests:f.filter(p=>/\.node-test\.mjs$/.test(p)),coreTests:repo==="pino-core"?f.filter(p=>/^(?:test|src)\/.+\.test\.tsx?$/.test(p)):[],teamTests:repo==="pino-team-os"?f.filter(p=>/^lib\/[^/]+\.test\.ts$/.test(p)):[],ts:f.some(p=>/\.tsx?$/.test(p))};
}
function exec(file,args,quiet=true){
 try {const o=execFileSync(file,args,{cwd:root,encoding:"utf8",maxBuffer:8000000,stdio:["ignore","pipe","pipe"]});if(!quiet&&o.trim())console.log(o);return o;}
 catch(e){throw new Error([file,...args].join(" ")+": "+String(e.stderr||e.message).slice(0,1500));}
}
const git=(...args)=>exec("git",args).trim();
const files=(args)=>exec("git",args).split("\0").filter(Boolean).map(s=>s.replaceAll("\\","/"));
function step(label,fn){process.stdout.write("[PAP-961] "+label+" ... ");try{fn();console.log("PASS");}catch(e){console.error("FAIL "+e.message);throw e;}}
export function run(base="origin/main"){
 const repo=JSON.parse(readFileSync(resolve(root,"package.json"),"utf8")).name;
 if(!["pino-core","pino-team-os"].includes(repo))throw new Error("Unsupported repository: "+repo);
 let changed;let untracked;
 step("Git state and whitespace",()=>{
  git("rev-parse","--verify",base);
  for(const state of ["CHERRY_PICK_HEAD","MERGE_HEAD","REBASE_HEAD","rebase-merge","rebase-apply"]){
   let p=git("rev-parse","--git-path",state);if(!isAbsolute(p))p=resolve(root,p);
   if(existsSync(p))throw new Error("unfinished "+state+"; reconcile before push");
  }
  if(git("ls-files","-u"))throw new Error("unmerged index");
  exec("git",["diff","--check",base]);exec("git",["diff","--check"]);exec("git",["diff","--cached","--check"]);
  untracked=files(["ls-files","--others","--exclude-standard","-z"]);
  changed=[...new Set([...files(["diff","--name-only","--diff-filter=ACMRT","-z",base]),...untracked])];
  for(const f of untracked){const full=resolve(root,f);if(!existsSync(full)||statSync(full).size>2000000)continue;if(untrackedTrailingWhitespace(readFileSync(full)))throw new Error("untracked file has trailing whitespace: "+f); }
 });
 const p=plan(changed,repo);
 console.log("[PAP-961] repo="+repo+" changed="+p.files.length+" workflows="+p.workflows.length);
 step("Changed JS syntax",()=>{for(const f of p.syntax)if(existsSync(resolve(root,f)))exec(process.execPath,["--check",f]);});
 step("Core Vitest/filesystem runner mismatch",()=>{for(const f of p.files)if(f.endsWith(".test.mjs")&&existsSync(resolve(root,f))&&mismatch(f,readFileSync(resolve(root,f),"utf8"),repo))throw new Error(f+" must use .node-test.mjs with node --test (filesystem-based suite)");});
 if(p.workflows.length)step("actionlint changed workflows",()=>{
  const tool=process.env.PINO_ACTIONLINT||"actionlint";if(process.env.PINO_ACTIONLINT&&!existsSync(tool))throw new Error("PINO_ACTIONLINT missing");
  try{exec(tool,p.workflows);}catch(e){throw new Error(e.message+"; install actionlint or set PINO_ACTIONLINT");}
 });
 if(p.ts)step("TypeScript tooling",()=>{if(!existsSync(resolve(root,"node_modules/typescript/package.json")))throw new Error("TOOLING_MISSING: TypeScript dependency; install deps with repo lockfile; not a business-test failure");});
 if(p.nodeTests.length)step("Changed Node suites",()=>exec(process.execPath,["--test",...p.nodeTests]));
 if(p.coreTests.length)step("Changed Core Vitest suites",()=>{const bin=resolve(root,"node_modules/vitest/vitest.mjs");if(!existsSync(bin))throw new Error("TOOLING_MISSING: Vitest");exec(process.execPath,[bin,"run",...p.coreTests]);});
 if(p.teamTests.length)step("Changed Team node+tsx suites",()=>{if(!existsSync(resolve(root,"node_modules/tsx/package.json")))throw new Error("TOOLING_MISSING: tsx");exec(process.execPath,["--import","tsx","--test","--test-concurrency=1",...p.teamTests]);});
 console.log("[PAP-961] LOCAL_PREFLIGHT_PASS (not exact-head CI or Production admission)");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{
 if(process.argv.length>3)throw new Error("Usage: node scripts/local-preflight.mjs [--base=origin/main]");
 const a=process.argv[2];if(a&&!a.startsWith("--base="))throw new Error("Invalid option");
 run(a?.slice(7)||"origin/main");
}catch(e){console.error("[PAP-961] LOCAL_PREFLIGHT_FAIL: "+e.message);process.exitCode=1;}
