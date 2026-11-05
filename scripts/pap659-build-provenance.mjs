import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Digest actual Next.js build manifest bytes, never the source commit SHA. */
export async function createBuildManifestProvenance(buildDirectory) {
  const bytes = await readFile(join(buildDirectory, 'build-manifest.json'));
  if (bytes.length === 0) throw new Error('Empty build manifest');
  return { schemaVersion: 1, kind: 'NEXT_BUILD_MANIFEST_SHA256', digest: createHash('sha256').update(bytes).digest('hex') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] || '.next';
  const result = await createBuildManifestProvenance(dir);
  await writeFile(join(dir, 'pap659-build-provenance.json'), JSON.stringify(result) + '\n');
  process.stdout.write(`${result.kind}: ${result.digest}\n`);
}
