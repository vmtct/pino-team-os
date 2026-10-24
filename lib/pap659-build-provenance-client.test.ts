import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fetchBuildManifestProvenance,parseBuildManifestProvenance} from './pap659-build-provenance-client';
const good={schemaVersion:1,kind:'NEXT_BUILD_MANIFEST_SHA256',digest:'a'.repeat(64)};
test('reject missing, malformed and spoofed build evidence',()=>{
 assert.equal(parseBuildManifestProvenance(null),null);
 assert.equal(parseBuildManifestProvenance({...good,rendererAcknowledged:true}),null);
 assert.equal(parseBuildManifestProvenance({...good,digest:'0'.repeat(40)}),null);
 assert.equal(parseBuildManifestProvenance(good),good.digest);
});
test('unavailable asset never produces a synthetic digest',async()=>{
 assert.equal(await fetchBuildManifestProvenance(async()=>new Response(null,{status:404})),null);
 assert.equal(await fetchBuildManifestProvenance(async()=>Response.json(good)),good.digest);
});
