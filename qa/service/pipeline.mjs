import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openQueue } from "./queue.mjs";
import { readBaseline, validateBaseline, verifyAcceptedSuite } from "./baseline.mjs";
import { cleanRevision, expectedGroups, executeClaim, runLocal } from "./worker.mjs";
const root=fileURLToPath(new URL("../../",import.meta.url));
export function validateRelease(receipt,run,revision) {
  const sha=/^[a-f0-9]{40}$/;
  const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  if(!run||!receipt||!sha.test(revision??"")||
      run.repository?.full_name!=="vmtct/pino-team-os"||
      run.head_repository?.full_name!=="vmtct/pino-team-os"||
      run.path!==".github/workflows/candidate-staging-deploy.yml"||
      run.name!=="Team Staging CD (Guarded)"||
      run.head_branch!=="main"||!["workflow_run","workflow_dispatch"].includes(run.event)||
      run.status!=="completed"||run.conclusion!=="success"||run.head_sha!==revision||
      !Number.isSafeInteger(run.id)||run.id<=0||
      receipt.kind!=="TEAM_GUARDED_STAGING_CD"||receipt.result!=="SERVING_BOUNDARY_PASS"||
      receipt.sourceSha!==revision||String(run.id)!==receipt.runId||
      receipt.productionMutation!==false||!uuid.test(receipt.activeVersionId??"")||
      !uuid.test(receipt.previousVersionId??"")||receipt.activeVersionId===receipt.previousVersionId||
      !uuid.test(receipt.coreVersion??"")) throw Error("CD_RECEIPT_NOT_ADMITTED");
  return {revision,cdRunId:run.id,teamVersion:receipt.activeVersionId,coreVersion:receipt.coreVersion};
}
export function runBatch(queue,release,executor,baseline=readBaseline(),verify=verifyAcceptedSuite) {
  const suites=validateBaseline(baseline);
  if(!suites.length) return {kind:"PAP2198_OFFLINE_REGRESSION",evidence:"AUTO_REGRESSION",
    state:"NO_ACCEPTED_BASELINE",...release,jobs:[],skipped:"No Founder-accepted regression suites are registered."};
  try { for(const suite of suites) verify(suite.surface,suite.feature,suites); } catch(error) { return {kind:"PAP2198_OFFLINE_REGRESSION",evidence:"AUTO_REGRESSION",state:"BASELINE_DRIFT",...release,jobs:[],reason:error.message}; }
  const selected=suites.map(({surface,feature})=>queue.enqueue({surface,feature,revision:release.revision}));
  const ids=new Set(selected.map(job=>job.id));
  let rows=queue.list();
  if(rows.length!==selected.length||rows.some(job=>!ids.has(job.id)||job.state==="RUNNING")) throw Error("QUEUE_NOT_EXCLUSIVE");
  for(let i=0;i<selected.length;i++) {
    const job=queue.claim();
    if(!job) break;
    if(!ids.has(job.id)) throw Error("UNEXPECTED_JOB");
    executor(queue,job);
  }
  rows=queue.list();
  const jobs=suites.map(suite=>{
    const row=rows.find(job=>job.surface===suite.surface&&job.feature===suite.feature);
    if(!row||!row.receipt||!["PASS","FAIL","BLOCKED","INVALIDATED"].includes(row.state)) throw Error("INCOMPLETE_BATCH");
    return {...suite,state:row.state,receipt:JSON.parse(row.receipt)};
  });
  if(rows.length!==selected.length||jobs.some(j=>j.receipt.revision!==release.revision||j.receipt.evidence!=="LOCAL_ONLY")) throw Error("INVALID_BATCH_RECEIPT");
  return {kind:"PAP2198_OFFLINE_REGRESSION",evidence:"AUTO_REGRESSION",...release,
    state:jobs.every(j=>j.state==="PASS")?"PASS":jobs.some(j=>["BLOCKED","INVALIDATED"].includes(j.state))?"BLOCKED":"FAIL",jobs};
}
function external(path) {
  if(!path||!isAbsolute(path)||path.startsWith("\\\\")) throw Error("ABSOLUTE_LOCAL_PATH_REQUIRED");
  const rel=relative(root,resolve(path));
  if(!rel||(!isAbsolute(rel)&&rel!==".."&&!rel.startsWith(".."+sep))) throw Error("OUTPUT_OUTSIDE_REPO_REQUIRED");
  return resolve(path);
}
function main() {
  const [receiptPath,runPath,dbPath,reportPath,...extra]=process.argv.slice(2);
  if(extra.length||!reportPath) throw Error("Usage: node qa/service/pipeline.mjs <receipt.json> <trusted-run.json> <absolute DB> <absolute report.json>");
  const outputs=[external(dbPath),external(reportPath)];
  if(outputs[0]===outputs[1]) throw Error("OUTPUT_COLLISION");
  const release=validateRelease(JSON.parse(readFileSync(receiptPath,"utf8")),JSON.parse(readFileSync(runPath,"utf8")),cleanRevision());
  const queue=openQueue(outputs[0]);
  try {
    const result=runBatch(queue,release,(q,j)=>executeClaim(q,j,{revision:cleanRevision,groups:expectedGroups,run:runLocal}));
    writeFileSync(outputs[1],JSON.stringify(result,null,2)+"\n",{flag:"wx"});
    console.log(JSON.stringify({state:result.state,evidence:result.evidence,revision:release.revision,cdRunId:release.cdRunId,suites:result.jobs.map(j=>({surface:j.surface,feature:j.feature,state:j.state}))}));
    if(["FAIL","BLOCKED","BASELINE_DRIFT"].includes(result.state)) process.exitCode=1;
  } finally {queue.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) main();
