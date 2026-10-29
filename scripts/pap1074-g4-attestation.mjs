// PAP-1074 — independent, read-only GitHub/Cloudflare Staging deployment attestation.
// Never use caller-supplied destination URLs or print access tokens.
import { execFileSync } from "node:child_process";
const SHA = /^[0-9a-f]{40}$/;
const REPO = "vmtct/pino-team-os";
const SCRIPT = "pino-team-os-staging";

export function checkReceipt({sha, mainSha, localSha, runs, deployments}) {
  if (!SHA.test(sha || "") || sha !== mainSha || sha !== localSha) throw Error("G4_HOLD_MAIN_SHA_MISMATCH");
  if (!Array.isArray(runs) || !Array.isArray(deployments)) throw Error("G4_HOLD_RECEIPT_FORMAT");
  const matched = name => runs.find(x => x.name === name && x.head_sha === sha && x.status === "completed" && x.conclusion === "success");
  const mainCI = matched("PR Validation");
  const stagingCD = matched("Team Staging CD (Guarded)");
  if (!mainCI || !stagingCD) throw Error("G4_HOLD_CI_OR_CD_NOT_SUCCESS");
  const d = deployments[0];
  const msg = d?.annotations?.["workers/message"] || "";
  const traffic = d?.versions?.reduce((n, version) => n + (version.percentage ?? 0), 0);
  if (!d || d.versions?.length !== 1 || traffic !== 100 ||
      !msg.includes("staging sha=" + sha + " run=" + stagingCD.id)) {
    throw Error("G4_HOLD_WORKER_NOT_100_PERCENT_EXACT_SHA");
  }
  return {sha,mainCI:mainCI.id,stagingCD:stagingCD.id};
}

async function getJson(url, token) {
  const r = await fetch(url, { headers: {
    authorization: "Bearer " + token,
    accept: "application/json",
    "user-agent": "PINO-PAP1074-G4-attestation"
  }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw Error("G4_HOLD_ATTESTATION_PROVIDER_UNAVAILABLE");
  return r.json();
}

export async function verifyStaging(env = process.env) {
  if (env.CI !== "true" || env.GITHUB_REPOSITORY !== REPO ||
      env.GITHUB_REF !== "refs/heads/main" || !SHA.test(env.GITHUB_SHA || "") ||
      !env.GITHUB_TOKEN || !env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
    throw Error("G4_HOLD_UNAUTHORIZED_OR_MISSING_ATTESTATION_INPUT");
  }
  const sha = env.GITHUB_SHA;
  const localSha = execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8",timeout:12000}).trim();
  const main = await getJson("https://api.github.com/repos/" + REPO + "/branches/main",env.GITHUB_TOKEN);
  const runs = await getJson("https://api.github.com/repos/" + REPO + "/actions/runs?head_sha=" + sha + "&per_page=100",env.GITHUB_TOKEN);
  const cf = await getJson("https://api.cloudflare.com/client/v4/accounts/" +
    encodeURIComponent(env.CF_ACCOUNT_ID) + "/workers/scripts/" + SCRIPT + "/deployments?per_page=1",env.CF_API_TOKEN);
  if (cf.success !== true) throw Error("G4_HOLD_CLOUDFLARE_API_FAILURE");
  return checkReceipt({sha,mainSha:main?.commit?.sha,localSha,runs:runs.workflow_runs,
    deployments:cf.result?.deployments || cf.result});
}
