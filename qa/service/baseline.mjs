import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {isAbsolute,resolve,relative,sep} from "node:path";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../../",import.meta.url));
const surfaces=["ho","bo","tos"];
const featureKey=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const acceptance=/^PAP-\d+#\d+$/;
export function validateBaseline(value) {
  if(!value||value.schemaVersion!==1||value.policy!=="AUTOMATION_SCOPE_REGRESSION_ONLY_V1"||!Array.isArray(value.suites)) throw Error("INVALID_REGRESSION_BASELINE");
  const seen=new Set();
  for(const entry of value.suites) {
    const key=entry&&(entry.surface+"/"+entry.feature);
    if(!entry||!surfaces.includes(entry.surface)||!featureKey.test(entry.feature??"")||
      !acceptance.test(entry.acceptanceRef??"")||typeof entry.acceptedAt!=="string"||
      !Number.isFinite(Date.parse(entry.acceptedAt))||new Date(entry.acceptedAt).toISOString()!==entry.acceptedAt||
      !Array.isArray(entry.testFiles)||!entry.testFiles.length||seen.has(key)) throw Error("INVALID_REGRESSION_BASELINE_ENTRY");
    const paths=new Set();
    for(const item of entry.testFiles) {
      const p=item?.path;
      if(typeof p!=="string"||!p||p.includes("\\")||isAbsolute(p)||p.split("/").includes("..")||
        typeof item.sha256!=="string"||!/^[a-f0-9]{64}$/.test(item.sha256)||paths.has(p)) throw Error("INVALID_REGRESSION_TEST_PIN");
      paths.add(p);
    }
    seen.add(key);
  }
  return value.suites.map(x=>({...x,testFiles:x.testFiles.map(f=>({...f}))}));
}
export function readBaseline() {
  const value=JSON.parse(readFileSync(resolve(root,"qa/service/regression-baseline.json"),"utf8"));
  validateBaseline(value);
  return value;
}
export function verifyAcceptedSuite(surface,feature,suites=readBaseline(),repoRoot=root) {
  const suite=suites.find(x=>x.surface===surface&&x.feature===feature);
  if(!suite) throw Error("FEATURE_NOT_FOUNDER_ACCEPTED_FOR_REGRESSION");
  const manifestPath=resolve(repoRoot,"qa","cases",surface,feature+".json");
  const rel=relative(repoRoot,manifestPath);
  if(!rel||rel.startsWith("..")) throw Error("BASELINE_MANIFEST_ESCAPE");
  const manifest=JSON.parse(readFileSync(manifestPath,"utf8"));
  const paths=suite.testFiles.map(x=>x.path);
  if(!Array.isArray(manifest.tests)||manifest.tests.length!==paths.length||manifest.tests.some((p,i)=>p!==paths[i])) throw Error("BASELINE_TESTSET_DRIFT");
  for(const item of suite.testFiles) {
    const path=resolve(repoRoot,item.path);
    const fileRel=relative(repoRoot,path);
    if(!fileRel||fileRel===".."||fileRel.startsWith(".."+sep)) throw Error("BASELINE_TEST_PATH_ESCAPE");
    const hash=createHash("sha256").update(readFileSync(path)).digest("hex");
    if(hash!==item.sha256) throw Error("BASELINE_TEST_HASH_DRIFT");
  }
  return true;
}
