import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const probes = Object.freeze([
  { name:"bo_login_public", url:"https://bo.pinohouse.art/staff-login", allowed:[200] },
  { name:"bo_missions_login_redirect", url:"https://bo.pinohouse.art/bo/missions", allowed:[307,302,303] },
  { name:"bo_missions_api_denied", url:"https://bo.pinohouse.art/api/bo/learning/missions", allowed:[401,403] },
  { name:"bo_instances_api_denied", url:"https://bo.pinohouse.art/api/bo/pinoria/worlds/instances", allowed:[401,403] },
  { name:"bo_host_not_exposed_on_tos", url:"https://tos.pinohouse.art/bo/missions", allowed:[404] },
  { name:"bo_api_not_exposed_on_tos", url:"https://tos.pinohouse.art/api/bo/learning/missions", allowed:[404] }
]);

const exact = (body, label) => new RegExp("^\\s*-\\s*"+label+":\\s*(\\S+)\\s*$","mi").exec(body)?.[1]||null;
export function releaseReceipt(comments, runId, expectedSha) {
  if (!/^[0-9]+$/.test(String(runId)) || !/^[0-9a-f]{40}$/.test(expectedSha)) return null;
  const match = comments.find(c => c.user?.login === "github-actions[bot]" &&
    c.body?.startsWith("TEAM_RUNTIME_PRODUCTION_RELEASE: **PASS**") &&
    exact(c.body,"Workflow run") === String(runId) &&
    exact(c.body,"Team source") === expectedSha &&
    exact(c.body,"Traffic") === "100%");
  if(!match) return null;
  const version = exact(match.body,"Team Worker version");
  const deployment = exact(match.body,"Deployment ID");
  if(!/^[0-9a-f-]{36}$/.test(version||"") || !/^[0-9a-f-]{36}$/.test(deployment||"")) return null;
  return {releaseRunId:String(runId),sourceSha:expectedSha,workerVersion:version,deploymentId:deployment,traffic:"100%",receiptCommentId:match.id};
}

export async function smoke(fetcher, identity, cases=probes) {
  if (!identity) return {status:"NOT_RUN",reason:"NO_VERIFIED_RELEASE_RECEIPT",authenticatedProductUat:"NOT_RUN",probes:[]};
  const results=[];
  for(const check of cases){
    if(!["bo.pinohouse.art","tos.pinohouse.art"].includes(new URL(check.url).hostname))
      return {status:"FAIL",identity,reason:"INVALID_PROBE_HOST",authenticatedProductUat:"NOT_RUN",probes:results};
    try{
      const response=await fetcher(check.url,{method:"GET",redirect:"manual",signal:AbortSignal.timeout(10000)});
      const passed=check.allowed.includes(response.status);
      const location=response.headers?.get?.("location")||"";
      const redirectSafe=check.name === "bo_missions_login_redirect" ? new URL(location,"https://bo.pinohouse.art").pathname === "/staff-login" : true;
      results.push({name:check.name,httpStatus:response.status,status:passed&&redirectSafe?"PASS":"FAIL"});
    }catch(e){results.push({name:check.name,status:"FAIL",error:e?.name==="TimeoutError"?"TIMEOUT":"NETWORK_OR_PROVIDER_ERROR"});}
  }
  return {status:results.some(r=>r.status==="FAIL")?"FAIL":"PASS",identity,authenticatedProductUat:"NOT_RUN",probes:results};
}

export async function run({fetcher=fetch,env=process.env}={}){
  let identity=null, reason=null;
  try{
    if(!env.GITHUB_TOKEN || !env.RELEASE_RUN_ID || !env.TEAM_SHA) reason="MISSING_RELEASE_INPUT";
    else{
      const uri="https://api.github.com/repos/vmtct/pino-team-os/issues/comments?per_page=100&sort=created&direction=desc";
      const res=await fetcher(uri,{method:"GET",headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+env.GITHUB_TOKEN,"X-GitHub-Api-Version":"2022-11-28"},signal:AbortSignal.timeout(10000)});
      if(!res.ok) reason="RECEIPT_READ_UNAVAILABLE";
      else identity=releaseReceipt(await res.json(),env.RELEASE_RUN_ID,env.TEAM_SHA);
    }
  }catch{reason="RECEIPT_READ_UNAVAILABLE";}
  const result=await smoke(fetcher,identity);
  if(reason && result.status==="NOT_RUN") result.reason=reason;
  result.generatedAt=new Date().toISOString();
  writeFileSync(env.REPORT_FILE||"release-confidence-smoke.json",JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result));
  return result;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const result=await run();
  if(result.status==="FAIL") process.exitCode=1;
  if(result.status==="NOT_RUN") console.log("::warning::Product Smoke NOT_RUN; this is not Product Accepted.");
}
