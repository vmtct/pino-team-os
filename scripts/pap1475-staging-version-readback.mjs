// PAP-1475 / Epic PAP-184 — read-after-write Cloudflare Worker version metadata.
// A validated 100%-serving deployment may precede per-version metadata propagation.
// No mutation, rollback ownership, or service-binding checks are relaxed here.
import { writeFile } from "node:fs/promises";

const VERSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function waitForWorkerVersion({
  read, expectedVersion, attempts = 20, delay = async () => {},
}) {
  if (!VERSION_ID.test(expectedVersion) || !Number.isSafeInteger(attempts) || attempts < 1 || attempts > 30)
    throw Error("PAP1475_INVALID_VERSION_READBACK_ARGS");
  for (let attempt = 1; attempt <= attempts; attempt++) {
    // Only HTTP 404 is an expected propagation race; other errors fail closed.
    const result = await read();
    if (result?.status === 404) {
      if (attempt < attempts) { await delay(); continue; }
      throw Error("STAGING_CD_VERSION_METADATA_404_HOLD");
    }
    if (!result || result.status !== 200)
      throw Error("STAGING_CD_VERSION_METADATA_HTTP_" + String(result?.status ?? "UNKNOWN"));
    const body = result.body;
    if (body?.success !== true || body.result?.id !== expectedVersion ||
        !Array.isArray(body.result.resources?.bindings) || body.result.resources.bindings.length === 0)
      throw Error("STAGING_CD_VERSION_METADATA_MISMATCH");
    return { body, attempt };
  }
  throw Error("STAGING_CD_VERSION_METADATA_HOLD");
}

async function main() {
  const [accountId, scriptName, versionId, outputFile] = process.argv.slice(2);
  if (!accountId || !scriptName || !VERSION_ID.test(versionId ?? "") ||
      outputFile !== "version.json" || !/^[a-z0-9-]+$/.test(scriptName))
    throw Error("PAP1475_INVALID_CLI_ARGUMENTS");
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw Error("PAP1475_TOKEN_MISSING");
  const url = "https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(accountId) +
    "/workers/scripts/" + encodeURIComponent(scriptName) + "/versions/" + encodeURIComponent(versionId);
  const read = async () => {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(12000),
    });
    if (response.status === 404) return { status: 404 };
    if (response.status !== 200) return { status: response.status };
    return { status: 200, body: await response.json() };
  };
  const result = await waitForWorkerVersion({
    read, expectedVersion: versionId, attempts: 20,
    delay: () => new Promise(resolve => setTimeout(resolve, 2500)),
  });
  await writeFile(outputFile, JSON.stringify(result.body, null, 2) + "\n");
  process.stdout.write("PAP1475_VERSION_METADATA_PASS attempts=" + result.attempt +
    " version=" + versionId + "\n");
}

if (process.argv[1] && /pap1475-staging-version-readback\.mjs$/i.test(process.argv[1])) {
  main().catch(error => {
    process.stderr.write("PAP1475_VERSION_METADATA_HOLD: " + error.message + "\n");
    process.exitCode = 1;
  });
}
