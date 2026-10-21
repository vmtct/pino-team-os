import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBuildManifestProvenance} from './pap659-build-provenance.mjs';

test('PAP-659 hashes actual manifest bytes and fails closed without artifact',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pap659-'));
 try {
  await assert.rejects(()=>createBuildManifestProvenance(dir),/ENOENT/);
  await writeFile(join(dir,'build-manifest.json'),'{}');
  const first=await createBuildManifestProvenance(dir);
  assert.match(first.digest,/^[0-9a-f]{64}$/);
  assert.equal(first.kind,'NEXT_BUILD_MANIFEST_SHA256');
  await writeFile(join(dir,'build-manifest.json'),'{"changed":true}');
  const second=await createBuildManifestProvenance(dir);
  assert.notEqual(first.digest,second.digest);
  await writeFile(join(dir,'build-manifest.json'),'');
  await assert.rejects(()=>createBuildManifestProvenance(dir),/Empty build manifest/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
