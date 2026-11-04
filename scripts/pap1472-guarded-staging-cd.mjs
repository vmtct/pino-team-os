// PAP-1472 / Epic PAP-184 — Cloudflare eventually-consistent guarded Staging CD.
// An old deployment read is NOT proof that an attempted rollout was rolled back.
import { readFile, writeFile } from "node:fs/promises";

export function classifyDeployment(raw, { previousVersion, previousMessage, targetMessage, rollbackMessage }) {
  if (raw?.success !== true || !Array.isArray(raw.result?.deployments)) return "UNKNOWN";
  const deployment = raw.result.deployments[0];
  if (!deployment || !Array.isArray(deployment.versions) || !deployment.versions.length) return "UNKNOWN";
  if (deployment.versions.length !== 1) return "CONFLICT";
  const only = deployment.versions[0];
  if (typeof only.version_id !== "string" || only.percentage !== 100) return "CONFLICT";
  const message = deployment.annotations?.["workers/message"];
  if (only.version_id === previousVersion && message === rollbackMessage) return "ROLLED_BACK";
  if (only.version_id === previousVersion && message === previousMessage) return "PREVIOUS";
  if (only.version_id !== previousVersion && message === targetMessage) return "TARGET";
  return "CONFLICT";
}

export async function waitForDeployment({ read, context, desired, attempts = 20, delay = async () => {} }) {
  if (!["TARGET", "ROLLED_BACK"].includes(desired)) throw Error("INVALID_DESIRED_STATE");
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let raw;
    try { raw = await read(); } catch { raw = null; }
    const state = classifyDeployment(raw, context);
    if (state === desired) return { raw, attempt };
    if (state === "CONFLICT") throw Error("STAGING_CD_CONFLICTING_WRITER");
    if (attempt < attempts) await delay();
  }
  throw Error(desired === "TARGET" ? "STAGING_CD_TARGET_READBACK_HOLD" : "STAGING_CD_ROLLBACK_READBACK_HOLD");
}

export async function rollbackIfOwned({ read, write, context, attempts = 20, delay = async () => {} }) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let raw;
    try { raw = await read(); } catch { raw = null; }
    const state = classifyDeployment(raw, context);
    if (state === "ROLLED_BACK") return { raw, attempt, alreadyRolledBack: true };
    if (state === "CONFLICT") throw Error("STAGING_CD_CONFLICTING_WRITER");
    if (state === "TARGET") {
      // Narrow concurrent-writer race; Cloudflare POST is not atomic CAS.
      const fresh = await read().catch(() => null);
      if (classifyDeployment(fresh, context) !== "TARGET")
        throw Error("STAGING_CD_PRE_ROLLBACK_CAS_HOLD");
      try { await write(context.previousVersion, context.rollbackMessage); }
      catch { /* POST could have committed before connection failed; verify before retry. */ }
      const verified = await waitForDeployment({ read, context, desired: "ROLLED_BACK", attempts, delay });
      return { ...verified, alreadyRolledBack: false };
    }
    if (attempt < attempts) await delay();
  }
  throw Error("STAGING_CD_ROLLBACK_OWNERSHIP_HOLD");
}

async function main() {
  const [action, beforePath, previousVersion, targetMessage, account, worker] = process.argv.slice(2);
  if (!["wait-target", "rollback"].includes(action) || !beforePath || !previousVersion ||
      !targetMessage?.startsWith("team-cd-guarded staging sha=") || !account || !worker)
    throw Error("PAP1472_INVALID_CLI_ARGUMENTS");
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw Error("PAP1472_MISSING_STAGING_CLOUDFLARE_TOKEN");
  const before = JSON.parse(await readFile(beforePath, "utf8"));
  const deployment = before.result?.deployments?.[0];
  if (before.success !== true || deployment?.versions?.length !== 1 ||
      deployment.versions[0].percentage !== 100 ||
      deployment.versions[0].version_id !== previousVersion)
    throw Error("PAP1472_INVALID_PREVIOUS_DEPLOYMENT_RECEIPT");
  const context = {
    previousVersion, previousMessage: deployment.annotations?.["workers/message"] || "",
    targetMessage,
    rollbackMessage: "team-cd guarded rollback from sha=" + targetMessage.split(" sha=")[1]?.split(" ")[0],
  };
  const url = "https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(account) +
              "/workers/scripts/" + encodeURIComponent(worker) + "/deployments";
  const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  const read = async () => {
    const response = await fetch(url + "?per_page=1", { headers, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw Error("CF_GET_FAILED");
    return response.json();
  };
  const write = async (version, message) => {
    const body = { strategy: "percentage", versions: [{ version_id: version, percentage: 100 }], annotations: { "workers/message": message } };
    await writeFile("rollback.json", JSON.stringify(body, null, 2) + "\n");
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (!response.ok || (await response.json()).success !== true) throw Error("CF_ROLLBACK_POST_FAILED");
  };
  const delay = () => new Promise(resolve => setTimeout(resolve, 2500));
  if (action === "wait-target") {
    const result = await waitForDeployment({ read, context, desired: "TARGET", attempts: 20, delay });
    await writeFile("after.json", JSON.stringify(result.raw, null, 2) + "\n");
    process.stdout.write("PAP1472_TARGET_READBACK_PASS attempts=" + result.attempt +
      " version=" + result.raw.result.deployments[0].versions[0].version_id + "\n");
  } else {
    const result = await rollbackIfOwned({ read, write, context, attempts: 20, delay });
    await writeFile("rollback-final.json", JSON.stringify(result.raw, null, 2) + "\n");
    process.stdout.write("PAP1472_ROLLBACK_READBACK_PASS attempts=" + result.attempt + "\n");
  }
}

if (process.argv[1] && /pap1472-guarded-staging-cd\.mjs$/i.test(process.argv[1])) {
  main().catch(error => {
    process.stderr.write("PAP1472_STAGING_CD_HOLD: " + error.message + "\n");
    process.exitCode = 1;
  });
}
