/** PAP-2344 / PLT-M1-DELIVERY: advisory candidate classifier; never changes required CI checks. */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const sha=/^[a-f0-9]{40}$/;
const rootPattern=/^app\/(bo|ho)\/(?:[a-z0-9-]+\/)*[a-z0-9-]+$/;
const pathPattern=/^[A-Za-z0-9_.()/\-]+$/;
const forbidden=/(?:^|\/)(?:api|auth|acl|actions?|server|shared|components|design-system|shell|layout|middleware|config|lib|hooks)(?:\/|\.|$)/i;
const uiFile=/\.(?:tsx|module\.css)$/;
export function classify({base,head,changes,featureRoot}){
  const full=reason=>({classification:"FULL_PIPELINE",reason,requiredChecks:"UNCHANGED",canSkipChecks:false});
  if(!sha.test(base??"")||!sha.test(head??"")||base===head) return full("invalid-revision");
  if(!rootPattern.test(featureRoot??"")||forbidden.test(featureRoot)) return full("unknown-feature-root");
  if(!Array.isArray(changes)||!changes.length) return full("empty-or-unknown-diff");
  for(const c of changes){
    const p=c?.path;
    if(!["A","M"].includes(c?.status)||typeof p!=="string"||!pathPattern.test(p)||p.split("/").some(x=>!x||x==="."||x==="..")) return full("ambiguous-change");
    if(!p.startsWith(featureRoot+"/")||!uiFile.test(p)||forbidden.test(p)||/(?:^|\/)(?:page|loading|error|not-found|template|route)\./i.test(p)) return full("not-feature-local-presentation");
  }
  if(new Set(changes.map(c=>c.path.toLowerCase())).size!==changes.length) return full("ambiguous-paths");
  return {classification:"FE_ONLY_CANDIDATE",reason:"feature-local-presentation-paths-only",requiredChecks:"UNCHANGED",canSkipChecks:false};
}
export function classifyGit(repo,base,head,featureRoot){
  if(!sha.test(base??"")||!sha.test(head??"")) return classify({base,head,featureRoot});
  const git=(...args)=>execFileSync("git",["-C",repo,...args]);
  try{
    git("merge-base","--is-ancestor",base,head);
    const raw=git("diff","--name-status","-z","--no-renames",base,head,"--").toString().split("\0");
    if(raw.pop()!==""||raw.length%2) return classify({base,head,featureRoot});
    const changes=[];for(let i=0;i<raw.length;i+=2)changes.push({status:raw[i],path:raw[i+1]});
    return classify({base,head,featureRoot,changes});
  }catch{return classify({base,head,featureRoot});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==6){console.error("Usage: node scripts/classify-m1-fe-candidate.mjs <repo> <base-sha> <head-sha> <feature-root>");process.exitCode=1;}
  else console.log(JSON.stringify(classifyGit(...process.argv.slice(2)),null,2));
}
