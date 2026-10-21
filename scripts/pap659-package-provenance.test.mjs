import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBuildManifestProvenance} from './pap659-build-provenance.mjs';
import {packageProvenance} from './pap659-package-provenance.mjs';

test('PAP-659 packaging rejects stale provenance before writing assets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pap659-package-'));
 const next=join(root,'next');const assets=join(root,'assets');
 try {
  await mkdir(next);
  await writeFile(join(next,'build-manifest.json'),'{"version":1}');
  const record=await createBuildManifestProvenance(next);
  await writeFile(join(next,'pap659-build-provenance.json'),JSON.stringify({...record,digest:'a'.repeat(64)}));
  await assert.rejects(()=>packageProvenance(next,assets),/PAP659_PROVENANCE_MISMATCH/);
  await assert.rejects(()=>readdir(assets),/ENOENT/);
  await writeFile(join(next,'pap659-build-provenance.json'),JSON.stringify(record));
  assert.deepEqual(await packageProvenance(next,assets),record);
  assert.deepEqual(JSON.parse(await readFile(join(assets,'pap659-build-provenance.json'),'utf8')),record);
 }finally{await rm(root,{recursive:true,force:true});}
});
