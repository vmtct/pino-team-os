import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const DIGEST = /^[0-9a-f]{64}$/;
const KIND = "NEXT_BUILD_MANIFEST_SHA256";

/** PAP-1566 / governance Epic PAP-184.
 * Bounded read-after-write convergence for a *valid* prior static provenance
 * asset. A bad HTTP response, invalid schema or malformed JSON fails immediately.
 * A persistent valid-but-stale digest fails terminally so guarded CD rolls back.
 */
export async function attestStagingProvenance(
  url, expectedDigest,
  { fetcher = fetch, pause = ms => new Promise(r => setTimeout(r, ms)),
    attempts = 5, delayMs = 2000 } = {},
) {
  const address = new URL(url);
  if (address.protocol !== "https:" || address.pathname !== "/pap659-build-provenance.json" ||
      address.search || address.hash || !DIGEST.test(expectedDigest) ||
      !Number.isInteger(attempts) || attempts < 1 || attempts > 5 ||
      !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 3000)
    throw Error("PAP1566_INVALID_PROVENANCE_PREFLIGHT");

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetcher(address.toString(), {
      method: "GET", redirect: "error", cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status !== 200)
      throw Error("PAP1566_PROVENANCE_HTTP_" + response.status);

    let record;
    try { record = await response.json(); }
    catch { throw Error("PAP1566_PROVENANCE_INVALID_JSON"); }
    if (!record || typeof record !== "object" || Array.isArray(record) ||
        record.schemaVersion !== 1 || record.kind !== KIND || !DIGEST.test(record.digest))
      throw Error("PAP1566_PROVENANCE_INVALID_SCHEMA");

    if (record.digest === expectedDigest) {
      console.log("PAP1566_PROVENANCE_PASS attempt=" + attempt +
        " digest=" + expectedDigest);
      return { digest: expectedDigest, attempt };
    }

    console.warn("PAP1566_PROVENANCE_STALE attempt=" + attempt + "/" + attempts +
      " expected=" + expectedDigest + " observed=" + record.digest);
    if (attempt < attempts) await pause(delayMs);
  }
  throw Error("PAP1566_PROVENANCE_TERMINAL_MISMATCH");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // No top-level await: this module is imported through tsx under CJS test
  // transforms, and executed natively as .mjs by the Staging CD CLI.
  void attestStagingProvenance(process.argv[2] ?? "", process.argv[3] ?? "")
    .catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
